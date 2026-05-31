import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { copyCanonicalFiles } from './unpackSourceCopy'
import type { ZipEntryInfo } from './unpackSourceTypes'

describe('unpackSourceCopy', () => {
  it('copies chosen shp and companion files to canonical names', async () => {
    const outputDir = await fs.mkdtemp(path.join(tmpdir(), 'unpack-copy-'))
    await fs.mkdir(path.join(outputDir, 'setB'), { recursive: true })
    await fs.writeFile(path.join(outputDir, 'setB', 'largest.SHP'), 'shp', 'utf-8')
    await fs.writeFile(path.join(outputDir, 'setB', 'largest.DBF'), 'dbf', 'utf-8')
    await fs.writeFile(path.join(outputDir, 'setB', 'largest.SHX'), 'shx', 'utf-8')
    await fs.writeFile(path.join(outputDir, 'setB', 'largest.PRJ'), 'prj', 'utf-8')

    const chosenShp: ZipEntryInfo = {
      entryName: 'setB/largest.SHP',
      normalizedPath: 'setB/largest.SHP',
      size: 10,
    }

    const copied = await copyCanonicalFiles({
      outputDir,
      canonicalBaseName: 'red_yellow',
      chosenShp,
      requiredCompanions: [
        {
          entryName: 'setB/largest.DBF',
          normalizedPath: 'setB/largest.DBF',
          size: 5,
        },
        {
          entryName: 'setB/largest.SHX',
          normalizedPath: 'setB/largest.SHX',
          size: 5,
        },
      ],
      optionalCompanions: [
        {
          entryName: 'setB/largest.PRJ',
          normalizedPath: 'setB/largest.PRJ',
          size: 5,
        },
      ],
    })

    expect(copied.canonicalShpPath).toBe(path.resolve(outputDir, 'red_yellow.shp'))
    await expect(fs.readFile(path.join(outputDir, 'red_yellow.shp'), 'utf-8')).resolves.toBe(
      'shp',
    )
    await expect(fs.readFile(path.join(outputDir, 'red_yellow.dbf'), 'utf-8')).resolves.toBe(
      'dbf',
    )
    await expect(fs.readFile(path.join(outputDir, 'red_yellow.shx'), 'utf-8')).resolves.toBe(
      'shx',
    )
    await expect(fs.readFile(path.join(outputDir, 'red_yellow.prj'), 'utf-8')).resolves.toBe(
      'prj',
    )
  })
})
