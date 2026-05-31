import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadPublishGateDatasetMeta } from './publishGateDatasetMetaFile'

describe('publishGateDatasetMetaFile', () => {
  it('returns a META_UNREADABLE warning for invalid dataset meta json', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-dataset-meta-'))
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
})
