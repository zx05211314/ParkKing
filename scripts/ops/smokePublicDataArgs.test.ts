import { describe, expect, it } from 'vitest'
import { parseSmokePublicDataArgs } from './smokePublicDataArgs'

describe('smokePublicDataArgs', () => {
  it('parses the --baseDir argument', () => {
    expect(parseSmokePublicDataArgs(['node', 'script', '--baseDir', 'public/data'])).toEqual({
      baseDir: 'public/data',
    })
    expect(parseSmokePublicDataArgs(['node', 'script'])).toEqual({
      baseDir: null,
    })
  })
})
