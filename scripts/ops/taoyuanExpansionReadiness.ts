import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import { parseRuntimeCoverageCatalog } from '../../src/data/coverageCatalog'
import { parsePaidCurbReferencePack } from '../../src/data/paidCurbReference'
import { EPSG_4326 } from '../ingest/ingestCrs'
import { readDataset } from '../ingest/ingestDatasetRead'
import {
  type CsvRow,
  type ReviewManifest,
  sha256TaoyuanReviewCsv,
  validateTaoyuanPaidCurbReview,
} from './validateTaoyuanPaidCurbReview'
import { validateTaoyuanBoundaryCollection } from './validateTaoyuanBoundaries'

const DEFAULT_DISTRICT = 'taoyuan-district'
const DEFAULT_BOUNDARY =
  'data/sources/taoyuan/town_boundaries/town_boundaries.shp'
const DEFAULT_REFERENCE = 'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_REVIEW =
  'review-evidence/taoyuan/taoyuan-district-paid-curb-review.csv'
const DEFAULT_REVIEW_MANIFEST =
  'review-evidence/taoyuan/taoyuan-district-paid-curb-review.manifest.json'
const DEFAULT_SPATIAL = 'data/sources/taoyuan/paid_curb_segments.geojson'

type ReadinessStatus =
  | 'automation-error'
  | 'human-and-external-input-required'
  | 'human-review-required'
  | 'external-input-required'
  | 'spatial-acquisition-ready'
  | 'spatial-reference-ready'

type SpatialAcquisition =
  | 'available'
  | 'saved-input'
  | 'credentials'
  | 'guest'
  | 'blocked'

export interface TaoyuanExpansionReadinessOptions {
  districtId?: string
  boundaryPath?: string
  boundaryCatalogPath?: string | null
  referencePath?: string
  reviewPath?: string
  reviewManifestPath?: string
  requirePinnedReview?: boolean
  spatialPath?: string
  tdxInputPath?: string | null
  requireReady?: boolean
  requireSpatial?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
  json?: boolean
  env?: NodeJS.ProcessEnv
}

interface BoundarySummary {
  path: string
  source: 'official-dataset' | 'runtime-coverage-catalog'
  valid: boolean
  districtCount: number
  errors: string[]
}

interface ReferenceSummary {
  path: string
  valid: boolean
  sourceRecordCount: number | null
  districtRecordCount: number | null
  errors: string[]
}

interface SourceTextReviewSummary {
  path: string
  manifestPath: string
  exists: boolean
  structureValid: boolean
  complete: boolean
  approved: boolean
  pendingRows: number | null
  expectedRows: number | null
  actualRows: number | null
  errors: string[]
}

interface SpatialSummary {
  path: string
  exists: boolean
  valid: boolean
  acquisition: SpatialAcquisition
  credentialsConfigured: boolean
  savedInputPath: string | null
  featureCount: number
  segmentGeometryCount: number
  representativePointCount: number
  errors: string[]
}

export interface TaoyuanExpansionReadinessResult {
  status: ReadinessStatus
  gatePass: boolean
  requireReady: boolean
  requireSpatial: boolean
  readyForSpatialReference: boolean
  legalAnswerEligible: false
  boundary: BoundarySummary
  reference: ReferenceSummary
  sourceTextReview: SourceTextReviewSummary
  spatial: SpatialSummary
  automationErrors: string[]
  blockers: string[]
  nextActions: string[]
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parseTaoyuanExpansionReadinessArgs = (
  argv: string[],
): TaoyuanExpansionReadinessOptions => {
  const reviewPath = getArgValue(argv, '--review')
  const reviewManifestPath = getArgValue(
    argv,
    '--review-manifest',
    '--reviewManifest',
  )
  return {
    districtId: getArgValue(argv, '--district') ?? DEFAULT_DISTRICT,
    boundaryPath: getArgValue(argv, '--boundary') ?? DEFAULT_BOUNDARY,
    boundaryCatalogPath: getArgValue(
      argv,
      '--boundary-catalog',
      '--boundaryCatalog',
    ),
    referencePath: getArgValue(argv, '--reference') ?? DEFAULT_REFERENCE,
    reviewPath: reviewPath ?? DEFAULT_REVIEW,
    reviewManifestPath: reviewManifestPath ?? DEFAULT_REVIEW_MANIFEST,
    requirePinnedReview: reviewPath === null && reviewManifestPath === null,
    spatialPath: getArgValue(argv, '--spatial') ?? DEFAULT_SPATIAL,
    tdxInputPath: getArgValue(argv, '--tdx-input', '--tdxInput'),
    requireReady: hasFlag(argv, '--require-ready', '--requireReady'),
    requireSpatial: hasFlag(argv, '--require-spatial', '--requireSpatial'),
    outPath: getArgValue(argv, '--out'),
    jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut'),
    json: hasFlag(argv, '--json'),
  }
}

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const readJson = async <T>(targetPath: string): Promise<T> =>
  JSON.parse(await fs.readFile(targetPath, 'utf-8')) as T

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const isCoordinate = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  Math.abs(value[0]) <= 180 &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]) &&
  Math.abs(value[1]) <= 90

