import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { RollbackBackupEntry } from './rollbackPackTypes'

export const listRollbackBackups = async (
  backupRoot: string,
  districtId: string,
): Promise<RollbackBackupEntry[]> => {
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

export const resolveRollbackTarget = (
  backups: RollbackBackupEntry[],
  districtId: string,
  backupId?: string,
) => {
  if (backups.length === 0) {
    throw new Error(`No backups found for ${districtId}`)
  }

  if (!backupId) {
    return backups[0]
  }

  const matches = backups.filter(
    (entry) => entry.name === backupId || entry.name.endsWith(backupId),
  )
  if (matches.length === 0) {
    throw new Error(`Backup ${backupId} not found for ${districtId}`)
  }
  if (matches.length > 1) {
    throw new Error(`Backup ${backupId} is ambiguous for ${districtId}`)
  }
  return matches[0]
}

export const readCurrentDatasetHash = async (destDir: string) => {
  try {
    const currentMeta = await fs.readFile(path.resolve(destDir, 'dataset_meta.json'), 'utf-8')
    const parsed = JSON.parse(currentMeta) as Record<string, unknown>
    return (parsed.datasetHash as string) ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export const buildRollbackSwapBackupPath = (
  backupRoot: string,
  districtId: string,
  currentHash: string,
  timestamp = new Date(),
) =>
  path.resolve(
    backupRoot,
    `${districtId}-rollback-${timestamp.toISOString().replace(/[:.]/g, '')}-${currentHash}`,
  )
