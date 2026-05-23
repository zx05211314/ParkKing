import { describe, expect, it } from 'vitest'
import { parseUnpackSourceArgs } from './unpackSourceArgs'

describe('parseUnpackSourceArgs', () => {
  it('reads the sourceDir flag', () => {
    expect(
      parseUnpackSourceArgs(['node', 'unpackSources.ts', '--sourceDir', 'data/sources/shared']),
    ).toEqual({
      sourceDir: 'data/sources/shared',
    })
  })

  it('returns null when the sourceDir flag is absent', () => {
    expect(parseUnpackSourceArgs(['node', 'unpackSources.ts'])).toEqual({
      sourceDir: null,
    })
  })
})
