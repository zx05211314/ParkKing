import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { appendRollbackLog } from './rollbackPackLog'

describe('rollbackPackLog', () => {
  it('appends one jsonl line per rollback event', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'rollback-log-'))

    await appendRollbackLog(baseDir, {
      timestamp: '2026-03-03T00:00:00.000Z',
      districtId: 'xinyi',
      from: 'xinyi-20260301-hash-a',
      swappedTo: 'xinyi-rollback-hash-b',
    })

    const logRaw = await fs.readFile(
      path.join(baseDir, '_ops', 'rollback_log.jsonl'),
      'utf-8',
    )
    const lines = logRaw.trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      districtId: 'xinyi',
      from: 'xinyi-20260301-hash-a',
      swappedTo: 'xinyi-rollback-hash-b',
    })
  })
})
