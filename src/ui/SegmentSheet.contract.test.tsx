import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SegmentSheet } from './SegmentSheet'
import { getRankBreakdown } from '../domain/ranking/rank'
import {
  rankingGoldenSegments,
  type RankingFixtureSegment,
} from '../tests/fixtures/ranking_golden'

const renderSheet = (segmentOrId: string | RankingFixtureSegment) => {
  const segment =
    typeof segmentOrId === 'string'
      ? rankingGoldenSegments.find((item) => item.id === segmentOrId) ?? null
      : segmentOrId
  if (!segment) {
    throw new Error(
      `Missing fixture segment ${typeof segmentOrId === 'string' ? segmentOrId : 'custom'}`,
    )
  }
  const breakdown = getRankBreakdown(segment, segment.distanceMeters, 'NEUTRAL')
  return renderToStaticMarkup(
    <SegmentSheet
      segment={segment}
      nowHHMM="12:00"
      onClose={() => {}}
      distanceMeters={segment.distanceMeters ?? null}
      walkDistanceMeters={segment.distanceMeters ?? null}
      routeEta={{
        walkingDistanceMeters: 420,
        walkingDurationSeconds: 320,
        walkingEstimated: false,
        drivingDistanceMeters: 1100,
        drivingDurationSeconds: 180,
        drivingEstimated: false,
      }}
      rankBreakdown={breakdown}
      riskMode="NEUTRAL"
      navigationLinks={{
        walking: 'https://example.com/walk',
        driving: 'https://example.com/drive',
      }}
      navigationSourceLabel="Pinned location: Taipei 101"
      arrivalHint="West end of this curb segment"
      navigationTargetKind="PARKING_SPACE"
      parkingSpaceOptions={[
        {
          key: 'space-1',
          label: 'A-17',
          description: 'Marked parking space near the west end of this curb segment',
          metadata: ['Open', 'Paid 20 TWD/hr'],
          distanceMeters: 42,
          active: true,
        },
      ]}
      parkingSpaceOptionCount={3}
      parkingSpaceTargetMode="MANUAL"
      onSelectParkingSpace={() => {}}
    />,
  )
}

describe('SegmentSheet contract', () => {
  it('renders triggered rules list when reason codes exist', () => {
    const html = renderSheet('seg-hydrant-near')
    expect(html).toContain('Triggered rules')
    expect(html).toContain('ZONE_HYDRANT')
  })

  it('renders penalties and bonuses labels', () => {
    const html = renderSheet('seg-risk-dense')
    expect(html).toContain('Penalties &amp; bonuses')
    expect(html).toContain('Zone density penalty')
    expect(html).toContain('Total score')
  })

  it('renders confidence and freshness even when unknown', () => {
    const html = renderSheet('seg-freshness-null')
    expect(html).toContain('Final confidence')
    expect(html).toContain('Freshness')
    expect(html).toContain('Unknown')
  })

  it('explains when a green parking result is backed by marked-space evidence', () => {
    const html = renderSheet({
      ...rankingGoldenSegments[0],
      id: 'seg-parking-evidence-green',
      name: 'Parking evidence green',
      tier: 'GREEN',
      allowedNow: 'PARK',
      finalConfidence: 'HIGH',
      dataFreshnessDays: 900,
      parkingSpaceCount: 4,
      reasonCodes: [
        'RULE_YELLOW_NIGHT_PARK_POSSIBLE',
        'PARKING_SPACE_EVIDENCE',
        'DATA_FRESHNESS_STALE',
      ],
    })
    expect(html).toContain('Why this is green')
    expect(html).toContain(
      'High-confidence parking backed by mapped official marked spaces along this curb, even though the curb-paint timestamp is old.',
    )
  })

  it('renders go-there actions when navigation links are available', () => {
    const html = renderSheet('seg-risk-dense')
    expect(html).toContain('Go there')
    expect(html).toContain('Target: Marked space')
    expect(html).toContain('Arrival: West end of this curb segment')
    expect(html).toContain('Exact marked spaces')
    expect(html).toContain('Manual target locked to a marked space.')
    expect(html).toContain('Showing 1 of 3 matched spaces.')
    expect(html).toContain('A-17')
    expect(html).toContain('Open | Paid 20 TWD/hr')
    expect(html).toContain('Walk there')
    expect(html).toContain('Drive there')
    expect(html).toContain('Walk ETA')
    expect(html).toContain('Drive ETA')
  })
})
