import { describe, expect, it } from 'vitest'
import {
  getRoadClass,
  normalizeRoadClass,
  shouldIncludeRoadClass,
} from './ingestIntersectionRoadClasses'

describe('ingestIntersectionRoadClasses', () => {
  it('normalizes and resolves road classes from feature properties', () => {
    expect(normalizeRoadClass('  Arterial ')).toBe('arterial')
    expect(
      getRoadClass({
        type: 'Feature',
        properties: {
          road_type: 'Residential',
        },
        geometry: null,
      } as never),
    ).toBe('residential')
  })

  it('applies include and exclude sets', () => {
    expect(shouldIncludeRoadClass('arterial', new Set(), new Set(['arterial']))).toBe(
      false,
    )
    expect(
      shouldIncludeRoadClass('residential', new Set(['residential']), new Set()),
    ).toBe(true)
    expect(shouldIncludeRoadClass(null, new Set(['residential']), new Set())).toBe(false)
  })
})
