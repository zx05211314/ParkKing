import { useState } from 'react'
import type { RoutePathEntry, RouteProfile } from '../map/routing'
import { readSetting, STORAGE_KEYS } from '../settings'
import {
  isRecommendationRankMode,
  isRouteProfile,
} from './appPresentationConfig'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type {
  SegmentRouteEta,
  UseAppRouteUiStateOptions,
} from './appUiStateTypes'

export const useAppRouteUiState = ({
  initialSharedState,
  defaultRecommendationRankMode,
  defaultRouteProfile,
}: UseAppRouteUiStateOptions) => {
  const [routeEtaBySegmentId, setRouteEtaBySegmentId] = useState<
    Record<string, SegmentRouteEta>
  >({})
  const [routeEtaStatus, setRouteEtaStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [routeEtaError, setRouteEtaError] = useState<string | null>(null)
  const [recommendationRankMode, setRecommendationRankMode] =
    useState<AddressRecommendationRankMode>(() => {
      if (initialSharedState.recommendationRankMode) {
        return initialSharedState.recommendationRankMode
      }
      const stored = readSetting<unknown>(
        STORAGE_KEYS.recommendationRankMode,
        defaultRecommendationRankMode,
      )
      return isRecommendationRankMode(stored)
        ? stored
        : defaultRecommendationRankMode
    })
  const [selectedRouteProfile, setSelectedRouteProfile] = useState<RouteProfile>(() => {
    if (initialSharedState.routeProfile) {
      return initialSharedState.routeProfile
    }
    const stored = readSetting<unknown>(STORAGE_KEYS.routeProfile, defaultRouteProfile)
    return isRouteProfile(stored) ? stored : defaultRouteProfile
  })
  const [selectedRoutePath, setSelectedRoutePath] = useState<RoutePathEntry | null>(null)
  const [selectedRouteStatus, setSelectedRouteStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [selectedRouteError, setSelectedRouteError] = useState<string | null>(null)
  const [selectedTargetRouteEta, setSelectedTargetRouteEta] =
    useState<SegmentRouteEta | null>(null)
  const [selectedParkingSpaceKeyBySegment, setSelectedParkingSpaceKeyBySegment] =
    useState<Record<string, string>>(() =>
      initialSharedState.selectedId && initialSharedState.selectedParkingSpaceKey
        ? {
            [initialSharedState.selectedId]: initialSharedState.selectedParkingSpaceKey,
          }
        : {},
    )

  return {
    recommendationRankMode,
    routeEtaBySegmentId,
    routeEtaError,
    routeEtaStatus,
    selectedParkingSpaceKeyBySegment,
    selectedRouteError,
    selectedRoutePath,
    selectedRouteProfile,
    selectedRouteStatus,
    selectedTargetRouteEta,
    setRecommendationRankMode,
    setRouteEtaBySegmentId,
    setRouteEtaError,
    setRouteEtaStatus,
    setSelectedParkingSpaceKeyBySegment,
    setSelectedRouteError,
    setSelectedRoutePath,
    setSelectedRouteProfile,
    setSelectedRouteStatus,
    setSelectedTargetRouteEta,
  }
}
