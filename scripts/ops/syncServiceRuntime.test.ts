import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSyncServiceRuntime } from './syncServiceRuntime'

describe('syncServiceRuntime', () => {
  it('reuses the same in-memory store promise between reads', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-sync-runtime-'))
    const runtime = createSyncServiceRuntime({
      path: '/api/sync',
      port: 8789,
      storageFile: join(tempRoot, 'sync.json'),
      defaultScope: 'default',
    })

    const first = await runtime.ensureStore()
    const second = await runtime.ensureStore()

    expect(first).toBe(second)
  })
})
