export interface BackupEntryInfo {
  name: string
  mtimeMs: number
}

export const daysSince = (mtimeMs: number, nowMs = Date.now()) => {
  const diffMs = nowMs - mtimeMs
  return diffMs / (1000 * 60 * 60 * 24)
}

export const parseDistrictId = (backupName: string) => {
  const idx = backupName.indexOf('-')
  if (idx === -1) {
    return backupName
  }
  return backupName.slice(0, idx)
}

export const selectBackupRemovals = (params: {
  backups: BackupEntryInfo[]
  maxBackupsPerDistrict: number
  maxBackupAgeDays: number
  nowMs?: number
}) => {
  const nowMs = params.nowMs ?? Date.now()
  const sorted = [...params.backups].sort((a, b) => b.mtimeMs - a.mtimeMs)
  const keep = new Set(sorted.slice(0, params.maxBackupsPerDistrict).map((b) => b.name))

  return sorted.filter((backup) => {
    const ageDays = daysSince(backup.mtimeMs, nowMs)
    return ageDays > params.maxBackupAgeDays || !keep.has(backup.name)
  })
}
