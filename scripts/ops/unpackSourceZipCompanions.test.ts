import { describe, expect, it } from 'vitest'
import { resolveCompanionEntries, type ZipEntryInfo } from './unpackSourceZip'

describe('unpackSourceZipCompanions', () => {
  it('returns required and optional companion entries for the chosen shp', () => {
    const chosenShp: ZipEntryInfo = {
      entryName: 'setA/main.shp',
      normalizedPath: 'setA/main.shp',
      size: 10,
    }
    const entries: ZipEntryInfo[] = [
      chosenShp,
      { entryName: 'setA/main.dbf', normalizedPath: 'setA/main.dbf', size: 1 },
      { entryName: 'setA/main.shx', normalizedPath: 'setA/main.shx', size: 1 },
      { entryName: 'setA/main.prj', normalizedPath: 'setA/main.prj', size: 1 },
    ]

    const resolved = resolveCompanionEntries(entries, chosenShp)
    expect(resolved.required.map((entry) => entry.normalizedPath)).toEqual([
      'setA/main.dbf',
      'setA/main.shx',
    ])
    expect(resolved.optional.map((entry) => entry.normalizedPath)).toEqual([
      'setA/main.prj',
    ])
  })
})
