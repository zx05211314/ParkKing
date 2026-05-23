import { describe, expect, it } from 'vitest'
import {
  buildRollbackSwapBackupPath,
  resolveRollbackTarget,
} from './rollbackPackBackups'

describe('resolveRollbackTarget', () => {
  const backups = [
    { name: 'xinyi-20240202-hash-new', mtimeMs: 2 },
    { name: 'xinyi-20240201-hash-old', mtimeMs: 1 },
  ]

  it('uses the newest backup when no backupId is supplied', () => {
    expect(resolveRollbackTarget(backups, 'xinyi')).toEqual(backups[0])
  })

  it('supports exact backup matches', () => {
    expect(resolveRollbackTarget(backups, 'xinyi', 'xinyi-20240201-hash-old')).toEqual(
      backups[1],
    )
  })

  it('supports suffix backup matches', () => {
    expect(resolveRollbackTarget(backups, 'xinyi', '20240201-hash-old')).toEqual(
      backups[1],
    )
  })

  it('throws when a backup id is missing', () => {
    expect(() => resolveRollbackTarget(backups, 'xinyi', 'missing')).toThrow(
      'Backup missing not found for xinyi',
    )
  })

  it('throws when there are no backups', () => {
    expect(() => resolveRollbackTarget([], 'xinyi')).toThrow('No backups found for xinyi')
  })
})

describe('buildRollbackSwapBackupPath', () => {
  it('builds a timestamped rollback backup path', () => {
    expect(
      buildRollbackSwapBackupPath(
        'C:\\packs\\.backup',
        'xinyi',
        'hash-current',
        new Date('2026-02-03T04:05:06.789Z'),
      ),
    ).toBe(
      'C:\\packs\\.backup\\xinyi-rollback-2026-02-03T040506789Z-hash-current',
    )
  })
})
