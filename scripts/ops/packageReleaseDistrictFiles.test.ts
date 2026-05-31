import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { collectDistrictReleaseFiles } from './packageReleaseDistrictFiles'

describe('packageReleaseDistrictFiles', () => {
  it('falls back to the district manifest directory when the latest manifest path is missing', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'release-district-'))
    const districtDir = path.join(baseDir, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.writeFile(path.join(districtDir, 'red_yellow.geojson'), '{}', 'utf-8')
    await fs.writeFile(
      path.join(districtDir, 'LATEST.json'),
      JSON.stringify({
        datasetHash: 'hash-a',
        publishedAt: '2026-02-04T00:00:00Z',
        manifestPath: '_ops/manifests/xinyi/missing.json',
      }),
      'utf-8',
    )

    const manifestDir = path.join(baseDir, '_ops', 'manifests', 'xinyi')
    await fs.mkdir(manifestDir, { recursive: true })
    await fs.writeFile(path.join(manifestDir, 'fallback.json'), '{"ok":true}', 'utf-8')

    const files = await collectDistrictReleaseFiles(baseDir, 'xinyi')
    const relativePaths = files.map((file) => path.relative(baseDir, file).replace(/\\/g, '/'))

    expect(relativePaths).toContain('xinyi/red_yellow.geojson')
    expect(relativePaths).toContain('xinyi/LATEST.json')
    expect(relativePaths).toContain('_ops/manifests/xinyi/fallback.json')
  })
})
