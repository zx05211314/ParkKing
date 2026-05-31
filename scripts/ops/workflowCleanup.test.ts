import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  parseWorkflowCleanupArgs,
  runWorkflowCleanup,
} from './workflowCleanup'

describe('workflowCleanup', () => {
  it('parses cleanup workflow args', () => {
    expect(
      parseWorkflowCleanupArgs([
        'node',
        'workflow-cleanup',
        '--base-dir',
        'public/data/generated',
        '--max-backups',
        '10',
        '--max-age-days',
        '30',
        '--summary',
        '.tmp/summary.txt',
        '--log',
        '.tmp/cleanup.log',
      ]),
    ).toEqual({
      baseDir: 'public/data/generated',
      maxBackups: 10,
      maxAgeDays: 30,
      summaryPath: '.tmp/summary.txt',
      logPath: '.tmp/cleanup.log',
    })
  })

  it('counts backup and staging dirs around cleanup and writes artifacts', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'workflow-cleanup-'))
    const generatedDir = path.join(base, 'generated')
    const backupRoot = path.join(generatedDir, '.backup')
    const stagingRoot = path.join(generatedDir, '.staging')
    const summaryPath = path.join(base, 'cleanup-summary.txt')
    const logPath = path.join(base, 'cleanup.log')
    await fs.mkdir(path.join(backupRoot, 'xinyi-1'), { recursive: true })
    await fs.mkdir(path.join(backupRoot, 'xinyi-2'), { recursive: true })
    await fs.mkdir(path.join(stagingRoot, 'staging-1'), { recursive: true })

    const result = await runWorkflowCleanup(
      {
        baseDir: generatedDir,
        maxBackups: 10,
        maxAgeDays: 30,
        summaryPath,
        logPath,
        now: new Date('2026-05-10T00:00:00Z'),
      },
      {
        cleanup: async () => {
          await fs.rm(path.join(backupRoot, 'xinyi-2'), { recursive: true, force: true })
          return ['xinyi:xinyi-2']
        },
      },
    )

    const summary = await fs.readFile(summaryPath, 'utf-8')
    const log = await fs.readFile(logPath, 'utf-8')
    expect(result.backupDirsBefore).toBe(2)
    expect(result.backupDirsAfter).toBe(1)
    expect(result.stagingDirsBefore).toBe(1)
    expect(result.stagingDirsAfter).toBe(1)
    expect(summary).toContain('generatedAt=2026-05-10T00:00:00.000Z')
    expect(summary).toContain('backupDirsBefore=2')
    expect(summary).toContain('removedCount=1')
    expect(log).toContain('Removed 1 backup/staging entries.')
    expect(log).toContain('- xinyi:xinyi-2')
  })
})
