import { useEffect, type MutableRefObject } from 'react'

export type AppViewMode = 'LIST' | 'MAP'

export const shouldPreloadMapView = (
  activeView: AppViewMode,
  mapPrefetchStarted: boolean,
) => activeView === 'MAP' && !mapPrefetchStarted

export const useMapPrefetchEffect = (
  activeView: AppViewMode,
  mapPrefetchRef: MutableRefObject<boolean>,
  preloadMapView: () => Promise<unknown>,
) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (!shouldPreloadMapView(activeView, mapPrefetchRef.current)) {
      return
    }

    mapPrefetchRef.current = true
    preloadMapView().catch(() => {})
  }, [activeView, mapPrefetchRef, preloadMapView])
}
