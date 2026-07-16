import { describe, expect, it } from 'vitest'
import { shouldPreloadMapView } from './useMapPrefetchEffect'

describe('shouldPreloadMapView', () => {
  it('does not preload the map bundle while the user stays in list view', () => {
    expect(shouldPreloadMapView('LIST', 'ready', false)).toBe(false)
  })

  it('waits for the parking dataset before preloading the map bundle', () => {
    expect(shouldPreloadMapView('MAP', 'loading', false)).toBe(false)
    expect(shouldPreloadMapView('MAP', 'error', false)).toBe(false)
  })

  it('preloads the map bundle when map view is active and the dataset is ready', () => {
    expect(shouldPreloadMapView('MAP', 'ready', false)).toBe(true)
  })

  it('does not start duplicate map bundle preloads', () => {
    expect(shouldPreloadMapView('MAP', 'ready', true)).toBe(false)
  })
})
