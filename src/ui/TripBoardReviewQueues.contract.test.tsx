import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TripBoardReviewQueues } from './TripBoardReviewQueues'
import type { SavedPlan, SavedPlanIntentSuggestion } from './savedPlanTypes'

const reviewPlan: SavedPlan = {
  key: 'plan-untagged-1',
  title: 'Evening backup option',
  url: 'https://parkking.example.test/plan-untagged-1',
  datasetId: 'daan',
  addressLabel: '12 Lane 3',
  segmentName: 'Lane 3',
  targetLabel: 'Space A1',
  createdAt: '2026-03-18T09:30:00.000Z',
  pinned: false,
}

const suggestion: SavedPlanIntentSuggestion = {
  intent: 'BACKUP',
  reason: 'Lower parking quality and slower ETA make this a better fallback option.',
}

describe('TripBoardReviewQueues contract', () => {
  it('renders bulk tagging, suggested review, and manual review paths', () => {
    const html = renderToStaticMarkup(
      <TripBoardReviewQueues
        visibleSavedPlans={[reviewPlan]}
        visibleSavedPlanIntentSummary={{
          COMMUTE: 0,
          PICKUP: 0,
          BACKUP: 0,
          taggedCount: 0,
          unassignedCount: 1,
        }}
        visibleUntaggedSavedPlanSuggestionSummary={{
          COMMUTE: 0,
          PICKUP: 0,
          BACKUP: 1,
          totalCount: 1,
        }}
        visibleUntaggedSavedPlanSuggestionSummaryText="1 backup suggestion is ready."
        visibleSuggestedUntaggedSavedPlanQueue={[reviewPlan]}
        visibleSuggestedUntaggedSavedPlans={[reviewPlan, { ...reviewPlan, url: 'https://parkking.example.test/plan-untagged-2', key: 'plan-untagged-2', title: 'Second suggestion' }]}
        visibleManualUntaggedSavedPlanQueue={[reviewPlan]}
        visibleManualUntaggedSavedPlans={[reviewPlan, { ...reviewPlan, url: 'https://parkking.example.test/plan-untagged-3', key: 'plan-untagged-3', title: 'Manual review plan' }]}
        visibleUntaggedSavedPlanSuggestionByUrl={new Map([[reviewPlan.url, suggestion]])}
        topSuggestedUntaggedSavedPlan={reviewPlan}
        topManualUntaggedSavedPlan={reviewPlan}
        tripBoardIntentFilter="ALL"
        tripBoardSuggestionFilter="ALL"
        currentShareUrl={reviewPlan.url}
        onApplyVisibleSavedPlanIntentSuggestions={() => {}}
        onApplyVisibleSavedPlanIntentSuggestionsForIntent={() => {}}
        onSetVisibleSavedPlanIntent={() => {}}
        onSetTripBoardIntentFilter={() => {}}
        onOpenTopSuggestedUntaggedSavedPlan={() => {}}
        onCompareSuggestedUntaggedSavedPlans={() => {}}
        onShowAllUntaggedSavedPlans={() => {}}
        onOpenSavedPlan={() => {}}
        onSetSavedPlanIntent={() => {}}
        onOpenTopManualUntaggedSavedPlan={() => {}}
        onCompareManualUntaggedSavedPlans={() => {}}
        getSavedPlanQualitySummary={() => ['Park ok']}
        getSavedPlanEtaSummary={() => ['Walk 4 min']}
        formatSavedPlanIntentSummary={() => '1 unassigned'}
        formatSuggestionActionLabel={() => 'Apply backup'}
      />,
    )

    expect(html).toContain('Bulk tag visible plans')
    expect(html).toContain('Apply suggestions')
    expect(html).toContain('Show untagged')
    expect(html).toContain('Suggested queue')
    expect(html).toContain('Open top suggested')
    expect(html).toContain('Compare top 2 suggested')
    expect(html).toContain('Suggest Backup')
    expect(html).toContain('Use Backup')
    expect(html).toContain('Manual review queue')
    expect(html).toContain('Open top manual')
    expect(html).toContain('Compare top 2 manual')
    expect(html).toContain('Current')
  })
})
