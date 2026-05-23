import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  TripBoardSavedPlanGroups,
} from './TripBoardSavedPlanGroups'
import type { SavedPlan, SavedPlanGroup, SavedPlanIntent } from './savedPlanTypes'

const plan: SavedPlan = {
  key: 'plan-1',
  title: 'Home commute fallback',
  url: 'https://parkking.example.test/plan-1',
  datasetId: 'daan',
  addressLabel: '123 Test Street',
  segmentName: 'Main Road',
  targetLabel: 'Space A1',
  createdAt: '2026-03-18T08:00:00.000Z',
  allowedAction: 'PARK',
  parkingSpaceCount: 4,
  tier: 'GREEN',
  walkingDurationSeconds: 240,
  drivingDurationSeconds: 120,
}

const group: SavedPlanGroup = {
  key: 'daan',
  plans: [plan],
  count: 1,
  pinnedCount: 0,
}

const formatSavedPlanIntentSummary = (
  counts: Record<SavedPlanIntent, number>,
  unassigned: number,
) =>
  [`Commute ${counts.COMMUTE}`, `Pickup ${counts.PICKUP}`, `Backup ${counts.BACKUP}`, `Untagged ${unassigned}`]
    .join(' | ')

describe('TripBoardSavedPlanGroups contract', () => {
  it('renders group-level actions, suggestion controls, and saved-plan conflict actions', () => {
    const html = renderToStaticMarkup(
      <TripBoardSavedPlanGroups
        savedPlans={[plan]}
        savedPlanConflictDetailsByUrl={{
          [plan.url]: [
            {
              label: 'Title',
              keptValue: 'Local title',
              sharedValue: 'Shared title',
            },
          ],
        }}
        savedPlanConflictSharedByUrl={{ [plan.url]: plan }}
        savedPlanConflictUrls={[plan.url]}
        visibleSavedPlans={[plan]}
        visibleSavedPlanGroups={[group]}
        tripBoardQuery=""
        tripBoardIntentFilter="ALL"
        tripBoardSuggestionFilter="ALL"
        hasActiveTripBoardFilters={false}
        datasetLabelById={new Map([['daan', 'Daan District']])}
        collapsedSavedPlanGroups={[]}
        comparedSavedPlanUrls={[]}
        currentShareUrl={plan.url}
        editingSavedPlanUrl={null}
        savedPlanDraftTitle=""
        savedPlanMetricLeaderBadges={new Map([[plan.url, ['Best walk']]])}
        onSavedPlanDraftTitleChange={() => {}}
        onCommitSavedPlanRename={() => {}}
        onCancelSavedPlanRename={() => {}}
        onOpenSavedPlan={() => {}}
        onToggleSavedPlanCompare={() => {}}
        onStartSavedPlanRename={() => {}}
        onSetSavedPlanIntent={() => {}}
        onToggleSavedPlanPinned={() => {}}
        onResolveSavedPlanConflictWithShared={() => {}}
        onClearSavedPlanConflict={() => {}}
        onCopySavedPlanLink={() => {}}
        onRemoveSavedPlan={() => {}}
        onOpenSavedPlanGroupTop={() => {}}
        onCompareSavedPlanGroupTop={() => {}}
        onCompareSavedPlanGroupLeaders={() => {}}
        onPinSavedPlanGroupTop={() => {}}
        onToggleSavedPlanGroupCollapsed={() => {}}
        onCopySavedPlanGroupLinks={() => {}}
        onApplySavedPlanGroupIntentSuggestions={() => {}}
        onApplySavedPlanGroupIntentSuggestionsForIntent={() => {}}
        onSetSavedPlanGroupIntent={() => {}}
        formatSavedPlanTimestamp={() => 'Mar 18'}
        formatSavedPlanIntentSummary={formatSavedPlanIntentSummary}
        formatSuggestionActionLabel={(intent, count) => `${intent} suggested (${count})`}
        getSavedPlanQualitySummary={() => ['Park ok', '4 spaces']}
        getSavedPlanEtaSummary={() => ['Walk 4 min', 'Drive 2 min']}
        getSavedPlanSettingChips={() => ['Walk rank']}
      />,
    )

    expect(html).toContain('Daan District')
    expect(html).toContain('1 saved plan | 1 suggested')
    expect(html).toContain('Open best')
    expect(html).toContain('Compare leaders')
    expect(html).toContain('Apply suggestions')
    expect(html).toContain('BACKUP suggested (1)')
    expect(html).toContain('Clear intent')
    expect(html).toContain('Best walk')
    expect(html).toContain('Merged conflict')
    expect(html).toContain('Conflict Title: kept Local title / shared Shared title')
    expect(html).toContain('>Use shared<')
    expect(html).toContain('>Keep local<')
    expect(html).toContain('>Copy link<')
    expect(html).toContain('>Remove<')
  })
})
