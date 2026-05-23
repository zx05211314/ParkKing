import { describe, expect, it } from 'vitest'
import { parseSyncPublicDataArgs } from './syncPublicDataArgs'

describe('syncPublicDataArgs', () => {
  it('parses source and target flags from the cli argv', () => {
    expect(
      parseSyncPublicDataArgs([
        'node',
        'syncPublicData.ts',
        '--source',
        'data/generated',
        '--target',
        'public/data/generated',
      ]),
    ).toEqual({
      sourceDir: 'data/generated',
      targetDir: 'public/data/generated',
    })
  })
})
