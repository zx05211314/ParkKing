import type { ResolvedLocationStatus } from './resolvedLocationState'

export type AutoDatasetSelectionAction =
  | { kind: 'none' }
  | { kind: 'resolve-district'; location: [number, number] }
  | { kind: 'select-fallback'; datasetId: string }

interface GetAutoDatasetSelectionActionOptions {
  hasStoredDatasetId: boolean
  datasetId: string | null
  userLocation: [number, number] | null
  locationStatus: ResolvedLocationStatus
  fallbackDatasetId: string | null
}

export const getAutoDatasetSelectionAction = ({
  hasStoredDatasetId,
  datasetId,
  userLocation,
  locationStatus,
  fallbackDatasetId,
}: GetAutoDatasetSelectionActionOptions): AutoDatasetSelectionAction => {
  if (hasStoredDatasetId || datasetId) {
    return { kind: 'none' }
  }

  if (userLocation) {
    return {
      kind: 'resolve-district',
      location: userLocation,
    }
  }

  if (locationStatus === 'unavailable' && fallbackDatasetId) {
    return {
      kind: 'select-fallback',
      datasetId: fallbackDatasetId,
    }
  }

  return { kind: 'none' }
}
