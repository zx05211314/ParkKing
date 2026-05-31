import { useState } from 'react'
import type { TimeMode } from '../domain/rules/time'
import { getCurrentHHMM, getDemoHHMM } from '../domain/rules/time'
import { readSetting, STORAGE_KEYS } from '../settings'
import { isRiskMode } from './appPresentationConfig'
import {
  isSegmentActionFilter,
  type SegmentActionFilter,
} from './segmentActionFilter'
import type { UseAppControlUiStateOptions } from './appUiStateTypes'

export const useAppControlUiState = ({
  fallbackDatasetOptions,
  initialSharedState,
  defaultRadiusMeters,
  defaultRiskMode,
  defaultSegmentActionFilter,
}: UseAppControlUiStateOptions) => {
  const initialMode = initialSharedState.mode ?? 'NOW'

  const [mode, setMode] = useState<TimeMode>(initialMode)
  const [nowHHMM, setNowHHMM] = useState(
    initialMode === 'NOW' ? getCurrentHHMM() : getDemoHHMM(initialMode),
  )
  const [datasetOptions, setDatasetOptions] = useState(fallbackDatasetOptions)
  const [datasetId, setDatasetId] = useState<string | null>(() => {
    if (initialSharedState.datasetId) {
      return initialSharedState.datasetId
    }
    const stored = readSetting<string | null>(STORAGE_KEYS.datasetId, null)
    return stored && stored.length > 0 ? stored : null
  })
  const [filterQuery, setFilterQuery] = useState(initialSharedState.filterQuery)
  const [activeView, setActiveView] = useState<'LIST' | 'MAP'>(
    initialSharedState.activeView ?? 'LIST',
  )
  const [mapRetryKey, setMapRetryKey] = useState(0)
  const [radiusMeters, setRadiusMeters] = useState(() =>
    initialSharedState.radiusMeters ??
    readSetting<number>(STORAGE_KEYS.radiusMeters, defaultRadiusMeters),
  )
  const [actionFilter, setActionFilter] = useState<SegmentActionFilter>(() => {
    if (initialSharedState.actionFilter) {
      return initialSharedState.actionFilter
    }
    const stored = readSetting<unknown>(
      STORAGE_KEYS.segmentActionFilter,
      defaultSegmentActionFilter,
    )
    return isSegmentActionFilter(stored) ? stored : defaultSegmentActionFilter
  })
  const [riskMode, setRiskMode] = useState(() => {
    if (initialSharedState.riskMode) {
      return initialSharedState.riskMode
    }
    const stored = readSetting<unknown>(STORAGE_KEYS.riskMode, defaultRiskMode)
    return isRiskMode(stored) ? stored : defaultRiskMode
  })
  const [selectedId, setSelectedId] = useState<string | null>(initialSharedState.selectedId)
  const [useMockLocation, setUseMockLocation] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.useMockLocation, false),
  )
  const [showZones, setShowZones] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showZones, false),
  )
  const [showIntersectionZones, setShowIntersectionZones] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showIntersectionZones, false),
  )
  const [showCrosswalkZones, setShowCrosswalkZones] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showCrosswalkZones, false),
  )
  const [showParkingSpaces, setShowParkingSpaces] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showParkingSpaces, false),
  )
  const [markedSpacesOnly, setMarkedSpacesOnly] = useState(() =>
    initialSharedState.markedSpacesOnly ??
    readSetting<boolean>(STORAGE_KEYS.markedSpacesOnly, false),
  )
  const [hideReportedIllegal, setHideReportedIllegal] = useState(() =>
    initialSharedState.hideReportedIllegal ??
    readSetting<boolean>(STORAGE_KEYS.hideReportedIllegal, false),
  )
  const [showInferredCandidates, setShowInferredCandidates] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showInferredCandidates, false),
  )
  const [includeInferred, setIncludeInferred] = useState(() =>
    initialSharedState.includeInferred ??
    readSetting<boolean>(STORAGE_KEYS.includeInferred, false),
  )

  return {
    actionFilter,
    activeView,
    datasetId,
    datasetOptions,
    filterQuery,
    hideReportedIllegal,
    includeInferred,
    mapRetryKey,
    markedSpacesOnly,
    mode,
    nowHHMM,
    radiusMeters,
    riskMode,
    selectedId,
    setActionFilter,
    setActiveView,
    setDatasetId,
    setDatasetOptions,
    setFilterQuery,
    setHideReportedIllegal,
    setIncludeInferred,
    setMapRetryKey,
    setMarkedSpacesOnly,
    setMode,
    setNowHHMM,
    setRadiusMeters,
    setRiskMode,
    setSelectedId,
    setShowCrosswalkZones,
    setShowInferredCandidates,
    setShowIntersectionZones,
    setShowParkingSpaces,
    setShowZones,
    setUseMockLocation,
    showCrosswalkZones,
    showInferredCandidates,
    showIntersectionZones,
    showParkingSpaces,
    showZones,
    useMockLocation,
  }
}
