import type { Dispatch, SetStateAction } from 'react'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { SavedPlanRouteEtaSummary } from './savedPlanShareModel'
import type {
  SavedPlanShareSegment,
  SavedPlanShareTarget,
} from './savedPlanSaveTypes'
import type { SavedPlan } from './savedPlanTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { SharedAppState } from './shareState'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import type { UseSavedPlanCurrentShareActionsResult } from './useSavedPlanCurrentShareActions'
import type { UseSavedPlanSaveActionsResult } from './useSavedPlanSaveActions'

export interface UseSavedPlanSaveAndShareActionsOptions {
  buildShareUrlForState: (overrides: Partial<SharedAppState>) => string | null
  currentShareUrl: string | null
  currentSavedPlan: SavedPlan | null
  savedPlans: SavedPlan[]
  datasetId: string | null
  searchLocationLabel: string | null
  filterQuery: string
  recommendationRankMode: AddressRecommendationRankMode
  selectedRouteProfile: RouteProfile
  riskMode: RiskMode
  mode: TimeMode
  radiusMeters: number
  actionFilter: SegmentActionFilter
  selectedSegment: SavedPlanShareSegment | null
  selectedArrivalLabel: string | null
  selectedRouteEta: SavedPlanRouteEtaSummary | null
  bestAddressRecommendation: SavedPlanShareSegment | null
  bestAddressRecommendationTarget: SavedPlanShareTarget | null
  bestAddressRecommendationRouteEta: SavedPlanRouteEtaSummary | null
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}

export interface UseSavedPlanSaveAndShareActionsResult {
  handleSaveListSegment: UseSavedPlanSaveActionsResult['handleSaveListSegment']
  handleSaveBestRecommendationPlan:
    UseSavedPlanSaveActionsResult['handleSaveBestRecommendationPlan']
  handleSaveCurrentPlan: UseSavedPlanSaveActionsResult['handleSaveCurrentPlan']
  handleCopyShareLink: UseSavedPlanCurrentShareActionsResult['handleCopyShareLink']
  handleNativeShare: UseSavedPlanCurrentShareActionsResult['handleNativeShare']
}
