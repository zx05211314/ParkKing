import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SegmentList } from './SegmentList'
import type { SegmentListItem } from './segmentListTypes'

const segment: SegmentListItem = {
  id: 'seg-1',
  name: 'Main Road East',
  curbMarking: 'YELLOW',
  confidence: 'HIGH',
  path: [
    [121.56, 25.03],
    [121.561, 25.03],
  ],
  tier: 'GREEN',
  allowedNow: 'PARK',
  reasonCodes: ['PARKING_SPACE_EVIDENCE'],
  reasons: [],
  timeWindows: [],
  coverageConfidence: 'HIGH',
  overrideConfidence: 'HIGH',
  finalConfidence: 'HIGH',
  sourceReliability: 'HIGH',
  dataFreshnessDays: 3,
  parkingSpaceCount: 4,
  distanceMeters: 120,
  recommendationRank: 1,
  recommendedTargetLabel: 'A-17',
  recommendedTargetDescription: 'Marked parking space near the west end of this curb segment',
  recommendedTargetMetadata: ['Open', 'Paid 20 TWD/hr'],
  recommendedTargetKind: 'PARKING_SPACE',
  recommendedWalkDistanceMeters: 96,
  recommendedWalkingDurationSeconds: 240,
  recommendedDrivingDurationSeconds: 120,
  quickActionTargetKey: 'space-a17',
  quickActionNavigationLinks: {
    walking: 'https://maps.example.test/walk',
    driving: 'https://maps.example.test/drive',
  },
}

describe('SegmentList contract', () => {
  it('renders exact target details when recommendation metadata is present', () => {
    const html = renderToStaticMarkup(
      <SegmentList
        segments={[segment]}
        selectedId={null}
        onSelect={() => {}}
        onSave={() => {}}
        sortSummary="Sorted by walk ETA when available"
      />,
    )

    expect(html).toContain('Best exact target')
    expect(html).toContain('Sorted by walk ETA when available')
    expect(html).toContain('Space-backed')
    expect(html).toContain('Target: A-17 (marked space) | Walk ~96 m')
    expect(html).toContain('Marked parking space near the west end of this curb segment')
    expect(html).toContain('Walk 4 min | Drive 2 min')
    expect(html).toContain('Open | Paid 20 TWD/hr')
    expect(html).toContain('>Open<')
    expect(html).toContain('href="https://maps.example.test/walk"')
    expect(html).toContain('href="https://maps.example.test/drive"')
    expect(html).toContain('>Save<')
  })

  it('reports when the visible list is capped for a large district', () => {
    const html = renderToStaticMarkup(
      <SegmentList
        segments={[segment]}
        totalCount={1200}
        displayLimit={500}
        selectedId={null}
        onSelect={() => {}}
      />,
    )

    expect(html).toContain('1 shown of 1200 total')
    expect(html).toContain('Showing first 500 results.')
  })
})
