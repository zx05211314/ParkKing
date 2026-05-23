import { describe, expect, it } from 'vitest'
import {
  daysSince,
  parseDistrictId,
  selectBackupRemovals,
} from './cleanupBackupsRetention'

describe('cleanupBackupsRetention', () => {
  it('derives district ids and selects expired or overflow backups', () => {
    const now = Date.parse('2026-03-21T00:00:00Z')
    expect(parseDistrictId('xinyi-20240101-hashA')).toBe('xinyi')
    expect(daysSince(now - 2 * 24 * 60 * 60 * 1000, now)).toBeCloseTo(2)

    expect(
      selectBackupRemovals({
        backups: [
          { name: 'xinyi-1', mtimeMs: now - 1 * 24 * 60 * 60 * 1000 },
          { name: 'xinyi-2', mtimeMs: now - 2 * 24 * 60 * 60 * 1000 },
          { name: 'xinyi-3', mtimeMs: now - 40 * 24 * 60 * 60 * 1000 },
        ],
        maxBackupsPerDistrict: 2,
        maxBackupAgeDays: 30,
        nowMs: now,
      }).map((entry) => entry.name),
    ).toEqual(['xinyi-3'])
  })
})
