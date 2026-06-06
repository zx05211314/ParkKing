import * as path from 'node:path'
import type { SourceFileMeta } from '../ingest/readConfig'

export interface P0ReviewManifestDriftSource {
  districtId?: string | null
  configHash?: string | null
  datasetHash?: string | null
}

export interface P0CurrentConfigDriftSource {
  districtId: string
  configHash: string
  datasetHash: string
  sourceFiles: SourceFileMeta[]
  signOverrides: {
    matchToleranceMeters: number
  }
}

export interface P0RuntimePackDriftSource {
  districtId?: string | null
  configHash?: string | null
  datasetHash?: string | null
  sourceFiles?: SourceFileMeta[] | null
  signOverrideMatchToleranceMeters?: number | null
}

interface SourceFileDrift {
  missing: string[]
  extra: string[]
  changed: string[]
}

const normalizeSourcePath = (value: string) => path.normalize(value).toLowerCase()

const sourceIdentity = (sourceFile: SourceFileMeta) =>
  sourceFile.sourceKey?.toLowerCase() ?? normalizeSourcePath(sourceFile.path)

const formatHashMismatch = (
  label: string,
  left: string,
  right: string,
  suffix: string,
) => `${label} ${left} does not match current ${label} ${right}. ${suffix}`

const toSourceFileMap = (sourceFiles: SourceFileMeta[]) => {
  const entries = new Map<string, SourceFileMeta>()
  sourceFiles.forEach((sourceFile) => {
    entries.set(sourceIdentity(sourceFile), sourceFile)
  })
  return entries
}

export const compareRuntimeSourceFiles = (
  currentSourceFiles: SourceFileMeta[],
  runtimeSourceFiles: SourceFileMeta[],
): SourceFileDrift => {
  const current = toSourceFileMap(currentSourceFiles)
  const runtime = toSourceFileMap(runtimeSourceFiles)
  const missing: string[] = []
  const extra: string[] = []
  const changed: string[] = []

  runtime.forEach((runtimeFile, normalizedPath) => {
    const currentFile = current.get(normalizedPath)
    if (!currentFile) {
      missing.push(runtimeFile.path)
      return
    }
    const contentChanged =
      currentFile.contentHash && runtimeFile.contentHash
        ? currentFile.contentHash !== runtimeFile.contentHash
        : currentFile.size !== runtimeFile.size ||
          Math.round(currentFile.mtimeMs) !== Math.round(runtimeFile.mtimeMs)
    if (contentChanged) {
      changed.push(runtimeFile.path)
    }
  })
  current.forEach((currentFile, normalizedPath) => {
    if (!runtime.has(normalizedPath)) {
      extra.push(currentFile.path)
    }
  })

  return { missing, extra, changed }
}

const hasSourceFileDrift = (drift: SourceFileDrift) =>
  drift.missing.length > 0 || drift.extra.length > 0 || drift.changed.length > 0

const formatSourceFileDrift = (drift: SourceFileDrift) => {
  const parts = [
    drift.missing.length > 0 ? `missing ${drift.missing.length}` : null,
    drift.extra.length > 0 ? `extra ${drift.extra.length}` : null,
    drift.changed.length > 0 ? `changed ${drift.changed.length}` : null,
  ].filter((value): value is string => value !== null)
  return parts.join(', ')
}

const buildSourceDriftSuffix = ({
  current,
  runtime,
}: {
  current: P0CurrentConfigDriftSource
  runtime: P0RuntimePackDriftSource | null
}) => {
  if (!runtime?.sourceFiles || runtime.sourceFiles.length === 0) {
    return 'Runtime pack source files are unavailable, so this drift cannot be classified.'
  }
  const sourceDrift = compareRuntimeSourceFiles(current.sourceFiles, runtime.sourceFiles)
  const signToleranceMatches =
    typeof runtime.signOverrideMatchToleranceMeters !== 'number' ||
    runtime.signOverrideMatchToleranceMeters === current.signOverrides.matchToleranceMeters

  if (!hasSourceFileDrift(sourceDrift) && signToleranceMatches) {
    return 'Current source files match the runtime pack; this appears to be non-source config drift, such as validation/ops metadata.'
  }

  const sourceDriftLabel = hasSourceFileDrift(sourceDrift)
    ? `source file drift: ${formatSourceFileDrift(sourceDrift)}`
    : 'source files match'
  const signToleranceLabel = signToleranceMatches
    ? null
    : `sign override match tolerance changed from ${runtime.signOverrideMatchToleranceMeters} to ${current.signOverrides.matchToleranceMeters}`
  return `Current config can change data output (${[sourceDriftLabel, signToleranceLabel]
    .filter(Boolean)
    .join('; ')}).`
}

export const buildP0ReviewConfigDriftWarnings = ({
  manifest,
  current,
  runtime,
}: {
  manifest: P0ReviewManifestDriftSource | null
  current: P0CurrentConfigDriftSource
  runtime: P0RuntimePackDriftSource | null
}) => {
  if (!manifest) {
    return []
  }
  const warnings: string[] = []
  if (manifest.districtId && manifest.districtId !== current.districtId) {
    warnings.push(
      `Review manifest district ${manifest.districtId} does not match config district ${current.districtId}.`,
    )
  }

  const suffix = buildSourceDriftSuffix({ current, runtime })
  if (manifest.configHash && manifest.configHash !== current.configHash) {
    warnings.push(
      formatHashMismatch('config hash', manifest.configHash, current.configHash, suffix),
    )
  }
  if (manifest.datasetHash && manifest.datasetHash !== current.datasetHash) {
    warnings.push(
      formatHashMismatch('dataset hash', manifest.datasetHash, current.datasetHash, suffix),
    )
  }

  return warnings
}
