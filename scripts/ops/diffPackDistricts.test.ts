import { describe, expect, it } from 'vitest'
import * as path from 'node:path'
import { buildDistrictDiff } from './diffPackDistricts'

describe('diffPackDistricts', () => {
  const fixturesRoot = path.resolve('tests/fixtures/packs')

  it('builds an added district diff when only next exists', async () => {
    const nextDir = path.join(fixturesRoot, 'no-prev', 'next')

    const district = await buildDistrictDiff({
      districtId: 'alpha',
      prevDir: null,
      nextDir,
    })

    expect(district.status).toBe('ADDED')
    expect(district.files.added).toContain('dataset_meta.json')
    expect(district.severity).toBe('OK')
  })

  it('captures meta-only updates without file adds or removes', async () => {
    const prevDir = path.join(fixturesRoot, 'meta-change', 'prev')
    const nextDir = path.join(fixturesRoot, 'meta-change', 'next')

    const district = await buildDistrictDiff({
      districtId: 'meta-change',
      prevDir,
      nextDir,
    })

    expect(district.status).toBe('UPDATED')
    expect(district.files.added).toEqual([])
    expect(district.files.removed).toEqual([])
    expect(district.files.modified.map((entry) => entry.path)).toEqual([
      'dataset_meta.json',
    ])
    expect(district.meta.provenanceFetchedAt.changed).toBe(true)
  })
})
