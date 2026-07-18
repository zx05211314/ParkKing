import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import type { Feature, Point } from 'geojson'
import {
  findCoverageDistrictById,
  isLocationInCoverageDistrict,
  parseRuntimeCoverageCatalog,
} from '../../src/data/coverageCatalog'
import { parsePaidCurbReferencePack } from '../../src/data/paidCurbReference'
import {
  parsePaidCurbSpatialReferencePack,
  type PaidCurbSpatialReferencePack,
  type PaidCurbSpatialReferenceProperties,
} from '../../src/data/paidCurbSpatialReference'
import { validateTaoyuanSpatialReference } from './taoyuanExpansionReadiness'
import {
  type CsvRow,
  type ReviewManifest,
  sha256TaoyuanReviewCsv,
  validateTaoyuanPaidCurbReview,
} from './validateTaoyuanPaidCurbReview'

const DEFAULT_DISTRICT = 'taoyuan-district'
const DEFAULT_INPUT =
  '.tmp/taoyuan-spatial-reference/paid_curb_segments.geojson'
const DEFAULT_REFERENCE = 'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_REVIEW =
  'review-evidence/taoyuan/taoyuan-district-paid-curb-review.csv'
const DEFAULT_REVIEW_MANIFEST =
  'review-evidence/taoyuan/taoyuan-district-paid-curb-review.manifest.json'
const DEFAULT_COVERAGE = 'public/data/coverage.json'
const DEFAULT_OUTPUT =
  'public/data/reference/taoyuan-district-paid-curb-points.geojson'
const DEFAULT_RECEIPT = '.tmp/taoyuan-spatial-reference-promotion.json'

interface SourceSpatialFeature {
  type: 'Feature'
  geometry: Point
  properties: {
    evidenceKind: 'PAID_CURB_SEGMENT'
    parkingSegmentId: string
    description: string
    fareDescription: string | null
    hasChargingPoint: boolean
    geometryPrecision: 'REPRESENTATIVE_POINT'
    legalAnswerEligible: false
    sourceDataset: 'TDX OnStreet ParkingSegment v1'
  }
}

export interface PromoteTaoyuanSpatialReferenceOptions {
  districtId?: string
  inputPath?: string | null
  referencePath?: string | null
  reviewPath?: string | null
  reviewManifestPath?: string | null
  coveragePath?: string | null
  outputPath?: string | null
  receiptPath?: string | null
  expectedPath?: string | null
  now?: Date
}

