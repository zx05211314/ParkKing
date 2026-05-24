import { useEffect } from 'react'
import { ZONE_PARAMS_VERSION } from '../domain/zones/constants'
import type { UseAppLifecycleEffectsOptions } from './appLifecycleEffectTypes'

type DatasetRuntimeResetOptions = Pick<
  UseAppLifecycleEffectsOptions,
  | 'datasetHash'
  | 'datasetHashRef'
  | 'datasetId'
  | 'datasetIdRef'
  | 'zoneParamsVersionRef'
  | 'workerClientRef'
  | 'setClipCacheStats'
  | 'setEvaluatedSegments'
  | 'setEvaluationStatus'
  | 'setSelectedParkingSpaceKeyBySegment'
  | 'setSelectedTargetRouteEta'
>

export const useDatasetRuntimeResetEffect = ({
  datasetHash,
  datasetHashRef,
  datasetId,
  datasetIdRef,
  zoneParamsVersionRef,
  workerClientRef,
  setClipCacheStats,
  setEvaluatedSegments,
  setEvaluationStatus,
  setSelectedParkingSpaceKeyBySegment,
  setSelectedTargetRouteEta,
}: DatasetRuntimeResetOptions) => {
  useEffect(() => {
    let cancelled = false
    const datasetChanged =
      datasetHashRef.current && datasetHashRef.current !== datasetHash
    const datasetIdChanged = datasetIdRef.current !== datasetId
    const paramsChanged = zoneParamsVersionRef.current !== ZONE_PARAMS_VERSION

    if (datasetChanged || datasetIdChanged || paramsChanged) {
      workerClientRef.current?.terminate()
      workerClientRef.current = null
      void import('../domain/zones/zoneIndex').then(({ clearZoneIndexCache }) => {
        if (!cancelled) {
          clearZoneIndexCache()
        }
      })
      void import('../domain/geometry/clipCache').then(
        ({ clearClipCache, getClipCacheStats, resetClipCacheStats }) => {
          if (cancelled) {
            return
          }
          clearClipCache()
          resetClipCacheStats()
          setClipCacheStats(getClipCacheStats())
        },
      )
      setEvaluatedSegments([])
      setEvaluationStatus('idle')
      setSelectedParkingSpaceKeyBySegment({})
      setSelectedTargetRouteEta(null)
    }
    datasetHashRef.current = datasetHash
    datasetIdRef.current = datasetId
    zoneParamsVersionRef.current = ZONE_PARAMS_VERSION

    return () => {
      cancelled = true
    }
  }, [
    datasetHash,
    datasetHashRef,
    datasetId,
    datasetIdRef,
    setClipCacheStats,
    setEvaluatedSegments,
    setEvaluationStatus,
    setSelectedParkingSpaceKeyBySegment,
    setSelectedTargetRouteEta,
    workerClientRef,
    zoneParamsVersionRef,
  ])
}
