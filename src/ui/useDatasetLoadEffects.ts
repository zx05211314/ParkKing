import { useEffect } from 'react'
import type { UseDatasetLoadEffectsOptions } from './datasetLoadEffectTypes'
import { resetDatasetLoadState } from './datasetLoadState'

export const useDatasetLoadEffects = ({
  datasetId,
  setDatasetOptions,
  setDatasetId,
  setDatasetStatus,
  setSelectedId,
  setSegments,
  setParkingSpaces,
  setZones,
  setParkingSpaceCount,
  setIntersectionCount,
  setCrosswalkCount,
  setOverrideCount,
  setInferredCount,
  setDatasetMeta,
  setLatestInfo,
  setManifestInfo,
  setIngestReport,
  setMetricsHistory,
  setPackError,
}: UseDatasetLoadEffectsOptions) => {
  useEffect(() => {
    let isActive = true

    const loadRegistry = async () => {
      const { loadDatasetRegistryState } = await import('./datasetLoadWorkflow')
      if (!isActive) {
        return
      }
      await loadDatasetRegistryState(datasetId, {
        setDatasetOptions,
        setDatasetId,
      })
    }

    const loadData = async () => {
      resetDatasetLoadState({
        setDatasetStatus,
        setSelectedId,
        setSegments,
        setParkingSpaces,
        setZones,
        setParkingSpaceCount,
        setIntersectionCount,
        setCrosswalkCount,
        setOverrideCount,
        setInferredCount,
        setDatasetMeta,
        setLatestInfo,
        setManifestInfo,
        setIngestReport,
        setMetricsHistory,
        setPackError,
      })

      if (!datasetId) {
        return
      }

      try {
        const { applyLoadedDatasetState, loadDatasetState } = await import(
          './datasetLoadWorkflow'
        )
        if (!isActive) {
          return
        }
        const loadedState = await loadDatasetState(datasetId)
        if (!isActive) {
          return
        }

        applyLoadedDatasetState(
          {
            setLatestInfo,
            setManifestInfo,
            setIngestReport,
            setMetricsHistory,
            setSegments,
            setParkingSpaces,
            setZones,
            setParkingSpaceCount,
            setIntersectionCount,
            setCrosswalkCount,
            setOverrideCount,
            setInferredCount,
            setDatasetMeta,
            setDatasetStatus,
          },
          loadedState,
        )
      } catch (error) {
        console.error(error)
        if (isActive) {
          setPackError(error instanceof Error ? error.message : 'Invalid dataset pack')
          setDatasetStatus('error')
        }
      }
    }

    void loadRegistry()
    void loadData()

    return () => {
      isActive = false
    }
  }, [
    datasetId,
    setCrosswalkCount,
    setDatasetId,
    setDatasetMeta,
    setDatasetOptions,
    setDatasetStatus,
    setInferredCount,
    setIngestReport,
    setIntersectionCount,
    setLatestInfo,
    setManifestInfo,
    setMetricsHistory,
    setOverrideCount,
    setPackError,
    setParkingSpaceCount,
    setParkingSpaces,
    setSegments,
    setSelectedId,
    setZones,
  ])
}
