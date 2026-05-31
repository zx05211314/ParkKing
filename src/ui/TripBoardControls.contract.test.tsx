import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TripBoardControls } from './TripBoardControls'

describe('TripBoardControls contract', () => {
  it('renders rankings, actions, search, and filter controls', () => {
    const html = renderToStaticMarkup(
      <TripBoardControls
        savedPlansCount={2}
        tripBoardSortMode="RECENT"
        tripBoardSortModeLabels={{
          RECENT: 'Recent',
          WALK_ETA: 'Walk ETA',
          DRIVE_ETA: 'Drive ETA',
          QUALITY: 'Parking quality',
        }}
        onTripBoardSortModeChange={() => {}}
        tripBoardIntentFilter="ALL"
        tripBoardIntentFilterLabels={{
          ALL: 'All',
          COMMUTE: 'Commute',
          PICKUP: 'Pickup',
          BACKUP: 'Backup',
          UNTAGGED: 'Untagged',
        }}
        savedPlanIntents={['COMMUTE', 'PICKUP', 'BACKUP']}
        onSetTripBoardIntentFilter={() => {}}
        visibleSavedPlanIntentSummary={{
          COMMUTE: 0,
          PICKUP: 0,
          BACKUP: 0,
          taggedCount: 0,
          unassignedCount: 1,
        }}
        tripBoardSuggestionFilter="ALL"
        tripBoardSuggestionFilterLabels={{
          ALL: 'All',
          SUGGESTED: 'Suggested only',
          MANUAL: 'Manual only',
        }}
        tripBoardSuggestionFilterSummary={{
          ALL: 3,
          SUGGESTED: 2,
          MANUAL: 1,
        }}
        onSetTripBoardSuggestionFilter={() => {}}
        hasTopVisibleSavedPlan={true}
        onOpenTopSavedPlan={() => {}}
        onCopyTopSavedPlanLink={() => {}}
        compareBoardActionLabel="Compare visible"
        compareBoardSelectionLength={2}
        onApplyVisibleSavedPlansToCompare={() => {}}
        canPinTopSavedPlan={true}
        onPinTopSavedPlan={() => {}}
        onTriggerSavedPlanImport={() => {}}
        onExportSavedPlans={() => {}}
        hasExpandedVisibleSavedPlanGroups={true}
        hasCollapsedVisibleSavedPlanGroups={true}
        onCollapseAllSavedPlanGroups={() => {}}
        onExpandAllSavedPlanGroups={() => {}}
        onClearSavedPlans={() => {}}
        savedPlanImportRef={{ current: null }}
        onImportSavedPlans={() => {}}
        tripBoardQuery="office"
        onTripBoardQueryChange={() => {}}
        tripBoardFilterLabels={{
          parkOnly: 'Park ok only',
          markedSpacesOnly: 'Has marked spaces',
          etaReadyOnly: 'ETA ready',
          pinnedOnly: 'Pinned only',
          conflictedOnly: 'Conflicts only',
        }}
        tripBoardFilters={{
          parkOnly: true,
          markedSpacesOnly: false,
          etaReadyOnly: false,
          pinnedOnly: false,
          conflictedOnly: true,
        }}
        onToggleTripBoardFilter={() => {}}
        hasActiveTripBoardFilters={true}
        onResetTripBoardFilters={() => {}}
      >
        <div>Compare plans</div>
      </TripBoardControls>,
    )

    expect(html).toContain('Trip board')
    expect(html).toContain('Sort by')
    expect(html).toContain('Intent')
    expect(html).toContain('Review')
    expect(html).toContain('Open top match')
    expect(html).toContain('Copy top link')
    expect(html).toContain('Import')
    expect(html).toContain('Export')
    expect(html).toContain('Compare plans')
    expect(html).toContain('Search saved plans')
    expect(html).toContain('Park ok only')
    expect(html).toContain('Conflicts only')
    expect(html).toContain('Clear filters')
  })
})
