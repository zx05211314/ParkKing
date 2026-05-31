import { describe, expect, it } from 'vitest'
import { pointToPathDistanceMeters } from './geoMath'

describe('pointToPathDistanceMeters', () => {
  it('returns infinity for empty paths', () => {
    expect(pointToPathDistanceMeters([121.5, 25.03], [])).toBe(Number.POSITIVE_INFINITY)
  })

  it('uses point distance for single-point paths', () => {
    expect(
      pointToPathDistanceMeters([121.5001, 25.03], [[121.5, 25.03]]),
    ).toBeGreaterThan(9)
  })

  it('projects to the closest point on a line segment', () => {
    const distance = pointToPathDistanceMeters(
      [121.5, 25.0301],
      [
        [121.499, 25.03],
        [121.501, 25.03],
      ],
    )

    expect(distance).toBeGreaterThan(10)
    expect(distance).toBeLessThan(12)
  })
})