const sha256 = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const portablePath = (targetPath: string) => {
  const relative = path.relative(process.cwd(), targetPath)
  return (relative || '.').replace(/\\/g, '/')
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const readJson = async <T>(targetPath: string): Promise<T> =>
  JSON.parse(await fs.readFile(targetPath, 'utf-8')) as T

const replaceFileAtomically = async (targetPath: string, buffer: Buffer) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.tmp-${suffix}`,
  )
  const backupPath = `${targetPath}.bak-${suffix}`
  let backedUp = false
  await fs.writeFile(temporaryPath, buffer)
  try {
    try {
      await fs.rename(targetPath, backupPath)
      backedUp = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    await fs.rename(temporaryPath, targetPath)
    if (backedUp) {
      await fs.rm(backupPath, { force: true })
    }
  } catch (error) {
    await fs.rm(temporaryPath, { force: true })
    if (backedUp) {
      await fs.rename(backupPath, targetPath)
    }
    throw error
  }
}

const parseSourceFeatures = (value: unknown): SourceSpatialFeature[] => {
  const validation = validateTaoyuanSpatialReference(value)
  if (!validation.valid) {
    throw new Error(
      `Taoyuan source spatial artifact failed validation:\n${validation.errors
        .map((error) => `- ${error}`)
        .join('\n')}`,
    )
  }
  const collection = value as {
    features: Array<{
      type: string
      geometry: { type: string; coordinates: unknown }
      properties: Record<string, unknown>
    }>
  }
  const invalid = collection.features.find(
    (feature) =>
      feature.type !== 'Feature' ||
      feature.geometry.type !== 'Point' ||
      feature.properties.geometryPrecision !== 'REPRESENTATIVE_POINT',
  )
  if (invalid) {
    throw new Error(
      'Taoyuan public spatial reference requires representative Point features.',
    )
  }
  return collection.features as SourceSpatialFeature[]
}

const assertExactIdSet = (
  actualIds: ReadonlySet<string>,
  expectedIds: ReadonlySet<string>,
) => {
  const missing = [...expectedIds].filter((id) => !actualIds.has(id))
  const unknown = [...actualIds].filter((id) => !expectedIds.has(id))
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `Taoyuan source/text ID mismatch: missing=${missing.length}, unknown=${unknown.length}.`,
    )
  }
}

const matchesExpectedRuntimePack = (
  expectedBuffer: Buffer,
  actualPack: PaidCurbSpatialReferencePack,
) => {
  const expectedPack = parsePaidCurbSpatialReferencePack(
    JSON.parse(expectedBuffer.toString('utf-8')) as unknown,
  )
  const comparableActualPack: PaidCurbSpatialReferencePack = {
    ...actualPack,
    metadata: {
      ...actualPack.metadata,
      sourceSha256: expectedPack.metadata.sourceSha256,
    },
  }
  return JSON.stringify(expectedPack) === JSON.stringify(comparableActualPack)
}

export const promoteTaoyuanSpatialReference = async (
  options: PromoteTaoyuanSpatialReferenceOptions = {},
) => {
  const districtId = options.districtId ?? DEFAULT_DISTRICT
  const inputPath = path.resolve(options.inputPath ?? DEFAULT_INPUT)
  const referencePath = path.resolve(
    options.referencePath ?? DEFAULT_REFERENCE,
  )
  const reviewPath = path.resolve(options.reviewPath ?? DEFAULT_REVIEW)
  const reviewManifestPath = path.resolve(
    options.reviewManifestPath ?? DEFAULT_REVIEW_MANIFEST,
  )
  const coveragePath = path.resolve(options.coveragePath ?? DEFAULT_COVERAGE)
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_OUTPUT)
  const receiptPath = path.resolve(options.receiptPath ?? DEFAULT_RECEIPT)
  const expectedPath = options.expectedPath
    ? path.resolve(options.expectedPath)
    : null

  const [
    sourceBuffer,
    referencePack,
    reviewBuffer,
    reviewManifest,
    coverageCatalog,
  ] = await Promise.all([
    fs.readFile(inputPath),
    readJson<unknown>(referencePath).then(parsePaidCurbReferencePack),
    fs.readFile(reviewPath),
    readJson<ReviewManifest>(reviewManifestPath),
    readJson<unknown>(coveragePath).then(parseRuntimeCoverageCatalog),
  ])
  const sourceValue = JSON.parse(sourceBuffer.toString('utf-8')) as unknown
  const sourceFeatures = parseSourceFeatures(sourceValue)
  const sourceFeaturesById = new Map(
    sourceFeatures.map((feature) => [
      feature.properties.parkingSegmentId,
      feature,
    ]),
  )
  if (sourceFeaturesById.size !== sourceFeatures.length) {
    throw new Error('Taoyuan source spatial artifact contains duplicate IDs.')
  }
  const allTextIds = new Set(
    referencePack.districts.flatMap(({ records }) =>
      records.map(({ parkingSegmentId }) => parkingSegmentId),
    ),
  )
  assertExactIdSet(new Set(sourceFeaturesById.keys()), allTextIds)

  const district = referencePack.districts.find(
    (candidate) => candidate.districtId === districtId,
  )
  const coverageDistrict = findCoverageDistrictById(coverageCatalog, districtId)
  if (!district || !coverageDistrict) {
    throw new Error(`Taoyuan spatial promotion is missing district ${districtId}.`)
  }
  if (
    coverageDistrict.publishStage !== 'source-only' ||
    coverageDistrict.answerCapability !== 'paid-curb-reference-only'
  ) {
    throw new Error('Taoyuan spatial promotion requires source-only coverage.')
  }

  const reviewRows = parseCsv(reviewBuffer, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[]
  const reviewSha256 = sha256TaoyuanReviewCsv(reviewBuffer)
  const reviewValidation = validateTaoyuanPaidCurbReview({
    pack: referencePack,
    manifest: reviewManifest,
    rows: reviewRows,
    districtId,
    reviewSha256,
    requirePinnedReview: true,
    requireApproved: true,
  })
  if (!reviewValidation.pass || !reviewValidation.approved) {
    throw new Error(
      `Taoyuan spatial promotion requires approved source text:\n${reviewValidation.errors
        .map((error) => `- ${error}`)
        .join('\n')}`,
    )
  }

  const features: Array<
    Feature<Point, PaidCurbSpatialReferenceProperties>
  > = []
  const excluded: PaidCurbSpatialReferencePack['metadata']['excluded'] = []
  for (const record of district.records) {
    const sourceFeature = sourceFeaturesById.get(record.parkingSegmentId)
    if (!sourceFeature) {
      throw new Error(
        `Taoyuan spatial source is missing reviewed ID ${record.parkingSegmentId}.`,
      )
    }
    const sourceProperties = sourceFeature.properties
    if (
      sourceProperties.description !== record.description ||
      sourceProperties.fareDescription !== record.fareDescription ||
      sourceProperties.hasChargingPoint !== record.hasChargingPoint
    ) {
      throw new Error(
        `Taoyuan spatial/text fields differ for ${record.parkingSegmentId}.`,
      )
    }
    if (
      !isLocationInCoverageDistrict(
        coverageDistrict,
        sourceFeature.geometry.coordinates as [number, number],
      )
    ) {
      excluded.push({
        parkingSegmentId: record.parkingSegmentId,
        reason: 'OUTSIDE_OFFICIAL_DISTRICT_BOUNDARY',
      })
      continue
    }
    features.push({
      type: 'Feature',
      geometry: sourceFeature.geometry,
      properties: {
        evidenceKind: 'PAID_CURB_SEGMENT',
        parkingSegmentId: record.parkingSegmentId,
        districtId,
        description: record.description,
        fareDescription: record.fareDescription,
        hasChargingPoint: record.hasChargingPoint,
        geometryPrecision: 'REPRESENTATIVE_POINT',
        legalAnswerEligible: false,
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
      },
    })
  }

  const pack = parsePaidCurbSpatialReferencePack({
    type: 'FeatureCollection',
    metadata: {
      schemaVersion: 1,
      districtId,
      boundaryFeatureId: district.boundaryFeatureId,
      evidenceKind: 'PAID_CURB_SEGMENT',
      sourceDataset: 'TDX OnStreet ParkingSegment v1',
      sourceSha256: sha256(sourceBuffer),
      sourceFeatureCount: sourceFeatures.length,
      reviewSha256,
      reviewRecordCount: district.recordCount,
      featureCount: features.length,
      excludedFeatureCount: excluded.length,
      excluded,
      geometryPrecision: 'REPRESENTATIVE_POINT',
      legalAnswerEligible: false,
    },
    features,
  })
  const outputBuffer = Buffer.from(`${JSON.stringify(pack)}\n`, 'utf-8')
  const expectedBuffer = expectedPath
    ? await fs.readFile(expectedPath)
    : null
  const expectedRuntimeContentMatches = expectedBuffer
    ? matchesExpectedRuntimePack(expectedBuffer, pack)
    : null
  const receipt = {
    schemaVersion: 1,
    promotedAt: (options.now ?? new Date()).toISOString(),
    districtId,
    source: {
      path: portablePath(inputPath),
      sha256: pack.metadata.sourceSha256,
      featureCount: pack.metadata.sourceFeatureCount,
    },
    review: {
      path: portablePath(reviewPath),
      sha256: pack.metadata.reviewSha256,
      approvedRows: pack.metadata.reviewRecordCount,
    },
    destination: {
      path: portablePath(outputPath),
      sha256: sha256(outputBuffer),
      featureCount: pack.metadata.featureCount,
      excludedFeatureCount: pack.metadata.excludedFeatureCount,
    },
    safety: {
      geometryPrecision: 'REPRESENTATIVE_POINT',
      legalAnswerEligible: false,
    },
    ...(expectedPath && expectedBuffer
      ? {
          expectedRuntimePack: {
            path: portablePath(expectedPath),
            sha256: sha256(expectedBuffer),
            runtimeContentMatches: expectedRuntimeContentMatches,
            ignoredProvenanceFields: ['metadata.sourceSha256'],
          },
        }
      : {}),
  }

  await replaceFileAtomically(outputPath, outputBuffer)
  await replaceFileAtomically(
    receiptPath,
    Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf-8'),
  )
  if (expectedPath && !expectedRuntimeContentMatches) {
    throw new Error(
      `Generated Taoyuan runtime reference differs from ${portablePath(expectedPath)}. Review the uploaded artifact before updating the tracked public pack.`,
    )
  }
  return { outputPath, receiptPath, pack, receipt }
}

const run = async () => {
  const result = await promoteTaoyuanSpatialReference({
    districtId: getArgValue(process.argv, '--district') ?? undefined,
    inputPath: getArgValue(process.argv, '--input'),
    referencePath: getArgValue(process.argv, '--reference'),
    reviewPath: getArgValue(process.argv, '--review'),
    reviewManifestPath: getArgValue(process.argv, '--review-manifest'),
    coveragePath: getArgValue(process.argv, '--coverage'),
    outputPath: getArgValue(process.argv, '--out'),
    receiptPath: getArgValue(process.argv, '--receipt'),
    expectedPath: getArgValue(process.argv, '--expected'),
  })
  console.log(
    `Promoted ${result.pack.metadata.featureCount}/${result.pack.metadata.reviewRecordCount} reviewed Taoyuan representative points.`,
  )
  console.log(
    `Excluded ${result.pack.metadata.excludedFeatureCount} out-of-boundary points.`,
  )
  console.log(`Output: ${result.outputPath}`)
  console.log(`SHA-256: ${result.receipt.destination.sha256}`)
  console.log('Geometry remains representative-only and legal-answer eligibility is false.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
