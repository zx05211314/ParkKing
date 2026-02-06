import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { buildRegistryEntryFromMeta, computePackSha256, readPublishedMetaPath } from './registryUtils'
import { writeLatestPointer, buildLatestPointer } from './latestPointer'
import { writePublishManifest } from './manifestWriter'

interface RollbackOptions {
  baseDir: string
  districtId: string
  backupId?: string
  latest?: boolean
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const districtIndex = args.findIndex((arg) => arg === '--district')
  const toIndex = args.findIndex((arg) => arg === '--to')
  const latest = args.includes('--latest')
  const baseIndex = args.findIndex((arg) => arg === '--baseDir')
  return {
    districtId: districtIndex >= 0 ? args[districtIndex + 1] : null,
    backupId: toIndex >= 0 ? args[toIndex + 1] : null,
    latest,
    baseDir: baseIndex >= 0 ? args[baseIndex + 1] : null,
  }
}

const listBackupDirs = async (backupRoot: string, districtId: string) => {
  const entries = await fs.readdir(backupRoot, { withFileTypes: true })
  const backups = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${districtId}-`))
    .map((entry) => entry.name)
  const withStats = await Promise.all(
    backups.map(async (name) => {
      const stat = await fs.stat(path.resolve(backupRoot, name))
      return { name, mtimeMs: stat.mtimeMs }
    }),
  )
  return withStats.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

const updateRegistry = async (params: {
  baseDir: string
  districtId: string
  metaPath: string
}) => {
  const registryPath = path.resolve(params.baseDir, 'registry.json')
  let registry: { generatedAt: string; districts: unknown[] } = {
    generatedAt: new Date().toISOString(),
    districts: [],
  }
  try {
    const raw = await fs.readFile(registryPath, 'utf-8')
    registry = JSON.parse(raw) as typeof registry
  } catch {
    registry = { generatedAt: new Date().toISOString(), districts: [] }
  }

  const entry = await buildRegistryEntryFromMeta(params.metaPath, params.districtId)
  const updatedDistricts = registry.districts.filter(
    (existing) =>
      (existing as { districtId?: string }).districtId !== params.districtId,
  )
  updatedDistricts.push(entry)

  registry = {
    generatedAt: new Date().toISOString(),
    districts: updatedDistricts,
  }

  await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8')
}

const logRollback = async (baseDir: string, payload: Record<string, unknown>) => {
  const opsDir = path.resolve(baseDir, '_ops')
  await fs.mkdir(opsDir, { recursive: true })
  const logPath = path.resolve(opsDir, 'rollback_log.jsonl')
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf-8')
}

export const rollbackPack = async (options: RollbackOptions) => {
  const baseDir = options.baseDir
  const districtId = options.districtId
  const backupRoot = path.resolve(baseDir, '.backup')
  const destDir = path.resolve(baseDir, districtId)

  const backups = await listBackupDirs(backupRoot, districtId)
  if (backups.length === 0) {
    throw new Error(`No backups found for ${districtId}`)
  }

  let target = backups[0]
  if (options.backupId) {
    const matches = backups.filter((entry) =>
      entry.name === options.backupId || entry.name.endsWith(options.backupId!),
    )
    if (matches.length === 0) {
      throw new Error(`Backup ${options.backupId} not found for ${districtId}`)
    }
    if (matches.length > 1) {
      throw new Error(`Backup ${options.backupId} is ambiguous for ${districtId}`)
    }
    target = matches[0]
  } else if (options.latest) {
    target = backups[0]
  }

  const targetPath = path.resolve(backupRoot, target.name)

  let currentHash = 'unknown'
  try {
    const currentMeta = await fs.readFile(path.resolve(destDir, 'dataset_meta.json'), 'utf-8')
    const parsed = JSON.parse(currentMeta) as Record<string, unknown>
    currentHash = (parsed.datasetHash as string) ?? currentHash
  } catch {
    currentHash = 'unknown'
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '')
  const swapBackup = path.resolve(
    backupRoot,
    `${districtId}-rollback-${timestamp}-${currentHash}`,
  )

  await fs.rename(destDir, swapBackup)
  await fs.rename(targetPath, destDir)

  const metaPath = readPublishedMetaPath(destDir)
  await updateRegistry({
    baseDir,
    districtId,
    metaPath,
  })

  await logRollback(baseDir, {
    timestamp: new Date().toISOString(),
    districtId,
    from: target.name,
    swappedTo: path.basename(swapBackup),
  })

  const metaRaw = await fs.readFile(metaPath, 'utf-8')
  const meta = JSON.parse(metaRaw) as Record<string, unknown>
  const files = meta.files as Record<string, { sha256: string; bytes: number }>
  const metaSha256 = crypto.createHash('sha256').update(metaRaw).digest('hex')
  const packSha256 = files ? computePackSha256(files) : ''
  const publishedAt = (meta.publishedAt as string) ?? new Date().toISOString()

  let manifestPath = ''
  if (files) {
    manifestPath = await writePublishManifest({
      baseDir,
      manifest: {
        districtId,
        districtName: (meta.districtName as string) ?? districtId,
        schemaVersion: Number(meta.schemaVersion ?? 0),
        datasetHash: (meta.datasetHash as string) ?? 'unknown',
        configHash: (meta.configHash as string) ?? 'unknown',
        generatedAt: (meta.generatedAt as string) ?? '',
        publishedAt,
        metaSha256,
        packSha256,
        totalBytes: Number(meta.totalBytes ?? 0),
        files,
        gateResult: 'ROLLBACK',
        toolVersions: {
          node: process.version,
        },
      },
    })
  }

  const latestPointer = buildLatestPointer({
    datasetHash: (meta.datasetHash as string) ?? 'unknown',
    publishedAt,
    manifestPath,
    schemaVersion: Number(meta.schemaVersion ?? 0),
  })
  await writeLatestPointer(baseDir, districtId, latestPointer)
}

const run = async () => {
  const args = parseArgs(process.argv)
  if (!args.districtId) {
    throw new Error('Missing --district <id>')
  }

  await rollbackPack({
    baseDir: args.baseDir ?? 'public/data/generated',
    districtId: args.districtId,
    backupId: args.backupId ?? undefined,
    latest: args.latest,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
