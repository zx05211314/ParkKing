import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { FeatureCollection } from 'geojson'
import type { ResolvedConfig, SourceFileMeta } from './readConfig'
import { resolveOverrideReportsPath } from './overrideReportsPath'

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const daysSince = (timestampMs: number) => {
  const diffMs = Date.now() - timestampMs
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}

export const readGeoJsonFeatureCount = async (filePath: string) => {
  if (!(await fileExists(filePath))) {
    return 0
  }
  const raw = await fs.readFile(filePath, 'utf-8')
  const collection = JSON.parse(raw) as FeatureCollection
  return collection.features.length
}

export const readGeoJsonCollection = async (filePath: string) => {
  if (!(await fileExists(filePath))) {
    return null
  }
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as FeatureCollection
}

export const readProvenanceFetchedAt = async (config: ResolvedConfig) => {
  const candidates = [
    path.resolve(config.outputs.generatedDir, 'provenance.json'),
    path.resolve(process.cwd(), 'data', 'sources', config.districtId, 'provenance.json'),
  ]
  for (const candidate of candidates) {
    if (!(await fileExists(candidate))) {
      continue
    }
    try {
      const raw = await fs.readFile(candidate, 'utf-8')
      const parsed = JSON.parse(raw) as { fetchedAt?: string }
      if (typeof parsed.fetchedAt === 'string') {
        return parsed.fetchedAt
      }
    } catch {
      continue
    }
  }
  return null
}

export const readIntersectionsReport = async (generatedDir: string) => {
  const reportPath = path.resolve(generatedDir, 'intersections_report.json')
  if (!(await fileExists(reportPath))) {
    return null
  }
  const raw = await fs.readFile(reportPath, 'utf-8')
  return JSON.parse(raw) as Record<string, unknown>
}

export const resolveSignOverridesFreshness = (config: ResolvedConfig) => {
  const signOverrideSources = [
    config.inputs.sign_overrides,
    resolveOverrideReportsPath(config.districtId),
  ].filter((entry): entry is string => typeof entry === 'string')
  const signOverrideFile =
    signOverrideSources
      .map((source) => config.sourceFiles.find((entry) => entry.path === source))
      .filter((entry): entry is SourceFileMeta => Boolean(entry))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] ?? null

  return {
    signOverridesUpdatedAt: signOverrideFile
      ? new Date(signOverrideFile.mtimeMs).toISOString()
      : null,
    signOverridesFreshnessDays: signOverrideFile
      ? daysSince(signOverrideFile.mtimeMs)
      : null,
  }
}
