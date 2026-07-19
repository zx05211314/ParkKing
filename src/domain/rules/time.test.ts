import { describe, expect, it } from 'vitest'
import {
  isSameParkingTimeMode,
  isTimeWithinWindow,
  isValidHHMM,
} from './time'

describe('parking rule time helpers', () => {
  it('validates strict 24-hour HH:MM values', () => {
    expect(isValidHHMM('00:00')).toBe(true)
    expect(isValidHHMM('23:59')).toBe(true)
    expect(isValidHHMM('24:00')).toBe(false)
    expect(isValidHHMM('7:00')).toBe(false)
  })

  it('matches day and night review contexts without treating one minute as all day', () => {
    expect(isSameParkingTimeMode('21:00', '06:59')).toBe(true)
    expect(isSameParkingTimeMode('21:00', '20:00')).toBe(true)
    expect(isSameParkingTimeMode('21:00', '19:59')).toBe(false)
    expect(isSameParkingTimeMode('13:00', '07:00')).toBe(true)
  })

  it('supports normal and cross-midnight time windows', () => {
    const daytime = { label: 'Day', startHHMM: '07:00', endHHMM: '20:00' }
    const night = { label: 'Night', startHHMM: '20:00', endHHMM: '07:00' }

    expect(isTimeWithinWindow('07:00', daytime)).toBe(true)
    expect(isTimeWithinWindow('20:00', daytime)).toBe(false)
    expect(isTimeWithinWindow('23:00', night)).toBe(true)
    expect(isTimeWithinWindow('06:59', night)).toBe(true)
    expect(isTimeWithinWindow('07:00', night)).toBe(false)
  })
})
