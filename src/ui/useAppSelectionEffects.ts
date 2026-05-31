import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import { getAutoDatasetSelectionAction } from './appSelectionState'
import type { ResolvedLocationStatus } from './resolvedLocationState'

interface SegmentsWithId {
  id: string
}

interface UseAppSelectionEffectsOptions {
  hasStoredDatasetIdRef: MutableRefObject<boolean>
  datasetId: string | null
  userLocation: [number, number] | null
  locationStatus: ResolvedLocationStatus
  datasetOptionsCount: number
  fallbackDatasetId: string | null
  resolveDistrictForLocation: (
    location: [number, number],
    options?: { fallbackToFirst?: boolean },
  ) => Promise<string | null>
  setDatasetId: Dispatch<SetStateAction<string | null>>
  activeSearchQuery: string
  filteredSegments: SegmentsWithId[]
  selectedId: string | null
  setSelectedId: Dispatch<SetStateAction<string | null>>
}

export const useAppSelectionEffects = ({
  hasStoredDatasetIdRef,
  datasetId,
  userLocation,
  locationStatus,
  datasetOptionsCount,
  fallbackDatasetId,
  resolveDistrictForLocation,
  setDatasetId,
  activeSearchQuery,
  filteredSegments,
  selectedId,
  setSelectedId,
}: UseAppSelectionEffectsOptions) => {
  useEffect(() => {
    if (datasetOptionsCount === 0) {
      return
    }
    const action = getAutoDatasetSelectionAction({
      hasStoredDatasetId: hasStoredDatasetIdRef.current,
      datasetId,
      userLocation,
      locationStatus,
      fallbackDatasetId,
    })
    if (action.kind === 'none') {
      return
    }

    let isActive = true

    const resolveDistrict = async () => {
      if (action.kind === 'select-fallback') {
        setDatasetId(action.datasetId)
        return
      }

      const selected = await resolveDistrictForLocation(action.location, {
        fallbackToFirst: true,
      })
      if (!isActive) {
        return
      }
      if (selected) {
        setDatasetId(selected)
      }
    }

    resolveDistrict()

    return () => {
      isActive = false
    }
  }, [
    datasetId,
    datasetOptionsCount,
    fallbackDatasetId,
    hasStoredDatasetIdRef,
    locationStatus,
    resolveDistrictForLocation,
    setDatasetId,
    userLocation,
  ])

  useEffect(() => {
    if (!activeSearchQuery || !selectedId) {
      return
    }
    if (filteredSegments.some((segment) => segment.id === selectedId)) {
      return
    }
    queueMicrotask(() => {
      setSelectedId(null)
    })
  }, [activeSearchQuery, filteredSegments, selectedId, setSelectedId])
}
