import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SegmentSheet } from './SegmentSheet'
import { getRankBreakdown } from '../domain/ranking/rank'
import { rankingGoldenSegments } from '../tests/fixtures/ranking_golden'

const renderSheet = (segmentId: string) => {
  const segment = rankingGoldenSegments.find((item) => item.id === segmentId) ?? null
  if (!segment) {
    throw new Error(`Missing fixture segment ${segmentId}`)
  }
  const breakdown = getRankBreakdown(segment, segment.distanceMeters, 'NEUTRAL')
  return renderToStaticMarkup(
    <SegmentSheet
      segment={segment}
      nowHHMM="12:00"
      onClose={() => {}}
      distanceMeters={segment.distanceMeters ?? null}
      rankBreakdown={breakdown}
      riskMode="NEUTRAL"
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
})
