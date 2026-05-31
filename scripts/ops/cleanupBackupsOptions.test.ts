import { describe, expect, it } from 'vitest'
import { resolveCleanupBackupsOptions } from './cleanupBackupsOptions'

describe('resolveCleanupBackupsOptions', () => {
  it('applies default cleanup values', () => {
    expect(
      resolveCleanupBackupsOptions({
        baseDir: null,
        maxBackups: null,
        maxAgeDays: null,
      }),
    ).toEqual({
      baseDir: 'public/data/generated',
      maxBackupsPerDistrict: 5,
      maxBackupAgeDays: 30,
    })
  })

  it('uses explicit cleanup values when provided', () => {
    expect(
      resolveCleanupBackupsOptions({
        baseDir: 'tmp/generated',
        maxBackups: 2,
        maxAgeDays: 10,
      }),
    ).toEqual({
      baseDir: 'tmp/generated',
      maxBackupsPerDistrict: 2,
      maxBackupAgeDays: 10,
    })
  })
})
