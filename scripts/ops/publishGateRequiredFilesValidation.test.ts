import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { validatePublishGateRequiredFiles } from './publishGateRequiredFilesValidation'

describe('publishGateRequiredFilesValidation', () => {
  it('flags missing required pack files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-required-files-'))
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
