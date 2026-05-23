import { describe, expect, it } from 'vitest'
import { diffDistrictFiles, resolveDistrictDiffStatus } from './diffPackDistrictFiles'

describe('diffDistrictFiles', () => {
  it('detects added, removed, and modified files deterministically', () => {
    const prevFiles = new Map([
      ['a.json', { sha256: 'old-a', bytes: 1 }],
      ['b.json', { sha256: 'same-b', bytes: 1 }],
      ['c.json', { sha256: 'old-c', bytes: 1 }],
    ])
    const nextFiles = new Map([
      ['a.json', { sha256: 'new-a', bytes: 1 }],
      ['b.json', { sha256: 'same-b', bytes: 1 }],
      ['d.json', { sha256: 'new-d', bytes: 1 }],
    ])

    const diff = diffDistrictFiles(prevFiles, nextFiles)
    expect(diff.added).toEqual(['d.json'])
    expect(diff.removed).toEqual(['c.json'])
    expect(diff.modified.map((entry) => entry.path)).toEqual(['a.json'])
  })
})

describe('resolveDistrictDiffStatus', () => {
  it('returns updated when file or meta changes exist', () => {
    expect(
      resolveDistrictDiffStatus({
        prevDir: 'prev',
        nextDir: 'next',
        files: { added: [], removed: [], modified: [{ path: 'a', prev: null, next: null }] },
        meta: {} as never,
      }),
    ).toBe('UPDATED')
  })

  it('returns added and removed for one-sided directories', () => {
    expect(
      resolveDistrictDiffStatus({
        prevDir: null,
        nextDir: 'next',
        files: { added: [], removed: [], modified: [] },
        meta: {} as never,
      }),
    ).toBe('ADDED')
    expect(
      resolveDistrictDiffStatus({
        prevDir: 'prev',
        nextDir: null,
        files: { added: [], removed: [], modified: [] },
        meta: {} as never,
      }),
    ).toBe('REMOVED')
  })
})
