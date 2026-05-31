import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import type { RiskMode } from '../domain/ranking/policy'
import { getDemoHHMM, type TimeMode } from '../domain/rules/time'
import {
  DEFAULT_SEGMENT_ACTION_FILTER,
  type SegmentActionFilter,
} from './segmentActionFilter'

interface UseViewControlActionsOptions {
  defaultRadiusMeters: number
  defaultRiskMode: RiskMode
  mapPrefetchRef: MutableRefObject<boolean>
  preloadMapView: () => Promise<unknown>
  setFilterQuery: Dispatch<SetStateAction<string>>
  setMode: Dispatch<SetStateAction<TimeMode>>
  setNowHHMM: Dispatch<SetStateAction<string>>
  setRadiusMeters: Dispatch<SetStateAction<number>>
  setActionFilter: Dispatch<SetStateAction<SegmentActionFilter>>
  setMarkedSpacesOnly: Dispatch<SetStateAction<boolean>>
  setHideReportedIllegal: Dispatch<SetStateAction<boolean>>
  setIncludeInferred: Dispatch<SetStateAction<boolean>>
  setRiskMode: Dispatch<SetStateAction<RiskMode>>
  setMapRetryKey: Dispatch<SetStateAction<number>>
}

interface UseViewControlActionsResult {
  handleModeChange: (nextMode: TimeMode) => void
  handleRadiusChange: (value: string) => void
  handleClearActiveFilter: (key: string) => void
  handleResetViewFilters: () => void
  handleMapRetry: () => void
  handleMapPrefetch: () => void
}

export const useViewControlActions = ({
  defaultRadiusMeters,
  defaultRiskMode,
  mapPrefetchRef,
  preloadMapView,
  setFilterQuery,
  setMode,
  setNowHHMM,
  setRadiusMeters,
  setActionFilter,
  setMarkedSpacesOnly,
  setHideReportedIllegal,
  setIncludeInferred,
  setRiskMode,
  setMapRetryKey,
}: UseViewControlActionsOptions): UseViewControlActionsResult => {
  const handleModeChange = useCallback(
    (nextMode: TimeMode) => {
      setMode(nextMode)
      setNowHHMM(getDemoHHMM(nextMode))
    },
    [setMode, setNowHHMM],
  )

  const handleRadiusChange = useCallback(
    (value: string) => {
      const next = Number(value)
      if (!Number.isFinite(next)) {
        return
      }
      const clamped = Math.max(100, Math.min(3000, Math.round(next)))
      setRadiusMeters(clamped)
    },
    [setRadiusMeters],
  )

  const handleClearActiveFilter = useCallback(
    (key: string) => {
      if (key === 'text') {
        setFilterQuery('')
        return
      }
      if (key === 'action') {
        setActionFilter(DEFAULT_SEGMENT_ACTION_FILTER)
        return
      }
      if (key === 'spaces') {
        setMarkedSpacesOnly(false)
        return
      }
      if (key === 'feedback') {
        setHideReportedIllegal(false)
        return
      }
      if (key === 'inferred') {
        setIncludeInferred(false)
        return
      }
      if (key === 'radius') {
        setRadiusMeters(defaultRadiusMeters)
        return
      }
      if (key === 'risk') {
        setRiskMode(defaultRiskMode)
      }
    },
    [
      defaultRadiusMeters,
      defaultRiskMode,
      setActionFilter,
      setFilterQuery,
      setHideReportedIllegal,
      setIncludeInferred,
      setMarkedSpacesOnly,
      setRadiusMeters,
      setRiskMode,
    ],
  )

  const handleResetViewFilters = useCallback(() => {
    setFilterQuery('')
    setActionFilter(DEFAULT_SEGMENT_ACTION_FILTER)
    setMarkedSpacesOnly(false)
    setHideReportedIllegal(false)
    setIncludeInferred(false)
    setRadiusMeters(defaultRadiusMeters)
    setRiskMode(defaultRiskMode)
  }, [
    defaultRadiusMeters,
    defaultRiskMode,
    setActionFilter,
    setFilterQuery,
    setHideReportedIllegal,
    setIncludeInferred,
    setMarkedSpacesOnly,
    setRadiusMeters,
    setRiskMode,
  ])

  const handleMapRetry = useCallback(() => {
    setMapRetryKey((value) => value + 1)
  }, [setMapRetryKey])

  const handleMapPrefetch = useCallback(() => {
    if (mapPrefetchRef.current) {
      return
    }
    mapPrefetchRef.current = true
    preloadMapView().catch(() => {})
  }, [mapPrefetchRef, preloadMapView])

  return {
    handleModeChange,
    handleRadiusChange,
    handleClearActiveFilter,
    handleResetViewFilters,
    handleMapRetry,
    handleMapPrefetch,
  }
}
