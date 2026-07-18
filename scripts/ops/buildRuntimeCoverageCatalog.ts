import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bbox, feature, simplify } from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson'
import {
  getPaidCurbReferenceUrl,
  parsePaidCurbReferencePack,
} from '../../src/data/paidCurbReference'
import {
  getPaidCurbSpatialReferenceUrl,
  parsePaidCurbSpatialReferencePack,
  type PaidCurbSpatialReferencePack,
} from '../../src/data/paidCurbSpatialReference'
import {
  parseRuntimeCoverageCatalog,
  type RuntimeCoverageCatalog,
  type RuntimeCoverageDistrict,
  type RuntimeCoverageReferenceData,
} from '../../src/data/coverageCatalog'
import { EPSG_4326 } from '../ingest/ingestCrs'
import { readDataset } from '../ingest/ingestDatasetRead'
import type {
  CoverageManifest,
  CoverageRegion,
} from './coverageStatus'

const DEFAULT_MANIFEST = 'configs/coverage.expansion.json'
const DEFAULT_TAOYUAN_BOUNDARIES =
  'data/sources/taoyuan/town_boundaries/town_boundaries.shp'
const DEFAULT_OUTPUT = 'public/data/coverage.json'
const DEFAULT_TAOYUAN_REFERENCE =
  'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_TAOYUAN_SPATIAL_REFERENCE_DIR = 'public/data/reference'
const DEFAULT_SIMPLIFY_TOLERANCE = 0.00002

const REGION_BOUNDARY_ID_KEYS: Record<string, string[]> = {
  taipei: ['PERF_ID', 'CPID', 'NPID', 'COUN_ID'],
  taoyuan: ['TOWNCODE'],
}

interface DistrictConfigSource {
  inputs?: { districtBounds?: string }
  crs?: { default?: string }
}

export interface RuntimeCoverageCatalogBuildOptions {
  simplifyTolerance?: number
  referencesByBoundaryFeatureId?: ReadonlyMap<
    string,
    RuntimeCoverageReferenceData
  >
}

const readJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const findBoundaryFeature = (
  collection: FeatureCollection,
  regionId: string,
  boundaryFeatureId: string,
): Feature<Polygon | MultiPolygon> => {
  const idKeys = REGION_BOUNDARY_ID_KEYS[regionId] ?? []
  const matched = collection.features.find((candidate) =>
    idKeys.some(
      (key) => String(candidate.properties?.[key] ?? '') === boundaryFeatureId,
    ),
  )
  if (
    !matched?.geometry ||
    (matched.geometry.type !== 'Polygon' &&
      matched.geometry.type !== 'MultiPolygon')
  ) {
    throw new Error(`${regionId}: boundary ${boundaryFeatureId} was not found`)
  }
  return matched as Feature<Polygon | MultiPolygon>
}

const roundCoordinateTree = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    return value
  }
  if (value.length >= 2 && value.every((entry) => typeof entry === 'number')) {
    return value.map((entry) => Number((entry as number).toFixed(6)))
  }
  return value.map(roundCoordinateTree)
}

const normalizeBoundary = (
  source: Feature<Polygon | MultiPolygon>,
  tolerance: number,
) => {
  const simplified = simplify(
    feature(source.geometry, {}),
    {
      tolerance,
      highQuality: true,
      mutate: false,
    },
  ) as Feature<Polygon | MultiPolygon>
  const rawBBox = bbox(simplified)
  const boundaryBBox = rawBBox.slice(0, 4).map((value) =>
    Number(value.toFixed(6)),
  ) as RuntimeCoverageDistrict['boundaryBBox']
  const boundaryGeometry = {
    ...simplified.geometry,
    coordinates: roundCoordinateTree(simplified.geometry.coordinates),
  } as Polygon | MultiPolygon
  return { boundaryBBox, boundaryGeometry }
}

