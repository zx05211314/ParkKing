import type { TimeMode } from '../domain/rules/time'
import type { RiskMode } from '../domain/ranking/policy'
import type { SegmentActionFilter } from './segmentActionFilter'

export interface RuntimeSettingsPanelProps {
  mode: TimeMode
  nowHHMM: string
  onModeChange: (mode: TimeMode) => void
  useMockLocation: boolean
  onUseMockLocationChange: (value: boolean) => void
  locationLabel: string
  radiusMeters: number
  onRadiusChange: (value: string) => void
  riskMode: RiskMode
  riskModeLabels: Record<RiskMode, string>
  onRiskModeChange: (value: RiskMode) => void
  showZones: boolean
  onShowZonesChange: (value: boolean) => void
  showIntersectionZones: boolean
  onShowIntersectionZonesChange: (value: boolean) => void
  showCrosswalkZones: boolean
  onShowCrosswalkZonesChange: (value: boolean) => void
  showParkingSpaces: boolean
  onShowParkingSpacesChange: (value: boolean) => void
  parkingSpaceCount: number
  actionFilteredMarkedSpaceSegmentCount: number
  markedSpacesOnly: boolean
  onMarkedSpacesOnlyChange: (value: boolean) => void
  actionFilter: SegmentActionFilter
  actionFilterHiddenCount: number
  onActionFilterChange: (value: SegmentActionFilter) => void
  hideReportedIllegal: boolean
  illegalFeedbackHiddenCount: number
  onHideReportedIllegalChange: (value: boolean) => void
  showInferredCandidates: boolean
  onShowInferredCandidatesChange: (value: boolean) => void
  includeInferred: boolean
  onIncludeInferredChange: (value: boolean) => void
}
