import { describe, expect, it } from 'vitest'
import { applyRankingPolicy } from './policy'
import { getRankBreakdown, type RiskMode } from './rank'
import { rankingGoldenSegments } from '../../tests/fixtures/ranking_golden'

const riskModes: RiskMode[] = ['CONSERVATIVE', 'NEUTRAL', 'AGGRESSIVE']
const radii = [600, 300]

const summarizeTop = (segments: Array<{ id: string; rankScore: number; reasonCodes: string[] }>) =>
  segments.slice(0, 10).map((segment) => ({
    id: segment.id,
    score: Number(segment.rankScore.toFixed(3)),
    reasons: segment.reasonCodes.slice(0, 2),
  }))

describe('ranking golden fixtures', () => {
  it('excludes segments outside radius cutoff', () => {
    const ranked600 = applyRankingPolicy(rankingGoldenSegments, {
      includeInferred: true,
      radiusMeters: 600,
      riskMode: 'NEUTRAL',
    })
    const ranked300 = applyRankingPolicy(rankingGoldenSegments, {
      includeInferred: true,
      radiusMeters: 300,
      riskMode: 'NEUTRAL',
    })

    expect(ranked600.find((segment) => segment.id === 'seg-crosswalk-out')).toBeUndefined()
    expect(ranked300.find((segment) => segment.id === 'seg-busstop-edge-out')).toBeUndefined()
    expect(ranked300.find((segment) => segment.id === 'seg-distance-undef')).toBeDefined()
  })

  it('includes expected breakdown keys for known segments', () => {
    const inferred = rankingGoldenSegments.find(
      (segment) => segment.id === 'seg-inferred-close',
    )
    const riskDense = rankingGoldenSegments.find(
      (segment) => segment.id === 'seg-risk-dense',
    )
    const freshnessUnknown = rankingGoldenSegments.find(
      (segment) => segment.id === 'seg-freshness-null',
    )
    const distanceUnknown = rankingGoldenSegments.find(
      (segment) => segment.id === 'seg-distance-undef',
    )

    if (!inferred || !riskDense || !freshnessUnknown || !distanceUnknown) {
      throw new Error('Missing golden fixture segment')
    }

    const inferredBreakdown = getRankBreakdown(inferred, inferred.distanceMeters, 'NEUTRAL')
    const riskBreakdown = getRankBreakdown(riskDense, riskDense.distanceMeters, 'NEUTRAL')
    const freshBreakdown = getRankBreakdown(
      freshnessUnknown,
      freshnessUnknown.distanceMeters,
      'NEUTRAL',
    )
    const distanceBreakdown = getRankBreakdown(
      distanceUnknown,
      distanceUnknown.distanceMeters,
      'NEUTRAL',
    )

    expect(inferredBreakdown.inferredPenalty).toBeLessThan(0)
    expect(riskBreakdown.zoneDensityPenalty).toBeLessThan(0)
    expect(freshBreakdown.freshnessBonus).toBeLessThan(0)
    expect(distanceBreakdown.distanceWeight).toBe(0)
  })

  const cases: Array<[RiskMode, number]> = []
  riskModes.forEach((riskMode) => {
    radii.forEach((radius) => {
      cases.push([riskMode, radius])
    })
  })

  it.each(cases)('matches snapshot for %s @ %sm', (riskMode, radius) => {
      const ranked = applyRankingPolicy(rankingGoldenSegments, {
        includeInferred: true,
        radiusMeters: radius,
        riskMode,
      })
      const top = summarizeTop(ranked)
      expect(top).toMatchSnapshot(`${riskMode}-${radius}`)
    })
})
