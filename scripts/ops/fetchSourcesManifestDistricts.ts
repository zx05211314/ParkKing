import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { inferDistrictIdFromDest } from './fetchSourcesManifestPaths'
import type { DistrictSourceManifest, SourceManifest } from './fetchSourcesTypes'

export const resolveDistrictId = (
  manifest: DistrictSourceManifest,
  destPaths: string[],
) => {
  if (manifest.districtId) {
    return manifest.districtId
  }
  const candidates = new Set<string>()
  destPaths.forEach((dest) => {
    const inferred = inferDistrictIdFromDest(dest)
    if (inferred) {
      candidates.add(inferred)
    }
  })
  if (candidates.size === 1) {
    return [...candidates][0]
  }
  return null
}

export const resolveDistrictConfigPath = async (
  manifest: DistrictSourceManifest,
  manifestDir: string,
  districtId?: string | null,
) => {
  if (manifest.configPath) {
    return path.isAbsolute(manifest.configPath)
      ? manifest.configPath
      : path.resolve(manifestDir, manifest.configPath)
  }
  if (!districtId) {
    return null
  }
  const candidates = [
    path.resolve(process.cwd(), 'configs', 'prod', `${districtId}.json`),
    path.resolve(process.cwd(), 'configs', `${districtId}.json`),
  ]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

export const listDistrictSourceManifests = (
  manifest: SourceManifest,
): DistrictSourceManifest[] => {
  if (Array.isArray(manifest.districts) && manifest.districts.length > 0) {
    return manifest.districts
  }
  return [manifest]
}
