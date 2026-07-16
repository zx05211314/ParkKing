import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import {
  findCoverageDistrictByLocation,
  type CoveragePublishStage,
  type RuntimeCoverageCatalog,
} from './coverageCatalog'

export interface CoverageBoundaryProperties {
  districtId: string
  districtName: string
  regionName: string
  publishStage: CoveragePublishStage
}

export interface PinnedCoverageBoundary {
  districtId: string
  districtName: string
  regionName: string
  publishStage: CoveragePublishStage
  stageLabel: string
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

  return {
    districtId: district.districtId,
    districtName: district.districtName,
    regionName: district.regionName,
    publishStage: district.publishStage,
    stageLabel: COVERAGE_STAGE_LABELS[district.publishStage],
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: district.boundaryGeometry,
          properties: {
            districtId: district.districtId,
            districtName: district.districtName,
            regionName: district.regionName,
            publishStage: district.publishStage,
          },
        },
      ],
    },
  }
}
