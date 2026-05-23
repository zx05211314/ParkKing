import { describe, expect, it } from 'vitest'
import { parseCleanupBackupsArgs } from './cleanupBackupsArgs'

describe('cleanupBackupsArgs', () => {
  it('parses cleanup backup cli flags', () => {
    expect(
      parseCleanupBackupsArgs([
        'node',
        'script',
        '--baseDir',
        'public/data/generated',
        '--maxBackups',
        '3',
        '--maxAgeDays',
        '14',
      ]),
    ).toEqual({
      baseDir: 'public/data/generated',
      maxBackups: 3,
      maxAgeDays: 14,
    })
  })
})
