import type { SegmentReport } from '../feedback/reports'
import type { NavigationLinks } from '../map/navigation'
import type { EvaluatedSegment } from './types'

export interface SegmentListItem extends EvaluatedSegment {
  distanceMeters?: number
  rankScore?: number
  recommendationRank?: number
  recommendedTargetLabel?: string | null
  recommendedTargetDescription?: string | null
  recommendedTargetMetadata?: string[] | null
  recommendedTargetKind?: 'SEGMENT' | 'PARKING_SPACE' | null
  recommendedWalkDistanceMeters?: number | null
  recommendedWalkingDurationSeconds?: number | null
  recommendedWalkingEstimated?: boolean
  recommendedDrivingDurationSeconds?: number | null
  recommendedDrivingEstimated?: boolean
  quickActionTargetKey?: string | null
  quickActionTargetLabel?: string | null
  quickActionTargetKind?: 'SEGMENT' | 'PARKING_SPACE' | null
  quickActionNavigationLinks?: NavigationLinks | null
}

export interface SegmentListProps {
  segments: SegmentListItem[]
  totalCount?: number
  displayLimit?: number
  selectedId: string | null
  onSelect: (segment: SegmentListItem) => void
  onNavigate?: ((segment: SegmentListItem, mode: 'walking' | 'driving') => void) | null
  onSave?: ((segment: SegmentListItem) => void) | null
  reports?: Record<string, SegmentReport>
  emptyMessage?: string
  sortSummary?: string | null
  emptyActionLabel?: string | null
  onEmptyAction?: (() => void) | null
}
