import { describe, expect, it } from 'vitest'
import {
  classifyRoadRisk,
  classifyRoadWidth,
  classifyZoneDensity,
  extractRoadWidth,
  getRoadClass,
  pickCandidateProperties,
  shouldIncludeRoadClass,
} from './ingestCandidateClassification'

describe('ingestCandidateClassification', () => {
  it('extracts road width from width fields and lane counts', () => {
    expect(extractRoadWidth({ width_meters: '18' })).toBe(18)
    expect(extractRoadWidth({ lane_count: '3' })).toBe(10.5)
    expect(extractRoadWidth({ unrelated: true })).toBeNull()
  })

  it('normalizes and filters road classes', () => {
    expect(
      getRoadClass({
        type: 'Feature',
        geometry: null,
        properties: { HIGHWAY: ' Primary ' },
      } as never),
    ).toBe('primary')

    expect(
      shouldIncludeRoadClass(
        'primary',
        new Set(['primary', 'secondary']),
        new Set(['motorway']),
      ),
    ).toBe(true)
    expect(
      shouldIncludeRoadClass('motorway', new Set(), new Set(['motorway'])),
    ).toBe(false)
    expect(
      shouldIncludeRoadClass(null, new Set(['primary']), new Set()),
    ).toBe(false)
  })

  it('reduces candidate properties and classifies risk tags', () => {
    expect(
      pickCandidateProperties({
        id: 'candidate-1',
        name: 'Candidate',
        roadClass: 'primary',
        debugNote: 'drop me',
      }),
    ).toEqual({
      id: 'candidate-1',
      name: 'Candidate',
      roadClass: 'primary',
    })

    expect(classifyRoadRisk('primary_link')).toEqual(['MAJOR_ROAD'])
    expect(classifyRoadWidth(18)).toEqual(['WIDE_ROAD'])
    expect(classifyRoadWidth(10)).toEqual([])
    expect(classifyZoneDensity(0)).toEqual([])
    expect(classifyZoneDensity(1)).toEqual(['HARD_ZONE_NEAR'])
    expect(classifyZoneDensity(3)).toEqual(['HARD_ZONE_MEDIUM'])
    expect(classifyZoneDensity(5)).toEqual(['HARD_ZONE_DENSE'])
  })
})
