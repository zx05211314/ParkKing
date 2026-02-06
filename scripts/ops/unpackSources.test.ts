import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import AdmZip from 'adm-zip'
import { chooseMainShpEntry, unpackSources, type ZipEntryInfo } from './unpackSources'

const writeZip = async (
  zipPath: string,
  builder: (zip: AdmZip) => void,
) => {
  const zip = new AdmZip()
  builder(zip)
  await fs.mkdir(path.dirname(zipPath), { recursive: true })
  zip.writeZip(zipPath)
}

const read = async (filePath: string) => fs.readFile(filePath)

describe('unpackSources', () => {
  it('chooses the largest .shp in a zip and writes canonical files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'unpack-sources-'))
    const sharedDir = path.join(base, 'data', 'sources', 'shared')
    const zipPath = path.join(sharedDir, 'red_yellow.zip')
    const smallShp = Buffer.from('small-shp')
    const largeShp = Buffer.from('large-shp-content')
    const largeDbf = Buffer.from('large-dbf')
    const largeShx = Buffer.from('large-shx')
    const largePrj = Buffer.from('large-prj')

    await writeZip(zipPath, (zip) => {
      zip.addFile('setA/primary.shp', smallShp)
      zip.addFile('setA/primary.dbf', Buffer.from('small-dbf'))
      zip.addFile('setA/primary.shx', Buffer.from('small-shx'))
      zip.addFile('setA/primary.prj', Buffer.from('small-prj'))

      zip.addFile('setB/largest.SHP', largeShp)
      zip.addFile('setB/largest.DBF', largeDbf)
      zip.addFile('setB/largest.SHX', largeShx)
      zip.addFile('setB/largest.PRJ', largePrj)
    })

    const summaries = await unpackSources({ sourceDir: sharedDir })
    const outDir = path.join(sharedDir, 'red_yellow')
    const canonicalShp = path.join(outDir, 'red_yellow.shp')
    const canonicalDbf = path.join(outDir, 'red_yellow.dbf')
    const canonicalShx = path.join(outDir, 'red_yellow.shx')
    const canonicalPrj = path.join(outDir, 'red_yellow.prj')

    expect(summaries).toHaveLength(1)
    expect(summaries[0]?.chosenShpEntry).toBe('setB/largest.SHP')
    await expect(read(canonicalShp)).resolves.toEqual(largeShp)
    await expect(read(canonicalDbf)).resolves.toEqual(largeDbf)
    await expect(read(canonicalShx)).resolves.toEqual(largeShx)
    await expect(read(canonicalPrj)).resolves.toEqual(largePrj)
  })

  it('resolves ties deterministically by normalized path', () => {
    const entries: ZipEntryInfo[] = [
      {
        entryName: 'b/path_b.shp',
        normalizedPath: 'b/path_b.shp',
        size: 10,
      },
      {
        entryName: 'a/path_a.shp',
        normalizedPath: 'a/path_a.shp',
        size: 10,
      },
    ]

    const chosen = chooseMainShpEntry(entries)
    expect(chosen?.normalizedPath).toBe('a/path_a.shp')
  })
})
