import type { CleanupOptions } from './cleanupBackupsWorkflow'

export const resolveCleanupBackupsOptions = (args: {
  baseDir: string | null
  maxBackups: number | null
  maxAgeDays: number | null
}): CleanupOptions => {
  return {
    baseDir: args.baseDir ?? 'public/data/generated',
    maxBackupsPerDistrict: Number.isFinite(args.maxBackups)
      ? (args.maxBackups as number)
      : 5,
    maxBackupAgeDays: Number.isFinite(args.maxAgeDays)
      ? (args.maxAgeDays as number)
      : 30,
  }
}
