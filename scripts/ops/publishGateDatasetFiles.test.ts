import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import {
  loadPublishGateDatasetMeta,
  resolvePublishGateDatasetDir,
  validatePublishGateRequiredFiles,
} from './publishGateDatasetFiles'

describe('publishGateDatasetFiles', () => {
  it('prefers a directory with dataset_meta over a fallback directory', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-dataset-files-'))
    const districtDir = path.join(base, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.writeFile(
      path.join(districtDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }),
      'utf-8',
    )

    await expect(resolvePublishGateDatasetDir('xinyi', base)).resolves.toBe(districtDir)
  })

  it('returns a META_UNREADABLE warning for invalid dataset meta json', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-dataset-files-'))
    await fs.writeFile(path.join(base, 'dataset_meta.json'), '{bad', 'utf-8')

    await expect(loadPublishGateDatasetMeta('xinyi', base)).resolves.toEqual({
      meta: null,
      warnings: [
        expect.objectContaining({
          code: 'META_UNREADABLE',
          severity: 'FAIL',
        }),
      ],
    })
  })

  it('flags missing required pack files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-dataset-files-'))
    await fs.writeFile(
      path.join(base, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }),
      'utf-8',
    )

    const warnings = await validatePublishGateRequiredFiles('xinyi', base)
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FILE_MISSING' }),
      ]),
    )
  })
})
