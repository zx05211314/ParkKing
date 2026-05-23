import * as fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { computePackSha256 } from './registryUtils'

interface RollbackMetaFiles {
  [fileName: string]: {
    sha256: string
    bytes: number
  }
}

export interface RollbackPublishedMetaState {
  meta: Record<string, unknown>
  files: RollbackMetaFiles | null
  metaSha256: string
  packSha256: string
  publishedAt: string
}

export const readRollbackPublishedMetaState = async (
  metaPath: string,
): Promise<RollbackPublishedMetaState> => {
  const metaRaw = await fs.readFile(metaPath, 'utf-8')
  const meta = JSON.parse(metaRaw) as Record<string, unknown>
  const files =
    meta.files && typeof meta.files === 'object'
      ? (meta.files as RollbackMetaFiles)
      : null

  return {
    meta,
    files,
    metaSha256: crypto.createHash('sha256').update(metaRaw).digest('hex'),
    packSha256: files ? computePackSha256(files) : '',
    publishedAt: (meta.publishedAt as string) ?? new Date().toISOString(),
  }
}
