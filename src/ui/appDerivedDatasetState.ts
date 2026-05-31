import { boundsFromBBox } from '../map/bounds'
import { XINYI_CENTER } from '../data/constants'
import type { AppDerivedStateOptions } from './appDerivedStateTypes'

export interface AppDerivedDatasetStateResult {
  datasetHash: string
  datasetLabelById: Map<string, string>
  districtBounds: ReturnType<typeof boundsFromBBox>
  districtBoundsKey: string | null
  districtName: string
  mapCenter: [number, number]
  schemaVersion: number | string
}

export const buildAppDerivedDatasetState = ({
  datasetId,
  datasetMeta,
  datasetOptions,
}: Pick<AppDerivedStateOptions, 'datasetId' | 'datasetMeta' | 'datasetOptions'>): AppDerivedDatasetStateResult => {
  const datasetHash = datasetMeta?.datasetHash ?? 'local'
  const districtName = datasetMeta?.districtName ?? datasetId ?? 'Unknown'
  const schemaVersion = datasetMeta?.schemaVersion ?? '-'
  const mapCenter = datasetMeta?.boundaryCenter ?? XINYI_CENTER
  const districtBounds = boundsFromBBox(datasetMeta?.boundaryBBox)
  const districtBoundsKey = districtBounds
    ? `${datasetId ?? 'unknown'}:${datasetHash}`
    : null
  const datasetLabelById = new Map(
    datasetOptions.map((option) => [option.id, option.label] as const),
  )

  return {
    datasetHash,
    datasetLabelById,
    districtBounds,
    districtBoundsKey,
    districtName,
    mapCenter,
    schemaVersion,
  }
}
