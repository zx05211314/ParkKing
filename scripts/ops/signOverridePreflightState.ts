import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Feature, FeatureCollection, LineString, MultiLineString } from 'geojson'
import {
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
} from '../../src/data/segmentBuilder'
import type { Segment } from '../../src/ui/types'
import { selectBoundaryFeature } from '../ingest/ingestBoundarySelection'
import { resolveOverrideReportsPath } from '../ingest/overrideReportsPath'
import { readConfig, type ResolvedConfig } from '../ingest/readConfig'
import { filterToBoundary, readDataset } from '../ingest/utils'
import { sanitizeSegmentReport } from './exportOverrideNormalization'
import { selectLatestReports } from './exportOverrideSelection'
import { parseReportInputFile } from './exportOverrideStore'
import { isValidReviewTimestamp } from './reviewTimestamp'
import type {
  SignOverrideInvalidReportIssue,
  SignOverridePreflightIssue,
  SignOverridePreflightResult,
} from './signOverridePreflightTypes'

const emptyStatusCounts = () => ({
  LEGAL: 0,
  ILLEGAL: 0,
  UNCLEAR: 0,
})

const isMissingFileError = (error: unknown) =>
  error instanceof Error && (error as { code?: unknown }).code === 'ENOENT'

type SegmentBuilder = (
  feature: Feature<LineString | MultiLineString>,
  index: number,
  meta: null,
) => Segment[]

const collectSegmentIds = (
  collection: FeatureCollection<LineString | MultiLineString>,
  buildSegments: SegmentBuilder = buildSegmentsFromFeature,
) => {
  const segmentIds = new Set<string>()

  collection.features.forEach((feature, index) => {
    if (!feature.geometry) {
      return
    }
    const built = buildSegments(
      feature as Feature<LineString | MultiLineString>,
      index,
      null,
    )
    built.forEach((segment) => {
      segmentIds.add(segment.id)
    })
  })

  return segmentIds
}

const addSegmentIds = (target: Set<string>, ids: Iterable<string>) => {
  Array.from(ids).forEach((id) => target.add(id))
}

const readGeneratedCollection = async (
  config: ResolvedConfig,
  fileName: string,
) => {
  const generatedPath = path.resolve(config.outputs.generatedDir, fileName)
  try {
    const raw = await fs.readFile(generatedPath, 'utf-8')
    return JSON.parse(raw) as FeatureCollection<LineString | MultiLineString>
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }
    throw error
  }
}

const addConfiguredInferredSegmentIds = async (
  config: ResolvedConfig,
  segmentIds: Set<string>,
) => {
  const generatedInferred = await readGeneratedCollection(config, 'candidates_inferred.geojson')
  if (generatedInferred) {
    addSegmentIds(
      segmentIds,
      collectSegmentIds(generatedInferred, buildInferredSegmentsFromFeature),
    )
    return
  }

  if (!config.inputs.candidates_inferred) {
    return
  }

  const boundaryCollection = await readDataset(config.inputs.districtBounds, config.crs.default)
  const boundary = selectBoundaryFeature(boundaryCollection, config)
  if (!boundary) {
    throw new Error(`Boundary not found for ${config.districtId}. Configure boundary selection.`)
  }

  const rawInferred = await readDataset(config.inputs.candidates_inferred, config.crs.default)
  const filteredInferred = filterToBoundary(rawInferred, boundary)
  addSegmentIds(
    segmentIds,
    collectSegmentIds(
      filteredInferred as FeatureCollection<LineString | MultiLineString>,
      buildInferredSegmentsFromFeature,
    ),
  )
}

const buildConfiguredSegmentIdSet = async (config: ResolvedConfig) => {
  const generatedRedYellow = await readGeneratedCollection(config, 'red_yellow.geojson')
  const segmentIds = new Set<string>()
  if (generatedRedYellow) {
    addSegmentIds(segmentIds, collectSegmentIds(generatedRedYellow))
    await addConfiguredInferredSegmentIds(config, segmentIds)
    return segmentIds
  }

  const boundaryCollection = await readDataset(config.inputs.districtBounds, config.crs.default)
  const boundary = selectBoundaryFeature(boundaryCollection, config)
  if (!boundary) {
    throw new Error(`Boundary not found for ${config.districtId}. Configure boundary selection.`)
  }

  const rawSegments = await readDataset(config.inputs.redYellow, config.crs.default)
  const filteredSegments = filterToBoundary(rawSegments, boundary)
  addSegmentIds(
    segmentIds,
    collectSegmentIds(
      filteredSegments as FeatureCollection<LineString | MultiLineString>,
    ),
  )
  await addConfiguredInferredSegmentIds(config, segmentIds)
  return segmentIds
}

const sortStrings = (values: Iterable<string>) => Array.from(values).sort((a, b) => a.localeCompare(b))

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeStatus = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : ''

