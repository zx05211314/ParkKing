export interface RollbackOptions {
  baseDir: string
  districtId: string
  backupId?: string
  latest?: boolean
}

export interface ParsedRollbackArgs {
  districtId: string | null
  backupId: string | null
  latest: boolean
  baseDir: string | null
}

export interface RollbackBackupEntry {
  name: string
  mtimeMs: number
}
