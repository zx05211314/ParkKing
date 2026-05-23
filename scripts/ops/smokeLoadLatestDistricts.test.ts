import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { verifySmokeLoadLatestDistricts } from './smokeLoadLatestDistricts'

describe('verifySmokeLoadLatestDistricts', () => {
  it('fails when a latest manifest points at the wrong district', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'smoke-districts-'))
    const districtDir = path.join(baseDir, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })

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
      path.join(districtDir, 'LATEST.json'),
      JSON.stringify({ manifestPath: '_ops/manifests/xinyi/publish.json' }, null, 2),
      'utf-8',
    )

    const manifestPath = path.join(baseDir, '_ops', 'manifests', 'xinyi', 'publish.json')
    await fs.mkdir(path.dirname(manifestPath), { recursive: true })
    await fs.writeFile(
      manifestPath,
      JSON.stringify({ districtId: 'daan' }, null, 2),
      'utf-8',
    )

    await expect(
      verifySmokeLoadLatestDistricts({
        baseDir,
        districts: [{ districtId: 'xinyi' }],
        pointerFileName: 'LATEST.json',
      }),
    ).rejects.toThrow('Manifest districtId mismatch for xinyi')
  })
})