const hasCreatedAt = (value: unknown) =>
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'number' && Number.isFinite(value))

const hasValidCreatedAt = (value: unknown) =>
  (typeof value === 'string' && isValidReviewTimestamp(value)) ||
  (typeof value === 'number' && Number.isFinite(value))

const buildInvalidReportIssues = (
  reports: Array<Record<string, unknown>>,
): SignOverrideInvalidReportIssue[] =>
  reports
    .map((report, index) => {
      const districtId = normalizeText(report.districtId)
      const segmentId = normalizeText(report.segmentId)
      const status = normalizeStatus(report.status)
      const reasons: string[] = []

      if (!districtId) {
        reasons.push('districtId is required')
      }
      if (!segmentId) {
        reasons.push('segmentId is required')
      }
      if (!status || !['LEGAL', 'ILLEGAL', 'UNCLEAR'].includes(status)) {
        reasons.push('reviewStatus must be LEGAL, ILLEGAL, or UNCLEAR')
      }
      if (!normalizeText(report.note)) {
        reasons.push('reviewNote is required')
      }
      if (!hasCreatedAt(report.createdAt)) {
        reasons.push('createdAt is required')
      } else if (!hasValidCreatedAt(report.createdAt)) {
        reasons.push('createdAt must be an ISO timestamp with timezone')
      }

      return reasons.length > 0
        ? {
            reportNumber: index + 1,
            districtId: districtId || null,
            segmentId: segmentId || null,
            status: status || null,
            reasons,
          }
        : null
    })
    .filter((issue): issue is SignOverrideInvalidReportIssue => issue !== null)

const readOverrideReports = async (inputPath: string) => {
  try {
    return {
      inputExists: true,
      inputWarning: null,
      rawReports: await parseReportInputFile(inputPath),
    }
  } catch (error) {
    if (
      isMissingFileError(error)
    ) {
      return {
        inputExists: false,
        inputWarning: `Override input not found: ${inputPath}`,
        rawReports: [],
      }
    }
    throw error
  }
}

export const buildSignOverridePreflight = async (
  configPath: string,
  inputOverridePath?: string | null,
): Promise<SignOverridePreflightResult> => {
  const config = await readConfig(['node', 'sign-override-preflight', '--config', configPath])
  const inputPath = inputOverridePath
    ? path.resolve(inputOverridePath)
    : resolveOverrideReportsPath(config.districtId)

  const { inputExists, inputWarning, rawReports } = await readOverrideReports(inputPath)
  const invalidReportIssues = buildInvalidReportIssues(
    rawReports as Array<Record<string, unknown>>,
  )
  const sanitized = rawReports
    .map((report) => sanitizeSegmentReport(report))
    .filter((report): report is NonNullable<typeof report> => Boolean(report))

  const districtReports = sanitized.filter((report) => report.districtId === config.districtId)
  const effectiveReports = selectLatestReports(districtReports)
  const segmentIds = await buildConfiguredSegmentIdSet(config)

  const statusCounts = emptyStatusCounts()
  const missingSegmentIdSet = new Set<string>()
  const duplicateSegmentIdSet = new Set<string>()
  const missingIssues: SignOverridePreflightIssue[] = []
  const seenSegments = new Map<string, number>()

  districtReports.forEach((report) => {
    seenSegments.set(report.segmentId, (seenSegments.get(report.segmentId) ?? 0) + 1)
  })
  seenSegments.forEach((count, segmentId) => {
    if (count > 1) {
      duplicateSegmentIdSet.add(segmentId)
    }
  })

  effectiveReports.forEach((report) => {
    statusCounts[report.status] += 1
    if (!segmentIds.has(report.segmentId)) {
      missingSegmentIdSet.add(report.segmentId)
      missingIssues.push({
        segmentId: report.segmentId,
        status: report.status,
        createdAt: report.createdAt,
        note: report.note ?? null,
      })
    }
  })

  const missingSegmentIds = sortStrings(missingSegmentIdSet)
  const duplicateSegmentIds = sortStrings(duplicateSegmentIdSet)
  const matchedSegmentOverrides = effectiveReports.length - missingSegmentIds.length

  return {
    districtId: config.districtId,
    districtName: config.districtName,
    configPath: path.resolve(config.configPath),
    inputPath,
    inputExists,
    inputWarning,
    knownSegments: segmentIds.size,
    rawReports: rawReports.length,
    validReports: sanitized.length,
    skippedInvalidReports: rawReports.length - sanitized.length,
    skippedForeignDistrictReports: sanitized.length - districtReports.length,
    effectiveOverrides: effectiveReports.length,
    duplicateSegmentsCollapsed: districtReports.length - effectiveReports.length,
    matchedSegmentOverrides,
    missingSegmentOverrides: missingSegmentIds.length,
    statusCounts,
    missingSegmentIds,
    duplicateSegmentIds,
    missingIssues,
    invalidReportIssues,
  }
}
