import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { analyzeParsingFallbacks } from './reportGateAnomalyParsing'

describe('reportGateAnomalyParsing', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await fs.rm(dir, { recursive: true, force: true })
      }),
    )
  })

  it('detects big5, tab-delimited, header-match, and missing-prj fallbacks', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-gate-parsing-'))
    tempDirs.push(dir)
    const csvPath = path.join(dir, 'hydrants.csv')
    const shpPath = path.join(dir, 'roads.shp')
    const csvBytes = Buffer.concat([
      Buffer.from([0xff]),
      Buffer.from('wgs_lat\tcoord_x\n1\t2\n', 'utf-8'),
    ])

    await fs.writeFile(csvPath, csvBytes)
    await fs.writeFile(shpPath, 'fake-shp', 'utf-8')

    const result = await analyzeParsingFallbacks([csvPath, shpPath])

    expect(result.big5Fallback.used).toBe(true)
    expect(result.tabDelimiter.used).toBe(true)
    expect(result.headerMatchFallback.used).toBe(true)
    expect(result.missingPrjHeuristic.used).toBe(true)
  })
})
