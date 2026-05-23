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
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { SharedAppState } from './shareState'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import type { UseSavedPlanSaveAndShareActionsResult } from './savedPlanSaveAndShareActionTypes'
import type { UseSavedPlanSyncActionsResult } from './useSavedPlanSyncActions'

export interface UseSavedPlanShareActionsOptions {
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
  setReportVersion: Dispatch<SetStateAction<number>>
  setSavedPlanConflictDetailsByUrl: Dispatch<
    SetStateAction<Record<string, SavedPlanConflictFieldDetail[]>>
  >
  setSavedPlanConflictSharedByUrl: Dispatch<SetStateAction<Record<string, SavedPlan>>>
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanShareActionsResult
  extends Pick<
      UseSavedPlanSaveAndShareActionsResult,
      | 'handleSaveListSegment'
      | 'handleSaveBestRecommendationPlan'
      | 'handleSaveCurrentPlan'
      | 'handleCopyShareLink'
      | 'handleNativeShare'
    >,
    Pick<
      UseSavedPlanSyncActionsResult,
      | 'handleAutoRefreshSync'
      | 'handleAutoRefreshSyncResources'
      | 'handleAutoRetrySyncWrites'
      | 'handleAutoRetrySyncWritesNow'
      | 'handleRefreshSync'
      | 'handleRefreshResourceSync'
      | 'handleRetryResourceSync'
      | 'handleRetrySyncWrites'
      | 'isRefreshingSync'
      | 'refreshingResources'
      | 'retryingResources'
    > {}
