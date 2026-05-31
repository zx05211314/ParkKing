import { describe, expect, it } from 'vitest'
import { getBoundaryFileName, normalizeDistrictId } from './ingestDistrictPaths'

describe('ingestDistrictPaths', () => {
  it('normalizes district ids into stable slugs', () => {
    expect(normalizeDistrictId(' Xinyi Dist._#1 ')).toBe('xinyi-dist-1')
    expect(normalizeDistrictId('___')).toBe('district')
  })

  it('builds boundary file names from normalized ids', () => {
    expect(getBoundaryFileName('Da_an')).toBe('da-an_boundary.geojson')
  })
})
