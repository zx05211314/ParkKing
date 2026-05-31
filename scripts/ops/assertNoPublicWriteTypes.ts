export interface FileSnapshotEntry {
  path: string
  mtimeMs: number
  size: number
}

export interface PublicWriteSnapshot {
  baseDir: string
  createdAt: string
  files: FileSnapshotEntry[]
}
