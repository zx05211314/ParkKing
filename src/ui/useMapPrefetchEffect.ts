import { useEffect, type MutableRefObject } from 'react'
import type { DatasetLoadStatus } from './mapViewReadiness'

export type AppViewMode = 'LIST' | 'MAP'

export const shouldPreloadMapView = (
  activeView: AppViewMode,
  datasetStatus: DatasetLoadStatus,
  mapPrefetchStarted: boolean,
) => activeView === 'MAP' && datasetStatus === 'ready' && !mapPrefetchStarted

export const useMapPrefetchEffect = (
  activeView: AppViewMode,
  datasetStatus: DatasetLoadStatus,
  mapPrefetchRef: MutableRefObject<boolean>,
  preloadMapView: () => Promise<unknown>,
) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (!shouldPreloadMapView(activeView, datasetStatus, mapPrefetchRef.current)) {
      return
    }

    mapPrefetchRef.current = true
    preloadMapView().catch(() => {})
  }, [activeView, datasetStatus, mapPrefetchRef, preloadMapView])
}
