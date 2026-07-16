import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { RiskMode } from '../../src/domain/ranking/policy'
import type { DatasetMeta } from '../../src/data/segmentBuilder'
import { VALID_QA_REVIEW_STATUSES } from './qaReviewSummaryTypes'
import { resolveQaManifestOutPath } from './sampleQaCandidatePaths'
import {
  DEFAULT_CONFIG_ROOT,
  type QaCandidateInputCounts,
  type QaCandidateRow,
  type QaCandidateStrategy,
} from './sampleQaCandidateTypes'

export interface QaCandidateManifest {
  schemaVersion: 1
  createdAt: string
  districtId: string
  csvPath: string
  dataset: {
    baseDir: string
    districtId: string | null
    districtName: string | null
    datasetHash: string | null
    configHash: string | null
    generatedAt: string | null
    sourceUpdatedAt: string | null
    publishedAt: string | null
    publishMode: string | null
    inputCounts: QaCandidateInputCounts
    packCounts: DatasetMeta['counts'] | null
  }
  params: {
    topN: number
    riskMode: RiskMode
    radiusMeters: number
    shuffle: boolean
    seed: number
    strategy: QaCandidateStrategy
    hhmm: string
    requiredSegmentIds: string[]
  }
  rows: {
    total: number
    bucketCounts: Record<string, number>
    allowedNowCounts: Record<string, number>
    tierCounts: Record<string, number>
    reviewStatusCounts: Record<string, number>
    reviewSourceCounts: Record<string, number>
    topReasonCounts: Record<string, number>
    rowsWithParkingSpaces: number
    rowsWithMapsUrl: number
    rowsWithStreetViewUrl: number
    minScore: number | null
    maxScore: number | null
  }
  review: {
    statusColumn: 'reviewStatus'
    validStatuses: typeof VALID_QA_REVIEW_STATUSES
    summaryCommand: string
    gateCommand: string
  }
}

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1
}

const normalizeCountKey = (value: string, fallback: string) =>
  value.trim().length > 0 ? value.trim() : fallback