export const buildRuntimeCoverageCatalog = (
  manifest: CoverageManifest,
  collectionsByRegion: ReadonlyMap<string, FeatureCollection>,
  options: RuntimeCoverageCatalogBuildOptions = {},
): RuntimeCoverageCatalog => {
  const simplifyTolerance =
    options.simplifyTolerance ?? DEFAULT_SIMPLIFY_TOLERANCE
  if (!Number.isFinite(simplifyTolerance) || simplifyTolerance < 0) {
    throw new Error('simplifyTolerance must be a non-negative number')
  }

  const districts: RuntimeCoverageDistrict[] = []
  for (const region of manifest.regions) {
    const collection = collectionsByRegion.get(region.regionId)
    if (!collection) {
      throw new Error(`${region.regionId}: boundary collection is missing`)
    }
    for (const district of region.districts) {
      const source = findBoundaryFeature(
        collection,
        region.regionId,
        district.boundaryFeatureId,
      )
      const referenceData = options.referencesByBoundaryFeatureId?.get(
        district.boundaryFeatureId,
      )
      districts.push({
        regionId: region.regionId,
        regionName: region.regionName,
        districtId: district.districtId,
        districtName: district.districtName,
        boundaryFeatureId: district.boundaryFeatureId,
        publishStage: district.publishStage,
        answerCapability: region.answerCapability,
        requiresHumanReview: district.requiresHumanReview,
        aliases: region.aliases
          .filter(({ parentDistrictId }) => parentDistrictId === district.districtId)
          .map(
            ({
              areaId,
              areaName,
              coverageMode,
              standaloneBoundaryRequired,
            }) => ({
              areaId,
              areaName,
              coverageMode,
              standaloneBoundaryRequired,
            }),
          ),
        ...(referenceData ? { referenceData } : {}),
        ...normalizeBoundary(source, simplifyTolerance),
      })
    }
  }

  return parseRuntimeCoverageCatalog({ schemaVersion: 1, districts })
}

export const sha256RuntimeReferenceData = (buffer: Buffer) =>
  createHash('sha256')
    .update(buffer.toString('utf-8').replace(/\r\n?/g, '\n'), 'utf-8')
    .digest('hex')

export const loadTaoyuanCoverageReferences = async (
  filePath: string,
  spatialReferencePaths?: string | readonly string[] | null,
) => {
  const pack = parsePaidCurbReferencePack(await readJson<unknown>(filePath))
  const paths =
    typeof spatialReferencePaths === 'string'
      ? [spatialReferencePaths]
      : [...(spatialReferencePaths ?? [])]
  const spatialPacks = new Map<
    string,
    { buffer: Buffer; pack: PaidCurbSpatialReferencePack }
  >()
  const districtIds = new Set(pack.districts.map(({ districtId }) => districtId))
  for (const spatialReferencePath of paths) {
    const buffer = await fs.readFile(spatialReferencePath)
    const spatialPack = parsePaidCurbSpatialReferencePack(
      JSON.parse(buffer.toString('utf-8')) as unknown,
    )
    if (!districtIds.has(spatialPack.metadata.districtId)) {
      throw new Error(
        `Paid-curb spatial reference has unknown Taoyuan district ${spatialPack.metadata.districtId}`,
      )
    }
    if (spatialPacks.has(spatialPack.metadata.districtId)) {
      throw new Error(
        `Duplicate paid-curb spatial reference for ${spatialPack.metadata.districtId}`,
      )
    }
    spatialPacks.set(spatialPack.metadata.districtId, {
      buffer,
      pack: spatialPack,
    })
  }
  return new Map<string, RuntimeCoverageReferenceData>(
    pack.districts.map((district) => {
      const spatial = spatialPacks.get(district.districtId)
      return [
        district.boundaryFeatureId,
        {
          kind: pack.evidenceKind,
          url: getPaidCurbReferenceUrl(),
          recordCount: district.recordCount,
          sourceSha256: pack.source.sha256,
          geometryAvailable: false,
          legalAnswerEligible: false,
          requiresHumanReview: true,
          ...(spatial
            ? {
                spatialReference: {
                  kind: spatial.pack.metadata.evidenceKind,
                  url: getPaidCurbSpatialReferenceUrl(district.districtId),
                  dataSha256: sha256RuntimeReferenceData(spatial.buffer),
                  sourceSha256: spatial.pack.metadata.sourceSha256,
                  reviewSha256: spatial.pack.metadata.reviewSha256,
                  featureCount: spatial.pack.metadata.featureCount,
                  excludedFeatureCount:
                    spatial.pack.metadata.excludedFeatureCount,
                  geometryPrecision: spatial.pack.metadata.geometryPrecision,
                  legalAnswerEligible: false,
                },
              }
            : {}),
        },
      ]
    }),
  )
}

