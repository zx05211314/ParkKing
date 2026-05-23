import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { SourceEntry, SourceManifest } from './fetchSourcesTypes'

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
    path.isAbsolute(source.dest) ? source.dest : path.resolve(manifestDir, source.dest),
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
