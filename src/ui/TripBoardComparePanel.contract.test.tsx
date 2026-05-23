import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TripBoardComparePanel } from './TripBoardComparePanel'
import type { SavedPlan } from './savedPlanTypes'

const leftPlan: SavedPlan = {
  key: 'compare-left',
  title: 'Office west plan',
  url: 'https://parkking.example.test/compare-left',
  datasetId: 'xinyi',
  addressLabel: '8 Civic Blvd',
  segmentName: 'Civic West',
  targetLabel: 'Space A1',
  createdAt: '2026-03-18T09:30:00.000Z',
  pinned: true,
  intent: 'COMMUTE',
}

const rightPlan: SavedPlan = {
  key: 'compare-right',
  title: 'Office east plan',
  url: 'https://parkking.example.test/compare-right',
  datasetId: 'xinyi',
  addressLabel: '10 Civic Blvd',
  segmentName: 'Civic East',
  targetLabel: 'Space B2',
  createdAt: '2026-03-18T10:00:00.000Z',
  intent: 'BACKUP',
}

describe('TripBoardComparePanel contract', () => {
  it('renders compare header, cards, summary, and table', () => {
    const html = renderToStaticMarkup(
      <TripBoardComparePanel
        comparedSavedPlans={[leftPlan, rightPlan]}
        currentShareUrl={leftPlan.url}
        tripBoardSortMode="RECENT"
        tripBoardSortModeLabels={{
          RECENT: 'Recent',
          WALK_ETA: 'Walk ETA',
          DRIVE_ETA: 'Drive ETA',
          QUALITY: 'Parking quality',
        }}
        comparedSavedPlanLeader={leftPlan}
        savedPlanComparisonHighlights={[
          {
            label: 'Walk ETA',
            winner: 'left',
            summary: 'Office west plan is faster on foot.',
          },
        ]}
        savedPlanComparisonRows={[
          {
            label: 'Tier',
            left: 'Green',
            right: 'Yellow',
            same: false,
          },
        ]}
        compareBoardSelectionLength={2}
        onCopyComparedSavedPlanLinks={() => {}}
        onApplyVisibleSavedPlansToCompare={() => {}}
        onClearComparedSavedPlans={() => {}}
        onOpenSavedPlan={() => {}}
        onCopySavedPlanLink={() => {}}
        onToggleSavedPlanCompare={() => {}}
        onOpenComparedSavedPlanLeader={() => {}}
        onPinComparedSavedPlanLeader={() => {}}
        getSavedPlanQualitySummary={() => ['Park ok']}
        getSavedPlanEtaSummary={() => ['Walk 4 min']}
        getSavedPlanSettingChips={() => ['Walk rank']}
        formatSavedPlanTimestamp={() => 'Mar 18'}
      />,
    )

    expect(html).toContain('Compare plans')
    expect(html).toContain('Copy compare links')
    expect(html).toContain('Clear compare')
    expect(html).toContain('Office west plan')
    expect(html).toContain('Office east plan')
    expect(html).toContain('Pinned')
    expect(html).toContain('Current')
    expect(html).toContain('Compare summary')
    expect(html).toContain('Open leader')
    expect(html).toContain('Leader pinned')
    expect(html).toContain('Walk ETA')
    expect(html).toContain('Tier')
  })
})