const quoteCommandArg = (value: string) =>
  /[\s"]/u.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value

const toCommandPath = (value: string) => {
  const relative = path.relative(process.cwd(), value)
  const commandPath =
    relative && !relative.startsWith('..') && !path.isAbsolute(relative)
      ? relative
      : value
  return commandPath.replaceAll(path.sep, '/')
}

const buildReviewCommand = (
  script: string,
  csvPath: string,
  districtId: string,
  configRoot: string,
) => {
  const quotedCsvPath = quoteCommandArg(toCommandPath(csvPath))
  if (script === 'summary') {
    return `npm run ops:qa-review-summary -- --input ${quotedCsvPath} --min-reviewed 1`
  }
  const configPath = quoteCommandArg(
    toCommandPath(path.join(configRoot, `${districtId}.json`)),
  )
  return `npm run ops:qa-review-gate -- --input ${quotedCsvPath} --config ${configPath} --min-reviewed 1 --require-status LEGAL --require-status ILLEGAL --require-bucket marked_space_park`
}

const summarizeRows = (rows: QaCandidateRow[]): QaCandidateManifest['rows'] => {
  const bucketCounts: Record<string, number> = {}
  const allowedNowCounts: Record<string, number> = {}
  const tierCounts: Record<string, number> = {}
  const reviewStatusCounts: Record<string, number> = {}
  const reviewSourceCounts: Record<string, number> = {}
  const topReasonCounts: Record<string, number> = {}
  let rowsWithParkingSpaces = 0
  let rowsWithMapsUrl = 0
  let rowsWithStreetViewUrl = 0
  let minScore: number | null = null
  let maxScore: number | null = null

  rows.forEach((row) => {
    increment(bucketCounts, normalizeCountKey(row.reviewBucket, 'unbucketed'))
    increment(allowedNowCounts, normalizeCountKey(row.allowedNow, 'unknown'))
    increment(tierCounts, normalizeCountKey(row.tier, 'unknown'))
    increment(reviewStatusCounts, normalizeCountKey(row.reviewStatus, 'pending'))
    increment(
      reviewSourceCounts,
      normalizeCountKey(row.reviewSource, row.reviewStatus ? 'manual' : 'pending'),
    )
    row.topReasons.forEach((reason) => increment(topReasonCounts, reason))

    if (Number(row.parkingSpaceCount) > 0) {
      rowsWithParkingSpaces += 1
    }
    if (row.mapsUrl) {
      rowsWithMapsUrl += 1
    }
    if (row.streetViewUrl) {
      rowsWithStreetViewUrl += 1
    }

    const score = Number(row.score)
    if (Number.isFinite(score)) {
      minScore = minScore === null ? score : Math.min(minScore, score)
      maxScore = maxScore === null ? score : Math.max(maxScore, score)
    }
  })

  return {
    total: rows.length,
    bucketCounts,
    allowedNowCounts,
    tierCounts,
    reviewStatusCounts,
    reviewSourceCounts,
    topReasonCounts,
    rowsWithParkingSpaces,
    rowsWithMapsUrl,
    rowsWithStreetViewUrl,
    minScore,
    maxScore,
  }
}

export const buildQaCandidateManifest = (params: {
  districtId: string
  csvPath: string
  configRoot?: string
  datasetBaseDir: string
  datasetMeta: DatasetMeta | null
  inputCounts: QaCandidateInputCounts
  rows: QaCandidateRow[]
  topN: number
  riskMode: RiskMode
  radiusMeters: number
  shuffle: boolean
  seed: number
  strategy: QaCandidateStrategy
  hhmm: string
  requiredSegmentIds?: string[]
  createdAt?: string
}): QaCandidateManifest => {
  const csvPath = path.resolve(params.csvPath)
  const configRoot = params.configRoot ?? DEFAULT_CONFIG_ROOT
  return {
    schemaVersion: 1,
    createdAt: params.createdAt ?? new Date().toISOString(),
    districtId: params.districtId,
    csvPath,
    dataset: {
      baseDir: path.resolve(params.datasetBaseDir),
      districtId: params.datasetMeta?.districtId ?? null,
      districtName: params.datasetMeta?.districtName ?? null,
      datasetHash: params.datasetMeta?.datasetHash ?? null,
      configHash: params.datasetMeta?.configHash ?? null,
      generatedAt: params.datasetMeta?.generatedAt ?? null,
      sourceUpdatedAt: params.datasetMeta?.sourceUpdatedAt ?? null,
      publishedAt: params.datasetMeta?.publishedAt ?? null,
      publishMode: params.datasetMeta?.publishMode ?? null,
      inputCounts: params.inputCounts,
      packCounts: params.datasetMeta?.counts ?? null,
    },
    params: {
      topN: params.topN,
      riskMode: params.riskMode,
      radiusMeters: params.radiusMeters,
      shuffle: params.shuffle,
      seed: params.seed,
      strategy: params.strategy,
      hhmm: params.hhmm,
      requiredSegmentIds: params.requiredSegmentIds ?? [],
    },
    rows: summarizeRows(params.rows),
    review: {
      statusColumn: 'reviewStatus',
      validStatuses: VALID_QA_REVIEW_STATUSES,
      summaryCommand: buildReviewCommand(
        'summary',
        csvPath,
        params.districtId,
        configRoot,
      ),
      gateCommand: buildReviewCommand('gate', csvPath, params.districtId, configRoot),
    },
  }
}

export const writeQaCandidateManifest = async (params: {
  districtId: string
  all: boolean
  csvOutPath: string
  manifestOutPath: string | null
  manifest: QaCandidateManifest
}) => {
  const outPath = resolveQaManifestOutPath({
    districtId: params.districtId,
    all: params.all,
    csvOutPath: params.csvOutPath,
    manifestOutPath: params.manifestOutPath,
  })
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, `${JSON.stringify(params.manifest, null, 2)}\n`, 'utf-8')
  return outPath
}