export const discoverTaoyuanSpatialReferencePaths = async (
  directoryPath: string,
) => {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true })
    return entries
      .filter(
        (entry) =>
          entry.isFile() && entry.name.endsWith('-paid-curb-points.geojson'),
      )
      .map((entry) => path.join(directoryPath, entry.name))
      .sort((left, right) => left.localeCompare(right))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

const resolveTaipeiBoundarySource = async (
  region: CoverageRegion,
  manifestPath: string,
) => {
  const configuredDistrict = region.districts.find(({ configPath }) => configPath)
  if (!configuredDistrict?.configPath) {
    throw new Error('taipei: no district config is available for boundary discovery')
  }
  const rootDir = path.dirname(path.dirname(manifestPath))
  const configPath = path.resolve(rootDir, configuredDistrict.configPath)
  const config = await readJson<DistrictConfigSource>(configPath)
  if (!config.inputs?.districtBounds) {
    throw new Error(`${configuredDistrict.districtId}: districtBounds input is missing`)
  }
  return {
    inputPath: path.resolve(path.dirname(configPath), config.inputs.districtBounds),
    defaultCrs: config.crs?.default ?? EPSG_4326,
  }
}

export const loadCoverageBoundaryCollections = async (params: {
  manifest: CoverageManifest
  manifestPath: string
  taipeiBoundariesPath?: string | null
  taoyuanBoundariesPath: string
}) => {
  const collections = new Map<string, FeatureCollection>()
  for (const region of params.manifest.regions) {
    if (region.regionId === 'taipei') {
      const discovered = await resolveTaipeiBoundarySource(
        region,
        params.manifestPath,
      )
      collections.set(
        region.regionId,
        await readDataset(
          params.taipeiBoundariesPath ?? discovered.inputPath,
          discovered.defaultCrs,
        ),
      )
      continue
    }
    if (region.regionId === 'taoyuan') {
      collections.set(
        region.regionId,
        await readDataset(params.taoyuanBoundariesPath, EPSG_4326),
      )
      continue
    }
    throw new Error(`${region.regionId}: runtime boundary source is not configured`)
  }
  return collections
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const run = async () => {
  const manifestPath = path.resolve(
    getArgValue(process.argv, '--manifest') ?? DEFAULT_MANIFEST,
  )
  const outputPath = path.resolve(
    getArgValue(process.argv, '--output') ?? DEFAULT_OUTPUT,
  )
  const manifest = await readJson<CoverageManifest>(manifestPath)
  const collections = await loadCoverageBoundaryCollections({
    manifest,
    manifestPath,
    taipeiBoundariesPath: getArgValue(process.argv, '--taipei-boundaries'),
    taoyuanBoundariesPath: path.resolve(
      getArgValue(process.argv, '--taoyuan-boundaries') ??
        DEFAULT_TAOYUAN_BOUNDARIES,
    ),
  })
  const toleranceArg = getArgValue(process.argv, '--simplify-tolerance')
  const explicitSpatialReference = getArgValue(
    process.argv,
    '--taoyuan-spatial-reference',
  )
  const spatialReferencePaths = explicitSpatialReference
    ? [path.resolve(explicitSpatialReference)]
    : await discoverTaoyuanSpatialReferencePaths(
        path.resolve(
          getArgValue(process.argv, '--taoyuan-spatial-reference-dir') ??
            DEFAULT_TAOYUAN_SPATIAL_REFERENCE_DIR,
        ),
      )
  const referencesByBoundaryFeatureId = manifest.regions.some(
    ({ regionId }) => regionId === 'taoyuan',
  )
    ? await loadTaoyuanCoverageReferences(
        path.resolve(
          getArgValue(process.argv, '--taoyuan-reference') ??
            DEFAULT_TAOYUAN_REFERENCE,
        ),
        spatialReferencePaths,
      )
    : undefined
  const catalog = buildRuntimeCoverageCatalog(manifest, collections, {
    simplifyTolerance: toleranceArg
      ? Number(toleranceArg)
      : DEFAULT_SIMPLIFY_TOLERANCE,
    referencesByBoundaryFeatureId,
  })
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(catalog)}\n`, 'utf-8')
  const bytes = Buffer.byteLength(JSON.stringify(catalog))
  console.log(`Runtime coverage catalog: ${catalog.districts.length} districts`)
  console.log(`Wrote ${outputPath} (${bytes} bytes)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
