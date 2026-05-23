import { describe, expect, it } from 'vitest'
import { parseRollbackArgs } from './rollbackPackArgs'

describe('parseRollbackArgs', () => {
  it('reads district, backup, latest, and baseDir flags', () => {
    expect(
      parseRollbackArgs([
        'node',
        'rollbackPack.ts',
        '--district',
        'xinyi',
        '--to',
        'hash-backup',
        '--latest',
        '--baseDir',
        'public/data/generated',
      ]),
    ).toEqual({
      districtId: 'xinyi',
      backupId: 'hash-backup',
      latest: true,
      baseDir: 'public/data/generated',
    })
  })

  it('returns nulls when optional flags are missing', () => {
    expect(parseRollbackArgs(['node', 'rollbackPack.ts'])).toEqual({
      districtId: null,
      backupId: null,
      latest: false,
      baseDir: null,
    })
  })
})
