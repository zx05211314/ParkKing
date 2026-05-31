import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  daysSince,
  selectBackupRemovals,
} from './cleanupBackupsRetention'
import {
  loadCleanupBackupGroups,
  loadCleanupStagingEntries,
} from './cleanupBackupsState'

export interface CleanupOptions {
  baseDir: string
  maxBackupsPerDistrict: number
  maxBackupAgeDays: number
}

export const cleanupBackups = async (options: CleanupOptions) => {
  const backupRoot = path.resolve(options.baseDir, '.backup')
  const stagingRoot = path.resolve(options.baseDir, '.staging')
  const removed: string[] = []
  const grouped = await loadCleanupBackupGroups(backupRoot)

  for (const [districtId, backups] of Object.entries(grouped)) {
    for (const backup of selectBackupRemovals({
      backups,
      maxBackupsPerDistrict: options.maxBackupsPerDistrict,
      maxBackupAgeDays: options.maxBackupAgeDays,
    })) {
      const target = path.resolve(backupRoot, backup.name)
      await fs.rm(target, { recursive: true, force: true })
      removed.push(`${districtId}:${backup.name}`)
    }
  }

  const stagingEntries = await loadCleanupStagingEntries(stagingRoot)
  for (const entry of stagingEntries) {
    if (daysSince(entry.mtimeMs) > 1) {
      await fs.rm(path.resolve(stagingRoot, entry.name), {
        recursive: true,
        force: true,
      })
      removed.push(`staging:${entry.name}`)
    }
  }

  return removed
}
