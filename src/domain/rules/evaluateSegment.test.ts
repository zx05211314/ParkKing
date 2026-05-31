import { describe, expect, it } from 'vitest'
import type { Segment } from '../../ui/types'
import { evaluateSegment } from './evaluateSegment'

const baseSegment: Segment = {
  id: 'seg-test',
  name: 'Test Segment',
  curbMarking: 'RED',
  confidence: 'HIGH',
  path: [
    [121.56, 25.03],
    [121.561, 25.031],
  ],
}

describe('evaluateSegment', () => {
  it('RED always NO_STOP', () => {
    const segment: Segment = { ...baseSegment, curbMarking: 'RED' }
    const evaluated = evaluateSegment(segment, '12:00')
    expect(evaluated.allowedNow).toBe('NO_STOP')
    expect(evaluated.tier).toBe('RED')
    expect(evaluated.reasonCodes).toContain('RULE_RED_NO_STOP')
  })

  it('YELLOW day => TEMP_STOP', () => {
    const segment: Segment = { ...baseSegment, curbMarking: 'YELLOW' }
    const evaluated = evaluateSegment(segment, '10:00')
    expect(evaluated.allowedNow).toBe('TEMP_STOP')
    expect(evaluated.tier).toBe('YELLOW')
    expect(evaluated.reasonCodes).toContain('RULE_YELLOW_DAY_NO_PARK')
  })

  it('YELLOW night => PARK + tier depends on coverage', () => {
    const high: Segment = { ...baseSegment, curbMarking: 'YELLOW', confidence: 'HIGH' }
    const low: Segment = { ...baseSegment, curbMarking: 'YELLOW', confidence: 'LOW' }

    const evaluatedHigh = evaluateSegment(high, '21:00')
    const evaluatedLow = evaluateSegment(low, '21:00')

    expect(evaluatedHigh.allowedNow).toBe('PARK')
    expect(evaluatedHigh.tier).toBe('GREEN')
    expect(evaluatedHigh.reasonCodes).toContain('RULE_YELLOW_NIGHT_PARK_POSSIBLE')

    expect(evaluatedLow.allowedNow).toBe('PARK')
    expect(evaluatedLow.tier).toBe('YELLOW')
  })

  it('official parking-space evidence can keep yellow night parking green despite stale data', () => {
    const segment: Segment = {
      ...baseSegment,
      curbMarking: 'YELLOW',
      confidence: 'HIGH',
      dataFreshnessDays: 500,
      parkingSpaceCount: 3,
    }

    const evaluated = evaluateSegment(segment, '21:00')

    expect(evaluated.allowedNow).toBe('PARK')
    expect(evaluated.tier).toBe('GREEN')
    expect(evaluated.reasonCodes).toContain('PARKING_SPACE_EVIDENCE')
    expect(evaluated.reasonCodes).toContain('DATA_FRESHNESS_STALE')
  })

  it('multiple official parking spaces can rescue very stale yellow night parking', () => {
    const segment: Segment = {
      ...baseSegment,
      curbMarking: 'YELLOW',
      confidence: 'HIGH',
      dataFreshnessDays: 900,
      parkingSpaceCount: 2,
    }

    const evaluated = evaluateSegment(segment, '21:00')

    expect(evaluated.allowedNow).toBe('PARK')
    expect(evaluated.tier).toBe('GREEN')
    expect(evaluated.finalConfidence).toBe('HIGH')
    expect(evaluated.reasonCodes).toContain('PARKING_SPACE_EVIDENCE')
    expect(evaluated.reasonCodes).toContain('DATA_FRESHNESS_STALE')
  })

  it('a single parking-space match does not rescue very stale yellow night parking', () => {
    const segment: Segment = {
      ...baseSegment,
      curbMarking: 'YELLOW',
      confidence: 'HIGH',
      dataFreshnessDays: 900,
      parkingSpaceCount: 1,
    }

    const evaluated = evaluateSegment(segment, '21:00')

    expect(evaluated.allowedNow).toBe('PARK')
    expect(evaluated.tier).toBe('YELLOW')
    expect(evaluated.finalConfidence).toBe('LOW')
    expect(evaluated.reasonCodes).toContain('PARKING_SPACE_EVIDENCE')
    expect(evaluated.reasonCodes).toContain('DATA_FRESHNESS_STALE')
  })

  it('parking-space evidence does not rescue low-confidence yellow segments', () => {
    const segment: Segment = {
      ...baseSegment,
      curbMarking: 'YELLOW',
      confidence: 'LOW',
      dataFreshnessDays: 500,
      parkingSpaceCount: 3,
    }

    const evaluated = evaluateSegment(segment, '21:00')

    expect(evaluated.allowedNow).toBe('PARK')
    expect(evaluated.tier).toBe('YELLOW')
  })

  it('WHITE_EDGE/NONE never auto GREEN', () => {
    const whiteEdge: Segment = { ...baseSegment, curbMarking: 'WHITE_EDGE' }
    const none: Segment = { ...baseSegment, curbMarking: 'NONE' }

    const evaluatedWhite = evaluateSegment(whiteEdge, '22:00')
    const evaluatedNone = evaluateSegment(none, '22:00')

    expect(evaluatedWhite.allowedNow).toBe('PARK')
    expect(evaluatedWhite.tier).toBe('YELLOW')
    expect(evaluatedWhite.reasonCodes).toContain('RULE_NEEDS_SIGNS_CHECK')

    expect(evaluatedNone.allowedNow).toBe('PARK')
    expect(evaluatedNone.tier).toBe('YELLOW')
    expect(evaluatedNone.reasonCodes).toContain('RULE_NEEDS_SIGNS_CHECK')
  })

  it('inferred candidates never GREEN', () => {
    const inferred: Segment = {
      ...baseSegment,
      curbMarking: 'YELLOW',
      confidence: 'HIGH',
      sourceType: 'INFERRED',
      source: 'INFERRED_CENTERLINE_OFFSET',
    }

    const evaluated = evaluateSegment(inferred, '21:00')
    expect(evaluated.allowedNow).toBe('PARK')
    expect(evaluated.tier).toBe('YELLOW')
    expect(evaluated.reasonCodes).toContain('INFERRED_CAPPED')
  })

  it('LEGAL override status can promote a segment to parkable', () => {
    const segment: Segment = {
      ...baseSegment,
      curbMarking: 'RED',
      signOverride: {
        note: 'Field verified legal',
        confidence: 'HIGH',
        status: 'LEGAL',
        timeWindows: [],
      },
    }

    const evaluated = evaluateSegment(segment, '12:00')
    expect(evaluated.allowedNow).toBe('PARK')
    expect(evaluated.tier).toBe('GREEN')
    expect(evaluated.reasonCodes).toContain('OVERRIDE_STATUS_LEGAL')
  })

  it('ILLEGAL override status forces NO_STOP', () => {
    const segment: Segment = {
      ...baseSegment,
      curbMarking: 'YELLOW',
      signOverride: {
        note: 'Field verified illegal',
        confidence: 'HIGH',
        status: 'ILLEGAL',
        timeWindows: [],
      },
    }

    const evaluated = evaluateSegment(segment, '21:00')
    expect(evaluated.allowedNow).toBe('NO_STOP')
    expect(evaluated.tier).toBe('RED')
    expect(evaluated.reasonCodes).toContain('OVERRIDE_STATUS_ILLEGAL')
  })
})
