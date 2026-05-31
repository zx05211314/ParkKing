import type { RiskMode } from '../domain/ranking/policy'
import type { SegmentActionFilter } from './segmentActionFilter'

export interface ActiveFilterChip {
  key: string
  label: string
}

interface BuildActiveFilterChipsOptions {
  activeSearchQuery: string
  markedSpacesOnly: boolean
  hideReportedIllegal: boolean
  actionFilter: SegmentActionFilter
  includeInferred: boolean
  radiusMeters: number
  riskMode: RiskMode
  defaultSegmentActionFilter: SegmentActionFilter
  defaultRadiusMeters: number
  defaultRiskMode: RiskMode
  actionFilterLabels: Record<SegmentActionFilter, string>
  riskModeLabels: Record<RiskMode, string>
}

export const buildActiveFilterChips = ({
  activeSearchQuery,
  markedSpacesOnly,
  hideReportedIllegal,
  actionFilter,
  includeInferred,
  radiusMeters,
  riskMode,
  defaultSegmentActionFilter,
  defaultRadiusMeters,
  defaultRiskMode,
  actionFilterLabels,
  riskModeLabels,
}: BuildActiveFilterChipsOptions): ActiveFilterChip[] => {
  const chips: ActiveFilterChip[] = []

  if (activeSearchQuery.length > 0) {
    chips.push({
      key: 'text',
      label: `Text: ${activeSearchQuery}`,
    })
  }
  if (actionFilter !== defaultSegmentActionFilter) {
    chips.push({
      key: 'action',
      label: `Action: ${actionFilterLabels[actionFilter]}`,
    })
  }
  if (markedSpacesOnly) {
    chips.push({
      key: 'spaces',
      label: 'Spaces only',
    })
  }
  if (hideReportedIllegal) {
    chips.push({
      key: 'feedback',
      label: 'Hide illegal',
    })
  }
  if (includeInferred) {
    chips.push({
      key: 'inferred',
      label: 'Include inferred',
    })
  }
  if (radiusMeters !== defaultRadiusMeters) {
    chips.push({
      key: 'radius',
      label: `Radius ${radiusMeters} m`,
    })
  }
  if (riskMode !== defaultRiskMode) {
    chips.push({
      key: 'risk',
      label: `Risk ${riskModeLabels[riskMode]}`,
    })
  }

  return chips
}
