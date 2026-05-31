import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { validatePublishGateFileHashes } from './publishGateHashValidation'

describe('publishGateHashValidation', () => {
  it('flags missing meta entries and hash mismatches', async () => {
    const datasetDir = await fs.mkdtemp(
      path.join(tmpdir(), 'publish-gate-hash-validation-'),
    )
    const filePath = path.join(datasetDir, 'red_yellow.geojson')
    await fs.writeFile(filePath, '{"ok":true}', 'utf-8')

    const warnings = await validatePublishGateFileHashes('xinyi', datasetDir, {
      files: {
        'red_yellow.geojson': {
          sha256: 'bad',
          bytes: 1,
        },
      },
    })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'META_FILE_ENTRY_MISSING' }),
        expect.objectContaining({ code: 'HASH_MISMATCH' }),
        expect.objectContaining({ code: 'BYTES_MISMATCH' }),
      ]),
    )
  })
})
