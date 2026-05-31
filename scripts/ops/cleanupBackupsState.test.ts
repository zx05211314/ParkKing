import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import {
  listCleanupDirectories,
  loadCleanupBackupGroups,
  loadCleanupStagingEntries,
} from './cleanupBackupsState'

describe('cleanupBackupsState', () => {
  it('lists only directories and groups backups by district id', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'cleanup-state-'))
    const backupRoot = path.join(base, '.backup')
    await fs.mkdir(path.join(backupRoot, 'xinyi-20240101-hashA'), { recursive: true })
    await fs.mkdir(path.join(backupRoot, 'daan-20240101-hashB'), { recursive: true })
    await fs.writeFile(path.join(backupRoot, 'ignore.txt'), 'noop', 'utf-8')

    const listed = await listCleanupDirectories(backupRoot)
    const grouped = await loadCleanupBackupGroups(backupRoot)

    expect(listed.sort()).toEqual(['daan-20240101-hashB', 'xinyi-20240101-hashA'])
    expect(Object.keys(grouped).sort()).toEqual(['daan', 'xinyi'])
    expect(grouped.xinyi).toHaveLength(1)
  })

  it('loads staging entries with directory mtimes', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'cleanup-state-'))
    const stagingRoot = path.join(base, '.staging')
    await fs.mkdir(path.join(stagingRoot, 'xinyi-old'), { recursive: true })

    const entries = await loadCleanupStagingEntries(stagingRoot)

    expect(entries).toHaveLength(1)
    expect(entries[0]?.name).toBe('xinyi-old')
    expect(entries[0]?.mtimeMs).toBeGreaterThan(0)
  })
})
