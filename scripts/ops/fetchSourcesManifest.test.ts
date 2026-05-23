import { describe, expect, it } from 'vitest'

import {
  inferDistrictIdFromDest,
  listDistrictSourceManifests,
  normalizeFetchSourcesPath,
  resolveDistrictId,
  resolveSourceDestinations,
} from './fetchSourcesManifest'

describe('fetchSourcesManifest', () => {
  it('resolves relative destinations and normalizes separators', () => {
    const resolved = resolveSourceDestinations(
      [{ dest: 'data\\raw\\xinyi\\source.txt' }],
      'C:\\workspace\\ops',
    )

    expect(normalizeFetchSourcesPath(resolved[0] ?? '')).toBe(
      'C:/workspace/ops/data/raw/xinyi/source.txt',
    )
  })

  it('infers a district from raw and sources destinations', () => {
    expect(inferDistrictIdFromDest('data/raw/xinyi/file.geojson')).toBe('xinyi')
    expect(inferDistrictIdFromDest('data/sources/daan/provenance.json')).toBe('daan')
  })

  it('resolves a single inferred district but rejects ambiguous destinations', () => {
    expect(
      resolveDistrictId(
        {},
        ['data/raw/xinyi/one.geojson', 'data/raw/xinyi/two.geojson'],
      ),
    ).toBe('xinyi')

    expect(
      resolveDistrictId(
        {},
        ['data/raw/xinyi/one.geojson', 'data/raw/daan/two.geojson'],
      ),
    ).toBeNull()
  })

  it('returns explicit districts array when present', () => {
    const districts = listDistrictSourceManifests({
      districts: [{ districtId: 'xinyi' }, { districtId: 'daan' }],
    })

    expect(districts).toHaveLength(2)
    expect(districts[0]?.districtId).toBe('xinyi')
    expect(districts[1]?.districtId).toBe('daan')
  })
})
