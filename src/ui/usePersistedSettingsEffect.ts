import { useEffect } from 'react'
import {
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEYS,
  writeSetting,
} from '../settings'
import type { UseAppLifecycleEffectsOptions } from './appLifecycleEffectTypes'

type PersistedSettingsOptions = Pick<
  UseAppLifecycleEffectsOptions,
  | 'datasetId'
  | 'radiusMeters'
  | 'riskMode'
  | 'actionFilter'
  | 'includeInferred'
  | 'showZones'
  | 'showIntersectionZones'
  | 'showCrosswalkZones'
  | 'showParkingSpaces'
  | 'markedSpacesOnly'
  | 'hideReportedIllegal'
  | 'showInferredCandidates'
  | 'useMockLocation'
  | 'favoriteAddresses'
  | 'recentAddressSearches'
  | 'tripBoardSortMode'
  | 'tripBoardIntentFilter'
  | 'tripBoardSuggestionFilter'
  | 'tripBoardFilters'
  | 'collapsedSavedPlanGroups'
  | 'recommendationRankMode'
  | 'selectedRouteProfile'
>

export const usePersistedSettingsEffect = ({
  datasetId,
  radiusMeters,
  riskMode,
  actionFilter,
  includeInferred,
  showZones,
  showIntersectionZones,
  showCrosswalkZones,
  showParkingSpaces,
  markedSpacesOnly,
  hideReportedIllegal,
  showInferredCandidates,
  useMockLocation,
  favoriteAddresses,
  recentAddressSearches,
  tripBoardSortMode,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  tripBoardFilters,
  collapsedSavedPlanGroups,
  recommendationRankMode,
  selectedRouteProfile,
}: PersistedSettingsOptions) => {
  useEffect(() => {
    writeSetting(STORAGE_KEYS.settingsSchemaVersion, SETTINGS_SCHEMA_VERSION)
    writeSetting(STORAGE_KEYS.datasetId, datasetId)
    writeSetting(STORAGE_KEYS.radiusMeters, radiusMeters)
    writeSetting(STORAGE_KEYS.riskMode, riskMode)
    writeSetting(STORAGE_KEYS.segmentActionFilter, actionFilter)
    writeSetting(STORAGE_KEYS.includeInferred, includeInferred)
    writeSetting(STORAGE_KEYS.showZones, showZones)
    writeSetting(STORAGE_KEYS.showIntersectionZones, showIntersectionZones)
    writeSetting(STORAGE_KEYS.showCrosswalkZones, showCrosswalkZones)
    writeSetting(STORAGE_KEYS.showParkingSpaces, showParkingSpaces)
    writeSetting(STORAGE_KEYS.markedSpacesOnly, markedSpacesOnly)
    writeSetting(STORAGE_KEYS.hideReportedIllegal, hideReportedIllegal)
    writeSetting(STORAGE_KEYS.showInferredCandidates, showInferredCandidates)
    writeSetting(STORAGE_KEYS.useMockLocation, useMockLocation)
    writeSetting(STORAGE_KEYS.favoriteAddresses, favoriteAddresses)
    writeSetting(STORAGE_KEYS.recentAddressSearches, recentAddressSearches)
    writeSetting(STORAGE_KEYS.tripBoardSortMode, tripBoardSortMode)
    writeSetting(STORAGE_KEYS.tripBoardIntentFilter, tripBoardIntentFilter)
    writeSetting(STORAGE_KEYS.tripBoardSuggestionFilter, tripBoardSuggestionFilter)
    writeSetting(STORAGE_KEYS.tripBoardFilters, tripBoardFilters)
    writeSetting(STORAGE_KEYS.tripBoardCollapsedGroups, collapsedSavedPlanGroups)
    writeSetting(STORAGE_KEYS.recommendationRankMode, recommendationRankMode)
    writeSetting(STORAGE_KEYS.routeProfile, selectedRouteProfile)
  }, [
    actionFilter,
    collapsedSavedPlanGroups,
    datasetId,
    favoriteAddresses,
    hideReportedIllegal,
    includeInferred,
    markedSpacesOnly,
    radiusMeters,
    recentAddressSearches,
    recommendationRankMode,
    riskMode,
    selectedRouteProfile,
    showCrosswalkZones,
    showInferredCandidates,
    showIntersectionZones,
    showParkingSpaces,
    showZones,
    tripBoardFilters,
    tripBoardIntentFilter,
    tripBoardSortMode,
    tripBoardSuggestionFilter,
    useMockLocation,
  ])
}
