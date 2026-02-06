import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { writePublishManifest, buildManifestFileName } from './manifestWriter'

describe('manifestWriter', () => {
  it('writes manifest with deterministic file name', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'manifest-test-'))
    const publishedAt = '2026-02-04T00:00:00Z'
    const datasetHash = 'hash-123'
    const targetName = buildManifestFileName(publishedAt, datasetHash)

    const manifestPath = await writePublishManifest({
      baseDir: base,
      manifest: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        schemaVersion: 1,
        datasetHash,
        configHash: 'config-hash',
        generatedAt: '2026-02-03T00:00:00Z',
        publishedAt,
        metaSha256: 'meta',
        packSha256: 'pack',
        totalBytes: 10,
        files: { 'red_yellow.geojson': { sha256: 'a', bytes: 1 } },
        gateResult: 'PASS',
        toolVersions: {
          node: process.version,
        },
      },
    })

    expect(path.basename(manifestPath)).toBe(targetName)
    const raw = await fs.readFile(manifestPath, 'utf-8')
    const parsed = JSON.parse(raw) as { districtId: string; datasetHash: string }
    expect(parsed.districtId).toBe('xinyi')
    expect(parsed.datasetHash).toBe(datasetHash)
  })
})
