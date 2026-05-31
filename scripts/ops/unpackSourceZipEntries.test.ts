import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import AdmZip from 'adm-zip'
import { chooseMainShpEntry, listZipEntries } from './unpackSourceZipEntries'

describe('unpackSourceZipEntries', () => {
  it('lists zip entries and picks the largest shp entry', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'unpack-zip-entries-'))
    const zipPath = path.join(baseDir, 'source.zip')
    const zip = new AdmZip()
    zip.addFile('setA/small.shp', Buffer.from('small'))
    zip.addFile('setB/large.SHP', Buffer.from('much-larger-shp-content'))
    zip.writeZip(zipPath)

    const entries = listZipEntries(zipPath)
    expect(entries.map((entry) => entry.normalizedPath)).toEqual([
      'setA/small.shp',
      'setB/large.SHP',
    ])
    expect(chooseMainShpEntry(entries)?.normalizedPath).toBe('setB/large.SHP')
  })
})
