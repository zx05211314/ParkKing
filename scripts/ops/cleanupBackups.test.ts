import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { cleanupBackups } from './cleanupBackups'

const setMtime = async (target: string, msAgo: number) => {
  const now = Date.now()
  const time = new Date(now - msAgo)
  await fs.utimes(target, time, time)
}

describe('cleanupBackups', () => {
  it('removes old backups and stale staging dirs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'cleanup-test-'))
    const backupRoot = path.join(base, '.backup')
    const stagingRoot = path.join(base, '.staging')
    await fs.mkdir(backupRoot, { recursive: true })
    await fs.mkdir(stagingRoot, { recursive: true })

    const backupOld = path.join(backupRoot, 'xinyi-20240101-hashA')
    const backupMid = path.join(backupRoot, 'xinyi-20240201-hashB')
    const backupNew = path.join(backupRoot, 'xinyi-20240301-hashC')
    await fs.mkdir(backupOld, { recursive: true })
    await fs.mkdir(backupMid, { recursive: true })
    await fs.mkdir(backupNew, { recursive: true })

    await setMtime(backupOld, 40 * 24 * 60 * 60 * 1000)
    await setMtime(backupMid, 2 * 24 * 60 * 60 * 1000)
    await setMtime(backupNew, 1 * 24 * 60 * 60 * 1000)

    const stagingOld = path.join(stagingRoot, 'xinyi-old')
    const stagingNew = path.join(stagingRoot, 'xinyi-new')
    await fs.mkdir(stagingOld, { recursive: true })
    await fs.mkdir(stagingNew, { recursive: true })

    await setMtime(stagingOld, 2 * 24 * 60 * 60 * 1000)

    const removed = await cleanupBackups({
      baseDir: base,
      maxBackupsPerDistrict: 2,
      maxBackupAgeDays: 30,
    })

    expect(removed).toContain('xinyi:xinyi-20240101-hashA')
    expect(removed).toContain('staging:xinyi-old')

    await expect(fs.stat(backupOld)).rejects.toThrow()
    await expect(fs.stat(backupMid)).resolves.toBeDefined()
    await expect(fs.stat(backupNew)).resolves.toBeDefined()
    await expect(fs.stat(stagingOld)).rejects.toThrow()
    await expect(fs.stat(stagingNew)).resolves.toBeDefined()
  })
})
