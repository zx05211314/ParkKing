import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { runSmokeLoadLatest } from './smokeLoadLatest'

describe('smokeLoadLatest expected districts', () => {
  it('fails with clear per-district reasons when expected districts are missing', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'smoke-expected-'))

    await fs.writeFile(
      path.join(baseDir, 'registry.json'),
      JSON.stringify(
        {
          districts: [{ districtId: 'xinyi' }, { districtId: 'daan' }],
        },
        null,
        2,
      ),
      'utf-8',
    )

    await fs.mkdir(path.join(baseDir, 'xinyi'), { recursive: true })
    await fs.writeFile(
      path.join(baseDir, 'xinyi', 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }, null, 2),
      'utf-8',
    )

    await fs.mkdir(path.join(baseDir, 'zhongshan'), { recursive: true })

    await expect(
      runSmokeLoadLatest({
        datasetRoot: baseDir,
        expectedDistricts: ['xinyi', 'daan', 'zhongshan'],
      }),
    ).rejects.toThrow(
      /Expected district checks failed:[\s\S]*\[daan\] folder missing[\s\S]*\[zhongshan\] registry missing[\s\S]*\[zhongshan\] dataset_meta\.json missing/,
    )
  })

  it('reads namespaced pointer file via latestName', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'smoke-latest-ci-'))
    const districtDir = path.join(baseDir, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })

    await fs.writeFile(
      path.join(baseDir, 'registry.json'),
      JSON.stringify({ districts: [{ districtId: 'xinyi' }] }, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      path.join(districtDir, 'dataset_meta.json'),
      JSON.stringify(
        {
          districtId: 'xinyi',
          boundaryCenter: [121.56, 25.03],
          boundaryBBox: { minX: 121.55, minY: 25.02, maxX: 121.57, maxY: 25.04 },
        },
        null,
        2,
      ),
      'utf-8',
    )
    await fs.writeFile(
      path.join(districtDir, 'LATEST_CI.json'),
      JSON.stringify({ manifestPath: '_ops/manifests/xinyi/publish.json' }, null, 2),
      'utf-8',
    )

    const manifestPath = path.join(baseDir, '_ops', 'manifests', 'xinyi', 'publish.json')
    await fs.mkdir(path.dirname(manifestPath), { recursive: true })
    await fs.writeFile(
      manifestPath,
      JSON.stringify({ districtId: 'xinyi' }, null, 2),
      'utf-8',
    )

    await expect(
      runSmokeLoadLatest({
        datasetRoot: baseDir,
        expectedDistricts: ['xinyi'],
        latestName: 'LATEST_CI',
      }),
    ).resolves.toBeUndefined()
  })
})
