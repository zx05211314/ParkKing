import { describe, expect, it } from 'vitest'
import { shouldMountMapView } from './mapViewReadiness'

describe('shouldMountMapView', () => {
  it('does not mount MapLibre while parking data is loading or unavailable', () => {
    expect(shouldMountMapView('loading')).toBe(false)
    expect(shouldMountMapView('error')).toBe(false)
  })

  it('mounts MapLibre after the parking dataset is ready', () => {
    expect(shouldMountMapView('ready')).toBe(true)
  })
})
