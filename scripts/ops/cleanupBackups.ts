import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface CleanupOptions {
  baseDir: string
  maxBackupsPerDistrict: number
  maxBackupAgeDays: number
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const baseIndex = args.findIndex((arg) => arg === '--baseDir')
  const maxIndex = args.findIndex((arg) => arg === '--maxBackups')
  const ageIndex = args.findIndex((arg) => arg === '--maxAgeDays')

  return {
    baseDir: baseIndex >= 0 ? args[baseIndex + 1] : null,
    maxBackups: maxIndex >= 0 ? Number(args[maxIndex + 1]) : null,
    maxAgeDays: ageIndex >= 0 ? Number(args[ageIndex + 1]) : null,
  }
}

const listDirs = async (dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
}

const daysSince = (mtimeMs: number) => {
  const diffMs = Date.now() - mtimeMs
  return diffMs / (1000 * 60 * 60 * 24)
}

const parseDistrictId = (backupName: string) => {
  const idx = backupName.indexOf('-')
  if (idx === -1) {
    return backupName
  }
  return backupName.slice(0, idx)
}

export const cleanupBackups = async (options: CleanupOptions) => {
  const backupRoot = path.resolve(options.baseDir, '.backup')
  const stagingRoot = path.resolve(options.baseDir, '.staging')
  const removed: string[] = []

  const backupDirs = await listDirs(backupRoot)
  const grouped: Record<string, { name: string; mtimeMs: number }[]> = {}

  for (const name of backupDirs) {
    const fullPath = path.resolve(backupRoot, name)
    const stat = await fs.stat(fullPath)
    const districtId = parseDistrictId(name)
    grouped[districtId] = grouped[districtId] ?? []
    grouped[districtId].push({ name, mtimeMs: stat.mtimeMs })
  }

  for (const [districtId, backups] of Object.entries(grouped)) {
    const sorted = backups.sort((a, b) => b.mtimeMs - a.mtimeMs)
    const keep = new Set(sorted.slice(0, options.maxBackupsPerDistrict).map((b) => b.name))

    for (const backup of sorted) {
      const ageDays = daysSince(backup.mtimeMs)
      const shouldRemove =
        ageDays > options.maxBackupAgeDays || !keep.has(backup.name)
      if (shouldRemove) {
        const target = path.resolve(backupRoot, backup.name)
        await fs.rm(target, { recursive: true, force: true })
        removed.push(`${districtId}:${backup.name}`)
      }
    }
  }

  const stagingDirs = await listDirs(stagingRoot)
  for (const name of stagingDirs) {
    const fullPath = path.resolve(stagingRoot, name)
    const stat = await fs.stat(fullPath)
    if (daysSince(stat.mtimeMs) > 1) {
      await fs.rm(fullPath, { recursive: true, force: true })
      removed.push(`staging:${name}`)
    }
  }

  return removed
}

const run = async () => {
  const args = parseArgs(process.argv)
  const baseDir = args.baseDir ?? 'public/data/generated'
  const maxBackupsPerDistrict = Number.isFinite(args.maxBackups)
    ? (args.maxBackups as number)
    : 5
  const maxBackupAgeDays = Number.isFinite(args.maxAgeDays)
    ? (args.maxAgeDays as number)
    : 30

  const removed = await cleanupBackups({
    baseDir,
    maxBackupsPerDistrict,
    maxBackupAgeDays,
  })

  console.log(`Removed ${removed.length} backup/staging entries.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
