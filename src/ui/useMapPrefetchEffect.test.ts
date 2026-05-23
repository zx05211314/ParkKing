import { describe, expect, it } from 'vitest'
import { shouldPreloadMapView } from './useMapPrefetchEffect'

describe('shouldPreloadMapView', () => {
  it('does not preload the map bundle while the user stays in list view', () => {
    expect(shouldPreloadMapView('LIST', false)).toBe(false)
  })

  it('preloads the map bundle when map view is active and not already started', () => {
    expect(shouldPreloadMapView('MAP', false)).toBe(true)
  })

  it('does not start duplicate map bundle preloads', () => {
    expect(shouldPreloadMapView('MAP', true)).toBe(false)
  })
})
