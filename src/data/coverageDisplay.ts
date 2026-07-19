import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import {
  findCoverageAliasByLocation,
  findCoverageDistrictByLocation,
  type CoveragePublishStage,
  type RuntimeCoverageCatalog,
} from './coverageCatalog'

export interface CoverageBoundaryProperties {
  districtId: string
  districtName: string
  coverageName: string
  regionName: string
  publishStage: CoveragePublishStage
  areaId?: string
}

export interface PinnedCoverageBoundary {
  districtId: string
  districtName: string
  coverageName: string
  regionName: string
  publishStage: CoveragePublishStage
  stageLabel: string
  areaId?: string
  data: FeatureCollection<Polygon | MultiPolygon, CoverageBoundaryProperties>
}

const COVERAGE_STAGE_LABELS: Record<CoveragePublishStage, string> = {
  production: 'Published',
  candidate: 'Candidate, not published',
  'source-only': 'Source only',
}

export const buildPinnedCoverageBoundary = (
  catalog: RuntimeCoverageCatalog | null,
  location: [number, number] | null,
): PinnedCoverageBoundary | null => {
  if (!catalog || !location) {
    return null
  }

  const district = findCoverageDistrictByLocation(catalog, location)
  if (!district) {
    return null
  }
  const aliasMatch = findCoverageAliasByLocation(catalog, location)
  const alias =
    aliasMatch?.district.districtId === district.districtId
      ? aliasMatch.alias
      : null
  const coverageName = alias?.areaName ?? district.districtName
  const boundaryGeometry =
    alias?.boundary?.boundaryGeometry ?? district.boundaryGeometry
  const stageLabel = alias
    ? `${COVERAGE_STAGE_LABELS[district.publishStage]} via ${district.districtName}`
    : COVERAGE_STAGE_LABELS[district.publishStage]

  return {
    districtId: district.districtId,
    districtName: district.districtName,
    coverageName,
    regionName: district.regionName,
    publishStage: district.publishStage,
    stageLabel,
    ...(alias ? { areaId: alias.areaId } : {}),
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: boundaryGeometry,
          properties: {
            districtId: district.districtId,
            districtName: district.districtName,
            coverageName,
            regionName: district.regionName,
            publishStage: district.publishStage,
            ...(alias ? { areaId: alias.areaId } : {}),
          },
        },
      ],
    },
  }
}
