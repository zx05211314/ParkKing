import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TripBoardSummaryPanels } from './TripBoardSummaryPanels'
import type {
  SavedPlan,
  SavedPlanIntentGroup,
  SavedPlanMetricLeader,
} from './savedPlanTypes'

const commutePlan: SavedPlan = {
  key: 'plan-2',
  title: 'Office commute plan',
  url: 'https://parkking.example.test/plan-2',
  datasetId: 'xinyi',
  addressLabel: '8 Civic Blvd',
  segmentName: 'Civic Road',
  targetLabel: 'Space B2',
  createdAt: '2026-03-18T09:30:00.000Z',
  pinned: true,
  intent: 'COMMUTE',
  allowedAction: 'PARK',
  parkingSpaceCount: 6,
  tier: 'GREEN',
  walkingDurationSeconds: 240,
  drivingDurationSeconds: 180,
}

const visibleSavedPlanIntentGroups: SavedPlanIntentGroup[] = [
  {
    intent: 'COMMUTE',
    plans: [commutePlan],
    count: 1,
    leader: commutePlan,
  },
]

const savedPlanMetricLeaders: SavedPlanMetricLeader[] = [
  {
    key: 'QUALITY',
    label: 'Best parking quality',
    plan: commutePlan,
  },
]

describe('TripBoardSummaryPanels contract', () => {
  it('renders conflict review, intent snapshot, status actions, and leader snapshots', () => {
    const html = renderToStaticMarkup(
      <TripBoardSummaryPanels
        savedPlanConflictDetailsByUrl={{
          [commutePlan.url]: [
            {
              label: 'Tier',
              keptValue: 'Green',
              sharedValue: 'Yellow',
            },
          ],
        }}
        savedPlanConflictSharedByUrl={{ [commutePlan.url]: commutePlan }}
        savedPlanConflictUrls={[commutePlan.url]}
        savedPlanConflictResolutionHistoryCount={1}
        visibleConflictedSavedPlans={[commutePlan]}
        visibleSavedPlanUrls={[commutePlan.url]}
        visibleSavedPlanIntentGroups={visibleSavedPlanIntentGroups}
        visibleSavedPlanIntentLeaders={[commutePlan]}
        tripBoardIntentFilter="ALL"
        tripBoardStatusSummary="Showing 1 visible plan"
        hasTripBoardSearch={true}
        hasActiveTripBoardFilters={true}
        hiddenCollapsedSavedPlanCount={2}
        savedPlanMetricLeaders={savedPlanMetricLeaders}
        topVisibleSavedPlan={commutePlan}
        currentShareUrl={commutePlan.url}
        comparedSavedPlanUrls={[]}
        onCompareSavedPlanIntentLeaders={() => {}}
        onCopySavedPlanIntentLeaderLinks={() => {}}
        onOpenSavedPlanIntentTop={() => {}}
        onCompareSavedPlanIntentTop={() => {}}
        onCopySavedPlanIntentLinks={() => {}}
        onSetTripBoardIntentFilter={() => {}}
        onClearTripBoardSearch={() => {}}
        onResetTripBoardFilters={() => {}}
        onExpandAllSavedPlanGroups={() => {}}
        onClearAllSavedPlanConflicts={() => {}}
        onUndoSavedPlanConflictResolution={() => {}}
        onKeepVisibleSavedPlanConflictsLocal={() => {}}
        onResolveVisibleSavedPlanConflictsWithShared={() => {}}
        onResolveSavedPlanConflictWithShared={() => {}}
        onClearSavedPlanConflict={() => {}}
        onCompareConflictedSavedPlans={() => {}}
        onOpenSavedPlan={() => {}}
        onToggleSavedPlanCompare={() => {}}
        onCopySavedPlanLink={() => {}}
        onOpenTopSavedPlan={() => {}}
        onCopyTopSavedPlanLink={() => {}}
        getSavedPlanQualitySummary={() => ['Park ok', '6 spaces']}
        getSavedPlanEtaSummary={() => ['Walk 4 min', 'Drive 3 min']}
        getSavedPlanSettingChips={() => ['Walk rank']}
        formatSavedPlanTimestamp={() => 'Mar 18'}
      />,
    )

    expect(html).toContain('Conflict review')
    expect(html).toContain('Compare top conflicts')
    expect(html).toContain('Use shared for visible')
    expect(html).toContain('Intent snapshot')
    expect(html).toContain('Compare leaders')
    expect(html).toContain('Copy leader links')
    expect(html).toContain('Showing 1 visible plan')
    expect(html).toContain('Clear search')
    expect(html).toContain('Clear filters')
    expect(html).toContain('Show hidden groups')
    expect(html).toContain('Trip board snapshot')
    expect(html).toContain('Best parking quality')
    expect(html).toContain('Top board match')
    expect(html).toContain('Office commute plan')
    expect(html).toContain('Pinned')
    expect(html).toContain('Current')
  })
})
