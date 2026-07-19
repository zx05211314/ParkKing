import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  area,
  bbox,
  difference,
  featureCollection,
  intersect,
  union,
} from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
} from 'geojson'
import {
  COVERAGE_AREA_BOUNDARY_KIND,
  parseCoverageAreaBoundaryPack,
  type CoverageAreaBoundaryPack,
} from '../../src/data/coverageAreaBoundary'
import { EPSG_3826 } from '../ingest/ingestCrs'
import { readDataset } from '../ingest/ingestDatasetRead'

const AREA_ID = 'shipai'
const AREA_NAME = 'Shipai'
const PARENT_DISTRICT_ID = 'beitou'
const PARENT_BOUNDARY_FEATURE_ID = '63012'
const TAIPEI_BEITOU_SECTION_CODE = '6301200'
const SOURCE_DATASET = 'Taipei City Neighborhood Boundaries'
const SOURCE_URL =
  'https://data.taipei/api/dataset/6d864ede-c482-4f33-bb89-5be19dc772e1/resource/84e357c9-6157-45e7-aaa2-4fb1e3318644/download'
const DEFINITION_SOURCE = 'Beitou District Office Shipai subdistrict'
const DEFINITION_URL =
  'https://btdo.gov.taipei/cp.aspx?n=77F1E41835C6552F'
const DEFAULT_SOURCE_ARCHIVE =
  'data/sources/shipai/neighborhood_boundaries.zip'
const DEFAULT_INPUT =
  'data/sources/shipai/neighborhood_boundaries/neighborhood_boundaries.shp'
const DEFAULT_PARENT_BOUNDARY =
  'data/sources/shared/district_bounds/district_bounds.shp'
const DEFAULT_OUTPUT = 'public/data/reference/shipai-boundary.geojson'
const DEFAULT_REPORT = '.tmp/shipai-boundary.md'
const DEFAULT_JSON_REPORT = '.tmp/shipai-boundary.json'

export const SHIPAI_MEMBER_VILLAGE_CODES = [
  '6301200001', // Jianmin
  '6301200002', // Wenlin
  '6301200003', // Shipai
  '6301200004', // Fuxing
  '6301200005', // Rongguang
  '6301200006', // Ronghua
  '6301200007', // Yumin
  '6301200008', // Zhenhua
  '6301200009', // Yonghe
  '6301200010', // Yongxin
  '6301200019', // Zhoumei
] as const

interface ShipaiBoundaryBuildResult {
  pack: CoverageAreaBoundaryPack
  sourceFeatureCount: number
  selectedFeatureCount: number
  selectedVillageCount: number
  clippedOutsideSquareMeters: number
}

const sha256 = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const roundCoordinateTree = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    return value
  }
  if (value.length >= 2 && value.every((entry) => typeof entry === 'number')) {
    return value.map((entry) => Number((entry as number).toFixed(6)))
  }
  return value.map(roundCoordinateTree)
}

const normalizeGeometry = (geometry: Polygon | MultiPolygon) =>
  ({
    ...geometry,
    coordinates: roundCoordinateTree(geometry.coordinates),
  }) as Polygon | MultiPolygon

const isBoundaryFeature = (
  feature: Feature,
): feature is Feature<Polygon | MultiPolygon, GeoJsonProperties> =>
  Boolean(
    feature.geometry &&
      (feature.geometry.type === 'Polygon' ||
        feature.geometry.type === 'MultiPolygon'),
  )

const findParentBoundary = (collection: FeatureCollection) => {
  const matched = collection.features.find(
    (feature) =>
      String(
        feature.properties?.PERF_ID ??
          feature.properties?.CPID ??
          feature.properties?.NPID ??
          feature.properties?.COUN_ID ??
          '',
      ) === PARENT_BOUNDARY_FEATURE_ID,
  )
  if (!matched || !isBoundaryFeature(matched)) {
    throw new Error('Official Beitou parent boundary was not found.')
  }
  return matched
}