const isLine = (value: unknown) =>
  Array.isArray(value) && value.length >= 2 && value.every(isCoordinate)

const hasValidSpatialCoordinates = (
  geometryType: unknown,
  coordinates: unknown,
) => {
  if (geometryType === 'Point') {
    return isCoordinate(coordinates)
  }
  if (geometryType === 'LineString') {
    return isLine(coordinates)
  }
  return (
    geometryType === 'MultiLineString' &&
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every(isLine)
  )
}

export const validateTaoyuanSpatialReference = (value: unknown) => {
  const root = toRecord(value)
  const metadata = toRecord(root.metadata)
  const features = Array.isArray(root.features) ? root.features : []
  const errors: string[] = []
  const parkingSegmentIds = new Set<string>()
  let segmentGeometryCount = 0
  let representativePointCount = 0

  if (root.type !== 'FeatureCollection') {
    errors.push('Spatial reference type must be FeatureCollection.')
  }
  if (metadata.sourceDataset !== 'TDX OnStreet ParkingSegment v1') {
    errors.push('Spatial reference metadata sourceDataset is invalid.')
  }
  if (metadata.legalAnswerEligible !== false) {
    errors.push('Spatial reference metadata must keep legalAnswerEligible false.')
  }
  if (features.length === 0) {
    errors.push('Spatial reference has no georeferenced features.')
  }

  features.forEach((value, index) => {
    const feature = toRecord(value)
    const geometry = toRecord(feature.geometry)
    const properties = toRecord(feature.properties)
    if (
      feature.type !== 'Feature' ||
      !hasValidSpatialCoordinates(geometry.type, geometry.coordinates)
    ) {
      errors.push(`Spatial feature ${index + 1} has invalid geometry.`)
    }
    if (properties.evidenceKind !== 'PAID_CURB_SEGMENT') {
      errors.push(`Spatial feature ${index + 1} has invalid evidenceKind.`)
    }
    if (properties.sourceDataset !== 'TDX OnStreet ParkingSegment v1') {
      errors.push(`Spatial feature ${index + 1} has invalid sourceDataset.`)
    }
    if (
      typeof properties.parkingSegmentId !== 'string' ||
      properties.parkingSegmentId.trim().length === 0
    ) {
      errors.push(`Spatial feature ${index + 1} has no parkingSegmentId.`)
    } else if (parkingSegmentIds.has(properties.parkingSegmentId.trim())) {
      errors.push(`Spatial feature ${index + 1} has a duplicate parkingSegmentId.`)
    } else {
      parkingSegmentIds.add(properties.parkingSegmentId.trim())
    }
    if (properties.legalAnswerEligible !== false) {
      errors.push(
        `Spatial feature ${index + 1} must keep legalAnswerEligible false.`,
    )
    }
    if (properties.geometryPrecision === 'SEGMENT_GEOMETRY') {
      segmentGeometryCount += 1
      if (
        geometry.type !== 'LineString' &&
        geometry.type !== 'MultiLineString'
      ) {
        errors.push(
          `Spatial feature ${index + 1} segment geometry must be a line.`,
        )
      }
    } else if (properties.geometryPrecision === 'REPRESENTATIVE_POINT') {
      representativePointCount += 1
      if (geometry.type !== 'Point') {
        errors.push(
          `Spatial feature ${index + 1} representative geometry must be a point.`,
        )
      }
    } else {
      errors.push(`Spatial feature ${index + 1} has invalid geometryPrecision.`)
    }
  })

  if (
    !Number.isSafeInteger(metadata.sourceRecordCount) ||
    Number(metadata.sourceRecordCount) < features.length
  ) {
    errors.push(
      'Spatial reference metadata sourceRecordCount is missing or invalid.',
    )
  }
  if (!Number.isSafeInteger(metadata.featureCount)) {
    errors.push('Spatial reference metadata featureCount is missing or invalid.')
  } else if (metadata.featureCount !== features.length) {
    errors.push('Spatial reference metadata featureCount does not match features.')
  }

  return {
    valid: errors.length === 0,
    featureCount: features.length,
    segmentGeometryCount,
    representativePointCount,
    errors,
  }
}

