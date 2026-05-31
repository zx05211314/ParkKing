import { describe, expect, it } from 'vitest'
import {
  chooseMainShpEntry,
  normalizeZipPath,
  resolveCompanionEntries,
  type ZipEntryInfo,
} from './unpackSourceZip'

describe('normalizeZipPath', () => {
  it('normalizes slashes and leading dot segments', () => {
    expect(normalizeZipPath('.\\folder\\\\file.SHP')).toBe('folder/file.SHP')
  })
})

describe('resolveCompanionEntries', () => {
  it('returns required and optional companion entries', () => {
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

  it('throws when a required companion is missing', () => {
    const chosenShp: ZipEntryInfo = {
      entryName: 'setA/main.shp',
      normalizedPath: 'setA/main.shp',
      size: 10,
    }

    expect(() =>
      resolveCompanionEntries(
        [
          chosenShp,
          { entryName: 'setA/main.dbf', normalizedPath: 'setA/main.dbf', size: 1 },
        ],
        chosenShp,
      ),
    ).toThrow('Missing required companion file .shx for setA/main.shp')
  })
})

describe('chooseMainShpEntry', () => {
  it('resolves ties deterministically by normalized path', () => {
    const entries: ZipEntryInfo[] = [
      {
        entryName: 'b/path_b.shp',
        normalizedPath: 'b/path_b.shp',
        size: 10,
      },
      {
        entryName: 'a/path_a.shp',
        normalizedPath: 'a/path_a.shp',
        size: 10,
      },
    ]

    const chosen = chooseMainShpEntry(entries)
    expect(chosen?.normalizedPath).toBe('a/path_a.shp')
  })
})
