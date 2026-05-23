import { describe, expect, it } from 'vitest'
import {
  clampLimit,
  normalizeGeocodeText,
  parseCsv,
  parsePositiveInteger,
} from './geocodeProxyParsing'

describe('geocodeProxyParsing', () => {
  it('normalizes text and csv env values', () => {
    expect(normalizeGeocodeText('  Taipei  ')).toBe('Taipei')
    expect(normalizeGeocodeText('   ')).toBeNull()
    expect(parseCsv(' TW, jp , , Us ')).toEqual(['tw', 'jp', 'us'])
  })

  it('parses positive integers and clamps request limits', () => {
    expect(parsePositiveInteger('7', 5)).toBe(7)
    expect(parsePositiveInteger('0', 5)).toBe(5)
    expect(clampLimit(undefined, 5)).toBe(5)
    expect(clampLimit(8.6, 5)).toBe(5)
    expect(clampLimit(2.2, 5)).toBe(2)
  })
})
