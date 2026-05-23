import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import {
  copySyncPublicArtifacts,
  copySyncPublicDistricts,
} from './syncPublicDataCopy'

describe('syncPublicDataCopy', () => {
  it('replaces copied district directories and mirrors optional root artifacts', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'sync-public-copy-'))
    const sourceRoot = path.join(baseDir, 'data', 'generated')
    const targetRoot = path.join(baseDir, 'public', 'data', 'generated')
    await fs.mkdir(path.join(sourceRoot, 'xinyi'), { recursive: true })
    await fs.mkdir(path.join(targetRoot, 'xinyi'), { recursive: true })
    await fs.writeFile(
      path.join(sourceRoot, 'xinyi', 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }),
      'utf-8',
    )
    await fs.writeFile(path.join(sourceRoot, 'xinyi', 'red_yellow.geojson'), '{}', 'utf-8')
    await fs.writeFile(path.join(targetRoot, 'xinyi', 'stale.txt'), 'stale', 'utf-8')
    await fs.writeFile(
      path.join(sourceRoot, 'registry.json'),
      JSON.stringify({ districts: [{ districtId: 'xinyi' }] }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(sourceRoot, 'ingest_all_report.json'),
      JSON.stringify({ generatedAt: '2026-03-01T00:00:00.000Z' }),
      'utf-8',
    )
    await fs.mkdir(targetRoot, { recursive: true })

    await copySyncPublicDistricts(sourceRoot, targetRoot, ['xinyi'])
    await copySyncPublicArtifacts(sourceRoot, targetRoot)

    await expect(
      fs.access(path.join(targetRoot, 'xinyi', 'dataset_meta.json')),
    ).resolves.toBeUndefined()
    await expect(fs.access(path.join(targetRoot, 'registry.json'))).resolves.toBeUndefined()
    await expect(
      fs.access(path.join(targetRoot, 'ingest_all_report.json')),
    ).resolves.toBeUndefined()
    await expect(fs.access(path.join(targetRoot, 'xinyi', 'stale.txt'))).rejects.toThrow()
  })
})
