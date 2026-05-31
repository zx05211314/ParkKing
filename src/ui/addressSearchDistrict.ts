import { getDatasetBaseDir } from '../data/datasetResolver'
import { selectDistrictByLocation } from '../data/districtSelect'
import { loadGeoJson } from '../data/loaders/loadGeoJson'
import type { DatasetMeta } from '../data/segmentBuilder'
import type { DatasetOption } from './addressSearchActionTypes'

interface ResolveDistrictForLocationOptions {
  datasetMetaFile: string
  datasetOptions: DatasetOption[]
  location: [number, number]
  fallbackToFirst?: boolean
}

export const resolveDistrictForLocation = async ({
  datasetMetaFile,
  datasetOptions,
  location,
  fallbackToFirst = false,
}: ResolveDistrictForLocationOptions) => {
  if (datasetOptions.length === 0) {
    return null
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

  const selected = selectDistrictByLocation(boundaries, location)
  if (selected) {
    return selected
  }

  return fallbackToFirst ? datasetOptions[0]?.id ?? null : null
}
