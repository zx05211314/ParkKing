import { describe, expect, it } from 'vitest'
import * as path from 'node:path'
import { diffPacks } from './diffPacks'

describe('diffPacks', () => {
  const fixturesRoot = path.resolve('tests/fixtures/packs')

  it('handles missing prev pack', async () => {
    const nextDir = path.join(fixturesRoot, 'no-prev', 'next')
    const report = await diffPacks({ nextDir })

    expect(report.prevPath).toBeNull()
    expect(report.firstPublish).toBe(true)
    expect(report.summary.districtsAdded).toEqual(['alpha'])
    expect(report.districts[0]?.districtId).toBe('alpha')
  })

  it('captures meta-only changes', async () => {
    const prevDir = path.join(fixturesRoot, 'meta-change', 'prev')
    const nextDir = path.join(fixturesRoot, 'meta-change', 'next')
    const report = await diffPacks({ prevDir, nextDir })
    const district = report.districts[0]

    expect(district.files.added).toEqual([])
    expect(district.files.removed).toEqual([])
    expect(district.files.modified.map((entry) => entry.path)).toEqual([
      'dataset_meta.json',
    ])
    expect(district.meta.segmentsCount.delta).toBe(5)
    expect(district.meta.provenanceFetchedAt.changed).toBe(true)
  })

  it('captures file add/remove/modify', async () => {
    const prevDir = path.join(fixturesRoot, 'file-delta', 'prev')
    const nextDir = path.join(fixturesRoot, 'file-delta', 'next')
    const report = await diffPacks({ prevDir, nextDir })
    const district = report.districts[0]

    expect(district.files.added).toEqual(['hydrants.geojson'])
    expect(district.files.removed).toEqual(['bus_stops.geojson'])
    expect(district.files.modified.map((entry) => entry.path)).toContain(
      'red_yellow.geojson',
    )
    const match = district.files.modified.find((entry) => entry.path === 'red_yellow.geojson')
    expect(match?.prev?.sha256).toBeTruthy()
    expect(match?.next?.sha256).toBeTruthy()
  })
})
