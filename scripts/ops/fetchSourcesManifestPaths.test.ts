import { describe, expect, it } from 'vitest'

import {
  inferDistrictIdFromDest,
  normalizeFetchSourcesPath,
  resolveSourceDestinations,
} from './fetchSourcesManifestPaths'

describe('fetchSourcesManifestPaths', () => {
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
})
