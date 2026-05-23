import type { MapBounds } from '../map/bounds'
import type { GeocodeResult } from '../map/geocoder'
import type { RouteProfile } from '../map/routing'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { SegmentActionFilter } from './segmentActionFilter'

export interface SharedAppState {
  datasetId: string | null
  filterQuery: string
  searchResult: GeocodeResult | null
  selectedId: string | null
  selectedParkingSpaceKey: string | null
  recommendationRankMode: AddressRecommendationRankMode | null
  routeProfile: RouteProfile | null
  riskMode: RiskMode | null
  mode: TimeMode | null
  radiusMeters: number | null
  actionFilter: SegmentActionFilter | null
  markedSpacesOnly: boolean | null
  hideReportedIllegal: boolean | null
  includeInferred: boolean | null
  activeView: 'LIST' | 'MAP' | null
}

export interface ShareLocationLike {
  origin: string
  pathname: string
  hash?: string
}

export type SharedSearchBounds = MapBounds
