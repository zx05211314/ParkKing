import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { hashBuffer } from './ingestAllArtifacts'
import type { IngestAllArgs } from './ingestAllArgs'
import type { IngestDistrictSummary } from './ingestAllTypes'
import { publishPackAtomic } from './publishPackAtomic'
import { buildLatestPointer, writeLatestPointer } from '../ops/latestPointer'
import { writePublishManifest } from '../ops/manifestWriter'
import { buildRegistryEntryFromMeta, readPublishedMetaPath } from '../ops/registryUtils'

const readPublishedArtifact = async (
  filePath: string,
  cwd: string,
): Promise<{ path: string; sha256: string; bytes: number } | undefined> => {
  try {
    const buffer = await fs.readFile(filePath)
    return {
      path: path.relative(cwd, filePath).replace(/\\/g, '/'),
      sha256: hashBuffer(buffer),
      bytes: buffer.length,
    }
  } catch {
    return undefined
  }
}

export const buildGateResultLabel = (
  summary: IngestDistrictSummary,
  args: Pick<IngestAllArgs, 'allowWarn' | 'allowFail'>,
) => {
  const hasWarn = summary.warnings.some((warning) => warning.severity === 'WARN')
  const hasFail = summary.warnings.some((warning) => warning.severity === 'FAIL')
  return hasFail || hasWarn
    ? args.allowWarn || args.allowFail
      ? 'OVERRIDE'
      : 'WARN'
    : 'PASS'
}

export const publishDistrictSummary = async (params: {
  summary: IngestDistrictSummary
  args: Pick<IngestAllArgs, 'allowWarn' | 'allowFail' | 'overrideReason'>
  cwd?: string
}) => {
  const cwd = params.cwd ?? process.cwd()
  const basePublicDir = path.resolve(cwd, 'public/data/generated')
  const districtPublicDir = path.resolve(basePublicDir, params.summary.districtId)
  const result = await publishPackAtomic({
    sourceDir: params.summary.config.outputs.generatedDir,
    destDir: params.summary.config.outputs.publicDir,
  })
  params.summary.publishResult = result

  const publishedMetaPath = readPublishedMetaPath(params.summary.config.outputs.publicDir)
  params.summary.registryEntry = await buildRegistryEntryFromMeta(
    publishedMetaPath,
    params.summary.districtId,
  )

  const metaRaw = await fs.readFile(readPublishedMetaPath(districtPublicDir), 'utf-8')
  const meta = JSON.parse(metaRaw) as Record<string, unknown>
  const provenance = await readPublishedArtifact(
    path.resolve(districtPublicDir, 'provenance.json'),
    cwd,
  )
  const diffReport = await readPublishedArtifact(
    path.resolve(districtPublicDir, 'diff_report.json'),
    cwd,
  )
  const metricsHistory = await readPublishedArtifact(
    path.resolve(districtPublicDir, 'metrics_history.jsonl'),
    cwd,
  )

  const manifestPath = await writePublishManifest({
    baseDir: basePublicDir,
    manifest: {
      districtId: params.summary.districtId,
      districtName: params.summary.districtName ?? params.summary.districtId,
      schemaVersion: Number(meta.schemaVersion ?? 0),
      datasetHash: params.summary.datasetHash,
      configHash: (meta.configHash as string) ?? 'unknown',
      generatedAt: (meta.generatedAt as string) ?? '',
      publishedAt: result.publishedAt,
      metaSha256: result.metaSha256,
      packSha256: result.packSha256,
      totalBytes: result.totalBytes,
      files: (meta.files as Record<string, { sha256: string; bytes: number }>) ?? {},
      provenance,
      diffReport,
      metricsHistory,
      gateResult: buildGateResultLabel(params.summary, params.args),
      overrideReason: params.args.overrideReason ?? null,
      baselines: params.summary.baselineUsed,
      toolVersions: {
        node: process.version,
      },
    },
  })

  const latestPointer = buildLatestPointer({
    datasetHash: params.summary.datasetHash,
    publishedAt: result.publishedAt,
    manifestPath,
    schemaVersion: Number(meta.schemaVersion ?? 0),
  })
  await writeLatestPointer(basePublicDir, params.summary.districtId, latestPointer)

  if (params.summary.registryEntry?.latest) {
    params.summary.registryEntry.latest.datasetHash = params.summary.datasetHash
    params.summary.registryEntry.latest.publishedAt = result.publishedAt
  }
}

export const writeIngestAllRegistry = async (params: {
  summaries: IngestDistrictSummary[]
  generatedAt: string
  cwd?: string
  logger?: (message: string) => void
}) => {
  const cwd = params.cwd ?? process.cwd()
  const logger = params.logger ?? console.log
  const registryDir = path.resolve(cwd, 'public/data/generated')
  await fs.mkdir(registryDir, { recursive: true })
  const registryPath = path.resolve(registryDir, 'registry.json')
  const nextEntries = params.summaries
    .map((summary) => summary.registryEntry)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  const nextDistrictIds = new Set(nextEntries.map((entry) => entry.districtId))
  let preservedEntries: NonNullable<IngestDistrictSummary['registryEntry']>[] = []
  try {
    const existingRaw = await fs.readFile(registryPath, 'utf-8')
    const existing = JSON.parse(existingRaw) as {
      districts?: Array<NonNullable<IngestDistrictSummary['registryEntry']>>
    }
    preservedEntries = (existing.districts ?? []).filter(
      (entry) => entry?.districtId && !nextDistrictIds.has(entry.districtId),
    )
  } catch {
    preservedEntries = []
  }
  const registry = {
    generatedAt: params.generatedAt,
    districts: [...preservedEntries, ...nextEntries].sort((left, right) =>
      left.districtId.localeCompare(right.districtId),
    ),
  }
  await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8')
  logger(`Wrote registry to ${registryPath}`)
}