const quoteArg = (value: string) => `"${value.replace(/"/g, '\\"')}"`

export const runTaoyuanExpansionReadiness = async (
  options: TaoyuanExpansionReadinessOptions = {},
): Promise<TaoyuanExpansionReadinessResult> => {
  const districtId = options.districtId ?? DEFAULT_DISTRICT
  const boundaryPath = path.resolve(options.boundaryPath ?? DEFAULT_BOUNDARY)
  const boundaryCatalogPath = options.boundaryCatalogPath
    ? path.resolve(options.boundaryCatalogPath)
    : null
  const referencePath = path.resolve(options.referencePath ?? DEFAULT_REFERENCE)
  const reviewPath = path.resolve(options.reviewPath ?? DEFAULT_REVIEW)
  const reviewManifestPath = path.resolve(
    options.reviewManifestPath ?? DEFAULT_REVIEW_MANIFEST,
  )
  const spatialPath = path.resolve(options.spatialPath ?? DEFAULT_SPATIAL)
  const savedInputPath = options.tdxInputPath
    ? path.resolve(options.tdxInputPath)
    : null
  const env = options.env ?? process.env
  const requirePinnedReview =
    options.requirePinnedReview ??
    (options.reviewPath === undefined &&
      options.reviewManifestPath === undefined)
  const credentialsConfigured = Boolean(
    env.TDX_ACCESS_TOKEN?.trim() ||
      (env.TDX_CLIENT_ID?.trim() && env.TDX_CLIENT_SECRET?.trim()),
  )
  const guestAcquisitionEnabled = !['0', 'false', 'no', 'off'].includes(
    env.TDX_ALLOW_GUEST?.trim().toLowerCase() ?? '',
  )
  const automationErrors: string[] = []
  const blockers: string[] = []
  const nextActions: string[] = []

  const boundary: BoundarySummary = {
    path: boundaryCatalogPath ?? boundaryPath,
    source: boundaryCatalogPath
      ? 'runtime-coverage-catalog'
      : 'official-dataset',
    valid: false,
    districtCount: 0,
    errors: [],
  }
  try {
    const catalog = boundaryCatalogPath
      ? parseRuntimeCoverageCatalog(await readJson(boundaryCatalogPath))
      : null
    const catalogDistricts =
      catalog?.districts.filter(({ regionId }) => regionId === 'taoyuan') ?? []
    const collection = catalog
      ? {
          type: 'FeatureCollection' as const,
          features: catalogDistricts.map((district) => ({
            type: 'Feature' as const,
            properties: {
              COUNTYCODE: '68000',
              TOWNCODE: district.boundaryFeatureId,
              TOWNID: district.districtId,
              TOWNENG: district.districtName,
            },
            geometry: district.boundaryGeometry,
          })),
        }
      : await readDataset(boundaryPath, EPSG_4326)
    const result = validateTaoyuanBoundaryCollection(collection)
    boundary.errors.push(...result.errors)
    catalogDistricts.forEach((district) => {
      if (
        district.publishStage !== 'source-only' ||
        district.answerCapability !== 'paid-curb-reference-only' ||
        district.requiresHumanReview !== true
      ) {
        boundary.errors.push(
          `${district.districtId}: runtime boundary must remain source-only, paid-curb-reference-only, and require human review.`,
        )
      }
    })
    boundary.valid = boundary.errors.length === 0
    boundary.districtCount = result.rows.length
  } catch (error) {
    boundary.errors.push(error instanceof Error ? error.message : String(error))
  }
  automationErrors.push(
    ...boundary.errors.map((error) => `Boundary: ${error}`),
  )

  let referencePack: ReturnType<typeof parsePaidCurbReferencePack> | null = null
  const reference: ReferenceSummary = {
    path: referencePath,
    valid: false,
    sourceRecordCount: null,
    districtRecordCount: null,
    errors: [],
  }
  try {
    referencePack = parsePaidCurbReferencePack(await readJson(referencePath))
    const district = referencePack.districts.find(
      (candidate) => candidate.districtId === districtId,
    )
    if (!district) {
      throw new Error(`Reference pack is missing district ${districtId}.`)
    }
    reference.valid = true
    reference.sourceRecordCount = referencePack.source.recordCount
    reference.districtRecordCount = district.recordCount
  } catch (error) {
    reference.errors.push(error instanceof Error ? error.message : String(error))
  }
  automationErrors.push(
    ...reference.errors.map((error) => `Reference: ${error}`),
  )

  const reviewExists =
    (await fileExists(reviewPath)) && (await fileExists(reviewManifestPath))
  const sourceTextReview: SourceTextReviewSummary = {
    path: reviewPath,
    manifestPath: reviewManifestPath,
    exists: reviewExists,
    structureValid: false,
    complete: false,
    approved: false,
    pendingRows: null,
    expectedRows: reference.districtRecordCount,
    actualRows: null,
    errors: [],
  }
  if (!reviewExists) {
    blockers.push('Promoted Taoyuan source-text review evidence is missing.')
    nextActions.push('npm run ops:build-taoyuan-reference')
    nextActions.push('npm run ops:promote-taoyuan-review')
  } else if (referencePack) {
    try {
      const reviewBuffer = await fs.readFile(reviewPath)
      const rows = parseCsv(reviewBuffer, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
      }) as CsvRow[]
      const result = validateTaoyuanPaidCurbReview({
        pack: referencePack,
        manifest: await readJson<ReviewManifest>(reviewManifestPath),
        rows,
        districtId,
        reviewSha256: sha256TaoyuanReviewCsv(reviewBuffer),
        requirePinnedReview,
      })
      sourceTextReview.structureValid = result.structureValid
      sourceTextReview.complete = result.complete
      sourceTextReview.approved = result.approved
      sourceTextReview.pendingRows = result.statusCounts.PENDING
      sourceTextReview.expectedRows = result.expectedRows
      sourceTextReview.actualRows = result.actualRows
      sourceTextReview.errors.push(...result.errors)
    } catch (error) {
      sourceTextReview.errors.push(
        error instanceof Error ? error.message : String(error),
      )
    }
    automationErrors.push(
      ...sourceTextReview.errors.map((error) => `Source-text review: ${error}`),
    )
    if (sourceTextReview.structureValid && !sourceTextReview.approved) {
      blockers.push(
        `${sourceTextReview.pendingRows ?? 'Unknown'} source-text review rows remain pending or unresolved.`,
      )
      nextActions.push('npm run ops:taoyuan-review-status')
      nextActions.push('npm run ops:taoyuan-review-gate')
    }
  }

  const spatialExists = await fileExists(spatialPath)
  const savedInputExists = savedInputPath
    ? await fileExists(savedInputPath)
    : false
  const acquisition: SpatialAcquisition = spatialExists
    ? 'available'
    : savedInputExists
      ? 'saved-input'
      : credentialsConfigured
        ? 'credentials'
        : guestAcquisitionEnabled
          ? 'guest'
          : 'blocked'
  const spatial: SpatialSummary = {
    path: spatialPath,
    exists: spatialExists,
    valid: false,
    acquisition,
    credentialsConfigured,
    savedInputPath,
    featureCount: 0,
    segmentGeometryCount: 0,
    representativePointCount: 0,
    errors: [],
  }
  if (spatialExists) {
    try {
      const result = validateTaoyuanSpatialReference(await readJson(spatialPath))
      spatial.valid = result.valid
      spatial.featureCount = result.featureCount
      spatial.segmentGeometryCount = result.segmentGeometryCount
      spatial.representativePointCount = result.representativePointCount
      spatial.errors.push(...result.errors)
    } catch (error) {
      spatial.errors.push(error instanceof Error ? error.message : String(error))
    }
    automationErrors.push(
      ...spatial.errors.map((error) => `Spatial reference: ${error}`),
    )
  } else {
    blockers.push('TDX paid-curb spatial reference has not been acquired.')
    if (savedInputExists && savedInputPath) {
      nextActions.push(
        `npm run ops:fetch-taoyuan-paid-curb -- --input ${quoteArg(savedInputPath)}`,
      )
    } else if (credentialsConfigured || guestAcquisitionEnabled) {
      nextActions.push('npm run ops:fetch-taoyuan-paid-curb')
    } else {
      nextActions.push(
        'Set TDX_CLIENT_ID and TDX_CLIENT_SECRET, or provide --tdx-input with a saved official TDX response.',
      )
    }
  }

  const readyForSpatialReference =
    boundary.valid &&
    reference.valid &&
    sourceTextReview.approved &&
    spatial.valid
  const needsHumanReview = !sourceTextReview.approved
  const needsExternalInput =
    !spatial.exists && spatial.acquisition === 'blocked'
  const canAcquireSpatial =
    !spatial.exists && spatial.acquisition !== 'blocked'
  const status: ReadinessStatus =
    automationErrors.length > 0
      ? 'automation-error'
      : readyForSpatialReference
        ? 'spatial-reference-ready'
        : needsHumanReview && needsExternalInput
          ? 'human-and-external-input-required'
          : needsHumanReview
            ? 'human-review-required'
            : needsExternalInput
              ? 'external-input-required'
              : canAcquireSpatial
                ? 'spatial-acquisition-ready'
                : 'external-input-required'
  const gatePass =
    automationErrors.length === 0 &&
    (!options.requireReady || readyForSpatialReference) &&
    (!options.requireSpatial || spatial.valid)

  return {
    status,
    gatePass,
    requireReady: Boolean(options.requireReady),
    requireSpatial: Boolean(options.requireSpatial),
    readyForSpatialReference,
    legalAnswerEligible: false,
    boundary,
    reference,
    sourceTextReview,
    spatial,
    automationErrors,
    blockers,
    nextActions: [...new Set(nextActions)],
  }
}

