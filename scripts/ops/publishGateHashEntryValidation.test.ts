import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { validatePublishGateHashEntry } from './publishGateHashEntryValidation'

describe('publishGateHashEntryValidation', () => {
  it('flags hash and byte mismatches for an existing file', async () => {
    const datasetDir = await fs.mkdtemp(
      path.join(tmpdir(), 'publish-gate-hash-entry-'),
    )
    await fs.writeFile(path.join(datasetDir, 'red_yellow.geojson'), '{"ok":true}', 'utf-8')

    const warnings = await validatePublishGateHashEntry({
      districtId: 'xinyi',
      datasetDir,
      fileName: 'red_yellow.geojson',
      entry: {
        sha256: 'bad',
        bytes: 1,
      },
    })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'HASH_MISMATCH' }),
        expect.objectContaining({ code: 'BYTES_MISMATCH' }),
      ]),
    )
  })
})
