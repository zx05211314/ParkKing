import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { collectReleaseFiles } from './packageRelease'

describe('packageRelease', () => {
  it('collects registry, latest, and manifest files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-test-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    await fs.mkdir(baseDir, { recursive: true })

    const registry = {
      generatedAt: new Date().toISOString(),
      districts: [
        {
          districtId: 'xinyi',
          latest: { datasetHash: 'hash-a', publishedAt: '2026-02-04T00:00:00Z' },
        },
      ],
    }
    const registryPath = path.join(baseDir, 'registry.json')
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8')

    const districtDir = path.join(baseDir, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.writeFile(path.join(districtDir, 'red_yellow.geojson'), '{"type":"FeatureCollection","features":[]}')

    const manifestDir = path.join(baseDir, '_ops', 'manifests', 'xinyi')
    await fs.mkdir(manifestDir, { recursive: true })
    const manifestPath = path.join(manifestDir, '20260204T000000Z_hash-a.json')
    await fs.writeFile(manifestPath, '{"ok":true}', 'utf-8')

    const latest = {
      datasetHash: 'hash-a',
      publishedAt: '2026-02-04T00:00:00Z',
      manifestPath: '_ops/manifests/xinyi/20260204T000000Z_hash-a.json',
    }
    await fs.writeFile(
      path.join(districtDir, 'LATEST.json'),
      JSON.stringify(latest, null, 2),
      'utf-8',
    )

    const result = await collectReleaseFiles({
      registryPath,
      includeGlob: `${baseDir.replace(/\\/g, '/')}/**/*.geojson`,
    })

    const paths = result.files.map((file) => path.relative(baseDir, file).replace(/\\/g, '/'))
    expect(paths).toContain('registry.json')
    expect(paths).toContain('xinyi/LATEST.json')
    expect(paths).toContain('_ops/manifests/xinyi/20260204T000000Z_hash-a.json')
  })
})