const yesNo = (value: boolean) => (value ? 'yes' : 'no')

export const renderTaoyuanExpansionReadiness = (
  result: TaoyuanExpansionReadinessResult,
) => [
  '# Taoyuan expansion readiness',
  '',
  `- Status: ${result.status}`,
  `- Command gate: ${result.gatePass ? 'PASS' : 'FAIL'}`,
  `- Strict ready required: ${yesNo(result.requireReady)}`,
  `- Spatial reference required: ${yesNo(result.requireSpatial)}`,
  `- Ready for spatial reference: ${yesNo(result.readyForSpatialReference)}`,
  `- Eligible for legal parking answers: ${yesNo(result.legalAnswerEligible)}`,
  '',
  '## Evidence layers',
  '',
  `- Boundary: ${result.boundary.valid ? 'valid' : 'invalid'}; source=${result.boundary.source}; districts=${result.boundary.districtCount}; ${result.boundary.path}`,
  `- Text reference: ${result.reference.valid ? 'valid' : 'invalid'}; source rows=${result.reference.sourceRecordCount ?? '-'}; district rows=${result.reference.districtRecordCount ?? '-'}; ${result.reference.path}`,
  `- Source-text review: ${result.sourceTextReview.approved ? 'approved' : result.sourceTextReview.structureValid ? 'pending' : result.sourceTextReview.exists ? 'invalid' : 'missing'}; rows=${result.sourceTextReview.actualRows ?? '-'}/${result.sourceTextReview.expectedRows ?? '-'}; pending=${result.sourceTextReview.pendingRows ?? '-'}; ${result.sourceTextReview.path}`,
  `- TDX spatial reference: ${result.spatial.valid ? 'valid' : result.spatial.exists ? 'invalid' : 'missing'}; acquisition=${result.spatial.acquisition}; features=${result.spatial.featureCount}; segment geometries=${result.spatial.segmentGeometryCount}; representative points=${result.spatial.representativePointCount}; ${result.spatial.path}`,
  '- Safety: paid-curb text and geometry remain reference-only; legalAnswerEligible is always false.',
  ...(result.blockers.length > 0
    ? ['', '## Blockers', '', ...result.blockers.map((blocker) => `- ${blocker}`)]
    : []),
  ...(result.automationErrors.length > 0
    ? [
        '',
        '## Automation errors',
        '',
        ...result.automationErrors.map((error) => `- ${error}`),
      ]
    : []),
  ...(result.nextActions.length > 0
    ? [
        '',
        '## Next actions',
        '',
        ...result.nextActions.map((action) => `- ${action}`),
      ]
    : []),
  '',
].join('\n')

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseTaoyuanExpansionReadinessArgs(process.argv)
  const result = await runTaoyuanExpansionReadiness(options)
  const markdown = renderTaoyuanExpansionReadiness(result)
  console.log(options.json ? JSON.stringify(result, null, 2) : markdown)
  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(
      path.resolve(options.jsonOutPath),
      `${JSON.stringify(result, null, 2)}\n`,
    )
  }
  if (!result.gatePass) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
