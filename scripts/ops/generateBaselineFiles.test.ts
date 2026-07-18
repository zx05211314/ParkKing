import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findBaselineDatasetDir } from './generateBaselineFiles'

describe('findBaselineDatasetDir', () => {
  it('resolves districts only under the selected generated root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'baseline-root-'))
    const districtDir = path.join(root, 'xinyi')
    await fs.mkdir(districtDir)

    await expect(findBaselineDatasetDir('xinyi', root)).resolves.toBe(districtDir)
    await expect(findBaselineDatasetDir('daan', root)).rejects.toThrow(
      `Dataset directory not found for daan under ${root}`,
    )
  })
})
