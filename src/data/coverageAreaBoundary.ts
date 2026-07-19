import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson'

export const COVERAGE_AREA_BOUNDARY_KIND =
  'OFFICIAL_SUBDISTRICT_UNION' as const

export interface CoverageAreaBoundaryProperties {
  areaId: string
  areaName: string
  parentDistrictId: string
  boundaryKind: typeof COVERAGE_AREA_BOUNDARY_KIND
  parkingAnswerOwnerDistrictId: string
}

export interface CoverageAreaBoundaryPack
  extends FeatureCollection<
    Polygon | MultiPolygon,
    CoverageAreaBoundaryProperties
  > {
  metadata: {
    schemaVersion: 1
    areaId: string
    areaName: string
    parentDistrictId: string
    boundaryKind: typeof COVERAGE_AREA_BOUNDARY_KIND
    sourceDataset: string
    sourceUrl: string
    sourceSha256: string
    definitionSource: string
    definitionUrl: string
    sourceFeatureCount: number
    selectedFeatureCount: number
    selectedSourceFeatureIds: string[]
    memberFeatureIds: string[]
    clippedOutsideSquareMeters: number
    boundaryBBox: [number, number, number, number]
    parkingAnswerOwnerDistrictId: string
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isBoundaryBBox = (value: unknown) =>
  Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber)

const isBoundaryGeometry = (
  value: unknown,
): value is Polygon | MultiPolygon =>
  isRecord(value) &&
  (value.type === 'Polygon' || value.type === 'MultiPolygon') &&
  Array.isArray(value.coordinates)

const isProperties = (
  value: unknown,
): value is CoverageAreaBoundaryProperties =>
  isRecord(value) &&
  typeof value.areaId === 'string' &&
  value.areaId.length > 0 &&
  typeof value.areaName === 'string' &&
  value.areaName.length > 0 &&
  typeof value.parentDistrictId === 'string' &&
  value.parentDistrictId.length > 0 &&
  value.boundaryKind === COVERAGE_AREA_BOUNDARY_KIND &&
  typeof value.parkingAnswerOwnerDistrictId === 'string' &&
  value.parkingAnswerOwnerDistrictId.length > 0

const isFeature = (
  value: unknown,
): value is Feature<
  Polygon | MultiPolygon,
  CoverageAreaBoundaryProperties
> =>
  isRecord(value) &&
  value.type === 'Feature' &&
  isBoundaryGeometry(value.geometry) &&
  isProperties(value.properties)

export const parseCoverageAreaBoundaryPack = (
  value: unknown,
): CoverageAreaBoundaryPack => {
  if (
    !isRecord(value) ||
    value.type !== 'FeatureCollection' ||
    !Array.isArray(value.features) ||
    value.features.length !== 1 ||
    !value.features.every(isFeature) ||
    !isRecord(value.metadata)
  ) {
    throw new Error('Invalid coverage area boundary pack')
  }

  const metadata = value.metadata
  const feature = value.features[0] as Feature<
    Polygon | MultiPolygon,
    CoverageAreaBoundaryProperties
  >
  if (
    metadata.schemaVersion !== 1 ||
    typeof metadata.areaId !== 'string' ||
    metadata.areaId.length === 0 ||
    typeof metadata.areaName !== 'string' ||
    metadata.areaName.length === 0 ||
    typeof metadata.parentDistrictId !== 'string' ||
    metadata.parentDistrictId.length === 0 ||
    metadata.boundaryKind !== COVERAGE_AREA_BOUNDARY_KIND ||
    typeof metadata.sourceDataset !== 'string' ||
    metadata.sourceDataset.length === 0 ||
    typeof metadata.sourceUrl !== 'string' ||
    !metadata.sourceUrl.startsWith('https://') ||
    typeof metadata.sourceSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(metadata.sourceSha256) ||
    typeof metadata.definitionSource !== 'string' ||
    metadata.definitionSource.length === 0 ||
    typeof metadata.definitionUrl !== 'string' ||
    !metadata.definitionUrl.startsWith('https://') ||
    !Number.isSafeInteger(metadata.sourceFeatureCount) ||
    Number(metadata.sourceFeatureCount) < 1 ||
    !Number.isSafeInteger(metadata.selectedFeatureCount) ||
    Number(metadata.selectedFeatureCount) < 1 ||
    Number(metadata.selectedFeatureCount) >
      Number(metadata.sourceFeatureCount) ||
    !Array.isArray(metadata.selectedSourceFeatureIds) ||
    metadata.selectedSourceFeatureIds.length !==
      Number(metadata.selectedFeatureCount) ||
    !metadata.selectedSourceFeatureIds.every(
      (entry) => typeof entry === 'string' && entry.length > 0,
    ) ||
    new Set(metadata.selectedSourceFeatureIds).size !==
      metadata.selectedSourceFeatureIds.length ||
    !Array.isArray(metadata.memberFeatureIds) ||
    metadata.memberFeatureIds.length === 0 ||
    !metadata.memberFeatureIds.every(
      (entry) => typeof entry === 'string' && entry.length > 0,
    ) ||
    new Set(metadata.memberFeatureIds).size !==
      metadata.memberFeatureIds.length ||
    !isFiniteNumber(metadata.clippedOutsideSquareMeters) ||
    metadata.clippedOutsideSquareMeters < 0 ||
    !isBoundaryBBox(metadata.boundaryBBox) ||
    typeof metadata.parkingAnswerOwnerDistrictId !== 'string' ||
    metadata.parkingAnswerOwnerDistrictId.length === 0 ||
    feature.properties.areaId !== metadata.areaId ||
    feature.properties.areaName !== metadata.areaName ||
    feature.properties.parentDistrictId !== metadata.parentDistrictId ||
    feature.properties.boundaryKind !== metadata.boundaryKind ||
    feature.properties.parkingAnswerOwnerDistrictId !==
      metadata.parkingAnswerOwnerDistrictId ||
    metadata.parkingAnswerOwnerDistrictId !== metadata.parentDistrictId
  ) {
    throw new Error('Invalid coverage area boundary metadata')
  }

  return value as unknown as CoverageAreaBoundaryPack
}

const AREA_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const getCoverageAreaBoundaryFileName = (areaId: string) => {
  if (!AREA_ID_PATTERN.test(areaId)) {
    throw new Error(`Invalid coverage area boundary id: ${areaId}`)
  }
  return `${areaId}-boundary.geojson`
}

export const getCoverageAreaBoundaryUrl = (areaId: string) =>
  `/data/reference/${getCoverageAreaBoundaryFileName(areaId)}`
