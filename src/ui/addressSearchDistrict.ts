import { getDatasetBaseDir } from '../data/datasetResolver'
import {
  selectDistrictByLocation,
  type DistrictBBox,
} from '../data/districtSelect'
import { loadGeoJson } from '../data/loaders/loadGeoJson'
import type { DatasetMeta } from '../data/segmentBuilder'
import {
  isLocationInCoverageDistrict,
  type RuntimeCoverageCatalog,
  type RuntimeCoverageCatalogStatus,
} from '../data/coverageCatalog'
import type { DatasetOption } from './addressSearchActionTypes'

interface ResolveDistrictForLocationOptions {
  datasetMetaFile: string
  datasetOptions: DatasetOption[]
  coverageCatalog?: RuntimeCoverageCatalog | null
  coverageCatalogStatus?: RuntimeCoverageCatalogStatus
  location: [number, number]
  fallbackToFirst?: boolean
}

const bboxContainsLocation = (
  bbox: DistrictBBox,
  location: [number, number],
) => {
  const [longitude, latitude] = location
  return (
    longitude >= bbox.minX &&
    longitude <= bbox.maxX &&
    latitude >= bbox.minY &&
    latitude <= bbox.maxY
  )
}

export const resolveDistrictForLocation = async ({
  datasetMetaFile,
  datasetOptions,
  coverageCatalog,
  coverageCatalogStatus,
  location,
  fallbackToFirst = false,
}: ResolveDistrictForLocationOptions) => {
  if (datasetOptions.length === 0) {
    return null
  }

  if (!coverageCatalog && coverageCatalogStatus === 'loading') {
    return fallbackToFirst ? datasetOptions[0]?.id ?? null : null
  }

  if (coverageCatalog) {
    const publishedOptionIds = new Set(datasetOptions.map(({ id }) => id))
    const selected = coverageCatalog.districts.find(
      (district) =>
        district.publishStage === 'production' &&
        publishedOptionIds.has(district.districtId) &&
        isLocationInCoverageDistrict(district, location),
    )
    if (selected) {
      return selected.districtId
    }
    return fallbackToFirst ? datasetOptions[0]?.id ?? null : null
  }

  const boundaries = await Promise.all(
    datasetOptions.map(async (option) => {
      const baseDir = getDatasetBaseDir(option.id)
      const meta = await loadGeoJson<DatasetMeta>(datasetMetaFile, {
        baseDir,
      }).catch(() => null)
      return {
        districtId: option.id,
        boundaryBBox: meta?.boundaryBBox ?? null,
        boundaryCenter: meta?.boundaryCenter ?? null,
      }
    }),
  )

  const containingBoundaries = boundaries.filter(
    ({ boundaryBBox }) =>
      boundaryBBox && bboxContainsLocation(boundaryBBox, location),
  )
  const selected = selectDistrictByLocation(containingBoundaries, location)
  if (selected) {
    return selected
  }

  return fallbackToFirst ? datasetOptions[0]?.id ?? null : null
}
