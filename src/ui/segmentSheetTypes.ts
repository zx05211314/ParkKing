import type { EvaluatedSegment } from './types'
import type { RankBreakdown, RiskMode } from '../domain/ranking/rank'
import type { NavigationLinks } from '../map/navigation'
import type { RouteProfile } from '../map/routing'
import type { ReportStatus, SegmentReport } from '../feedback/reports'

export interface SegmentRouteEta {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}

export interface SegmentParkingSpaceOption {
  key: string
  label: string
  description: string
  metadata?: string[]
  distanceMeters: number | null
  active: boolean
}

export interface SegmentSheetProps {
  segment: EvaluatedSegment | null
  nowHHMM: string
  onClose: () => void
  distanceMeters?: number | null
  walkDistanceMeters?: number | null
  routeEta?: SegmentRouteEta | null
  rankBreakdown?: RankBreakdown | null
  riskMode?: RiskMode
  latestReport?: SegmentReport | null
  onReport?: (status: ReportStatus, note: string) => void
  navigationLinks?: NavigationLinks | null
  navigationSourceLabel?: string | null
  arrivalHint?: string | null
  navigationTargetKind?: 'SEGMENT' | 'PARKING_SPACE'
  routeProfile?: RouteProfile
  routeStatus?: 'idle' | 'loading' | 'ready' | 'error'
  routeError?: string | null
  onRouteProfileChange?: (profile: RouteProfile) => void
  parkingSpaceOptions?: SegmentParkingSpaceOption[]
  parkingSpaceOptionCount?: number
  parkingSpaceTargetMode?: 'AUTO' | 'MANUAL'
  onSelectParkingSpace?: (key: string | null) => void
}
