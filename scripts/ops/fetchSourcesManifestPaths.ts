import * as fs from 'node:fs/promises'

import type { SourceEntry, SourceManifest } from './fetchSourcesTypes'
import { isAbsoluteCompat, resolveCompat } from './pathCompat'

export const readSourceManifest = async (manifestPath: string): Promise<SourceManifest> => {
  const raw = await fs.readFile(manifestPath, 'utf-8')
  return JSON.parse(raw) as SourceManifest
}

export const normalizeFetchSourcesPath = (value: string) => value.replace(/\\/g, '/')

export const resolveSourceDestinations = (
  sources: SourceEntry[],
  manifestDir: string,
): string[] => {
  return sources.map((source) =>
    isAbsoluteCompat(source.dest)
      ? source.dest
      : resolveCompat(manifestDir, source.dest),
  )
}

export const inferDistrictIdFromDest = (destPath: string) => {
  const normalized = normalizeFetchSourcesPath(destPath)
  const match = normalized.match(/data\/(?:raw|sources)\/([^/]+)\//)
  if (match && match[1]) {
    return match[1]
  }
  return null
}
