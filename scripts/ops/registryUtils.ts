import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import crypto from 'node:crypto'

export interface RegistryEntry {
  districtId: string
  districtName: string
  schemaVersion: number
  datasetHash: string
  publishedAt: string
  generatedAt: string
  totalBytes: number
  fileCount: number
  metaSha256: string
  packSha256: string
  latest: {
    datasetHash: string
    publishedAt: string
  }
}

const sha256 = (value: string) => {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export const computePackSha256 = (
  files: Record<string, { sha256: string }>,
): string => {
  const lines = Object.keys(files)
    .sort()
    .map((fileName) => `${fileName}:${files[fileName].sha256}`)
    .join('\n')
  return sha256(lines)
}

export const buildRegistryEntryFromMeta = async (
  metaPath: string,
  districtId: string,
): Promise<RegistryEntry> => {
  const raw = await fs.readFile(metaPath, 'utf-8')
  const meta = JSON.parse(raw) as Record<string, unknown>
  const files = meta.files as Record<string, { sha256: string; bytes: number }>
  if (!files) {
    throw new Error('dataset_meta.json missing files map')
  }
  const metaSha256 = sha256(raw)
  const packSha256 = computePackSha256(files)
  const fileCount = Object.keys(files).length
  const totalBytes = Number(meta.totalBytes ?? 0)

  return {
    districtId,
    districtName: (meta.districtName as string) ?? districtId,
    schemaVersion: Number(meta.schemaVersion ?? 0),
    datasetHash: (meta.datasetHash as string) ?? 'unknown',
    publishedAt: (meta.publishedAt as string) ?? '',
    generatedAt: (meta.generatedAt as string) ?? '',
    totalBytes,
    fileCount,
    metaSha256,
    packSha256,
    latest: {
      datasetHash: (meta.datasetHash as string) ?? 'unknown',
      publishedAt: (meta.publishedAt as string) ?? '',
    },
  }
}

export const readPublishedMetaPath = (destDir: string) => {
  return path.resolve(destDir, 'dataset_meta.json')
}
