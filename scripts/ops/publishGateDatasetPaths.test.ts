import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import {
  listPublishGateDatasetDirCandidates,
  resolvePublishGateDatasetDir,
} from './publishGateDatasetPaths'

describe('publishGateDatasetPaths', () => {
  it('lists the explicit root candidate first', () => {
    const candidates = listPublishGateDatasetDirCandidates('xinyi', 'tmp/generated')
    expect(candidates[0]).toBe(path.resolve('tmp/generated', 'xinyi'))
    expect(candidates).toContain(
      path.resolve(process.cwd(), 'public/data/generated', 'xinyi'),
    )
  })

  it('prefers a directory with dataset_meta over a fallback directory', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-dataset-paths-'))
    const districtDir = path.join(base, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.writeFile(
      path.join(districtDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }),
      'utf-8',
    )

    await expect(resolvePublishGateDatasetDir('xinyi', base)).resolves.toBe(districtDir)
  })
})
