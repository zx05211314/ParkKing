import type { MainWorkspaceProps } from './appPresentationBuilderTypes'
import type { BuildMainWorkspacePropsOptions } from './buildMainWorkspaceTypes'

export const buildSegmentListProps = ({
  displaySegments,
  displaySegmentTotalCount,
  displaySegmentLimit,
  selectedId,
  onSelectListSegment,
  onNavigateFromListSegment,
  onSaveListSegment,
  reportsBySegment,
  emptySegmentsMessage,
  listSortSummary,
  hasActiveFilters,
  onResetViewFilters,
}: BuildMainWorkspacePropsOptions): MainWorkspaceProps['listProps'] => ({
  segments: displaySegments,
  totalCount: displaySegmentTotalCount,
  displayLimit: displaySegmentLimit,
  selectedId,
  onSelect: onSelectListSegment,
  onNavigate: onNavigateFromListSegment,
  onSave: onSaveListSegment,
  reports: reportsBySegment,
  emptyMessage: emptySegmentsMessage,
  sortSummary: listSortSummary,
  emptyActionLabel: hasActiveFilters ? 'Reset filters' : null,
  onEmptyAction: hasActiveFilters ? onResetViewFilters : null,
})