export const buildShipaiAreaBoundary = (params: {
  neighborhoods: FeatureCollection
  parentBoundaries: FeatureCollection
  sourceSha256: string
}): ShipaiBoundaryBuildResult => {
  if (!/^[a-f0-9]{64}$/.test(params.sourceSha256)) {
    throw new Error('Shipai source SHA-256 is invalid.')
  }

  const memberCodes = new Set<string>(SHIPAI_MEMBER_VILLAGE_CODES)
  const selected = params.neighborhoods.features.filter(
    (feature) =>
      String(feature.properties?.SECT_CODE ?? '') ===
        TAIPEI_BEITOU_SECTION_CODE &&
      memberCodes.has(String(feature.properties?.LIE_CODE ?? '')),
  )
  if (selected.some((feature) => !isBoundaryFeature(feature))) {
    throw new Error('Shipai source contains unsupported boundary geometry.')
  }
  const selectedCodes = new Set(
    selected.map((feature) => String(feature.properties?.LIE_CODE ?? '')),
  )
  const missingCodes = SHIPAI_MEMBER_VILLAGE_CODES.filter(
    (code) => !selectedCodes.has(code),
  )
  if (missingCodes.length > 0) {
    throw new Error(
      `Shipai source is missing official member village codes: ${missingCodes.join(', ')}.`,
    )
  }
  const sourceFeatureIdOccurrences = new Map<string, number>()
  const selectedSourceFeatureIds = selected.map((feature) => {
    const id = String(feature.properties?.SDFKEY ?? '')
    if (!id) {
      throw new Error('Shipai source neighborhood feature IDs are missing.')
    }
    const occurrence = (sourceFeatureIdOccurrences.get(id) ?? 0) + 1
    sourceFeatureIdOccurrences.set(id, occurrence)
    return occurrence === 1 ? id : `${id}#${occurrence}`
  })
  if (
    new Set(selectedSourceFeatureIds).size !== selectedSourceFeatureIds.length
  ) {
    throw new Error('Shipai source fragment identifiers are not deterministic.')
  }

  const merged = union(
    featureCollection(
      selected as Array<
        Feature<Polygon | MultiPolygon, GeoJsonProperties>
      >,
    ),
  )
  if (!merged) {
    throw new Error('Shipai member neighborhood union produced no geometry.')
  }
  const parentBoundary = findParentBoundary(params.parentBoundaries)
  const clipped = intersect(featureCollection([merged, parentBoundary]))
  if (!clipped || !isBoundaryFeature(clipped)) {
    throw new Error('Shipai boundary does not intersect the Beitou parent boundary.')
  }
  const outside = difference(featureCollection([merged, parentBoundary]))
  const clippedOutsideSquareMeters = outside ? area(outside) : 0
  const boundaryGeometry = normalizeGeometry(clipped.geometry)
  const rawBBox = bbox(clipped)
  const boundaryBBox = rawBBox.slice(0, 4).map((value) =>
    Number(value.toFixed(6)),
  ) as [number, number, number, number]

  const pack = parseCoverageAreaBoundaryPack({
    type: 'FeatureCollection',
    metadata: {
      schemaVersion: 1,
      areaId: AREA_ID,
      areaName: AREA_NAME,
      parentDistrictId: PARENT_DISTRICT_ID,
      boundaryKind: COVERAGE_AREA_BOUNDARY_KIND,
      sourceDataset: SOURCE_DATASET,
      sourceUrl: SOURCE_URL,
      sourceSha256: params.sourceSha256,
      definitionSource: DEFINITION_SOURCE,
      definitionUrl: DEFINITION_URL,
      sourceFeatureCount: params.neighborhoods.features.length,
      selectedFeatureCount: selected.length,
      selectedSourceFeatureIds,
      memberFeatureIds: [...SHIPAI_MEMBER_VILLAGE_CODES],
      clippedOutsideSquareMeters: Number(
        clippedOutsideSquareMeters.toFixed(3),
      ),
      boundaryBBox,
      parkingAnswerOwnerDistrictId: PARENT_DISTRICT_ID,
    },
    features: [
      {
        type: 'Feature',
        geometry: boundaryGeometry,
        properties: {
          areaId: AREA_ID,
          areaName: AREA_NAME,
          parentDistrictId: PARENT_DISTRICT_ID,
          boundaryKind: COVERAGE_AREA_BOUNDARY_KIND,
          parkingAnswerOwnerDistrictId: PARENT_DISTRICT_ID,
        },
      },
    ],
  })

  return {
    pack,
    sourceFeatureCount: params.neighborhoods.features.length,
    selectedFeatureCount: selected.length,
    selectedVillageCount: selectedCodes.size,
    clippedOutsideSquareMeters,
  }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const renderReport = (result: ShipaiBoundaryBuildResult) =>
  [
    '# Shipai area boundary',
    '',
    '- Status: PASS',
    `- Parent answer district: ${PARENT_DISTRICT_ID}`,
    `- Official member villages: ${result.selectedVillageCount}/${SHIPAI_MEMBER_VILLAGE_CODES.length}`,
    `- Selected neighborhood polygons: ${result.selectedFeatureCount}/${result.sourceFeatureCount}`,
    `- Clipped source mismatch: ${result.clippedOutsideSquareMeters.toFixed(3)} square meters`,
    `- Geometry: ${result.pack.features[0]?.geometry.type ?? '-'}`,
    `- BBox: ${result.pack.metadata.boundaryBBox.join(', ')}`,
    '- Parking answers continue to use the reviewed Beitou district pipeline.',
  ].join('\n')

const run = async () => {
  const sourceArchivePath = path.resolve(
    getArgValue(process.argv, '--source-archive') ?? DEFAULT_SOURCE_ARCHIVE,
  )
  const inputPath = path.resolve(
    getArgValue(process.argv, '--input') ?? DEFAULT_INPUT,
  )
  const parentBoundaryPath = path.resolve(
    getArgValue(process.argv, '--parent-boundary') ??
      DEFAULT_PARENT_BOUNDARY,
  )
  const outputPath = path.resolve(
    getArgValue(process.argv, '--out') ?? DEFAULT_OUTPUT,
  )
  const reportPath = path.resolve(
    getArgValue(process.argv, '--report') ?? DEFAULT_REPORT,
  )
  const jsonReportPath = path.resolve(
    getArgValue(process.argv, '--json-out') ?? DEFAULT_JSON_REPORT,
  )
  const sourceBuffer = await fs.readFile(sourceArchivePath)
  const [neighborhoods, parentBoundaries] = await Promise.all([
    readDataset(inputPath, EPSG_3826),
    readDataset(parentBoundaryPath, EPSG_3826),
  ])
  const result = buildShipaiAreaBoundary({
    neighborhoods,
    parentBoundaries,
    sourceSha256: sha256(sourceBuffer),
  })
  const report = renderReport(result)
  await Promise.all([
    fs.mkdir(path.dirname(outputPath), { recursive: true }),
    fs.mkdir(path.dirname(reportPath), { recursive: true }),
    fs.mkdir(path.dirname(jsonReportPath), { recursive: true }),
  ])
  await Promise.all([
    fs.writeFile(outputPath, `${JSON.stringify(result.pack)}\n`, 'utf-8'),
    fs.writeFile(reportPath, `${report}\n`, 'utf-8'),
    fs.writeFile(
      jsonReportPath,
      `${JSON.stringify(
        {
          status: 'PASS',
          ...result,
        },
        null,
        2,
      )}\n`,
      'utf-8',
    ),
  ])
  console.log(report)
  console.log(`Output: ${outputPath}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
