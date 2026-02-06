import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { writeLatestPointer } from './latestPointer'

describe('latestPointer writer', () => {
  it('writes pointer filename based on PARKKING_LATEST_NAME', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'latest-pointer-'))
    const previous = process.env.PARKKING_LATEST_NAME
    process.env.PARKKING_LATEST_NAME = 'LATEST_CI'
    try {
      const pointerPath = await writeLatestPointer(baseDir, 'xinyi', {
        datasetHash: 'hash-ci',
        publishedAt: '2026-02-06T00:00:00.000Z',
        manifestPath: '_ops/manifests/xinyi/publish.json',
        schemaVersion: 1,
      })

      expect(pointerPath).toBe(path.resolve(baseDir, 'xinyi', 'LATEST_CI.json'))
      await expect(
        fs.access(path.resolve(baseDir, 'xinyi', 'LATEST_CI.json')),
      ).resolves.toBeUndefined()
    } finally {
      if (previous === undefined) {
        delete process.env.PARKKING_LATEST_NAME
      } else {
        process.env.PARKKING_LATEST_NAME = previous
      }
    }
  })
})
