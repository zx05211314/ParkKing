import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import {
  extractGateAnomalySourceFiles,
  loadGateAnomalyParsingFallbacks,
} from './reportGateAnomalySourceFiles'

describe('reportGateAnomalySourceFiles', () => {
  it('extracts source paths and resolves parsing fallbacks from the meta payload', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'gate-anomaly-sources-'))
    const csvPath = path.join(baseDir, 'hydrants.csv')
    const shpPath = path.join(baseDir, 'road_centerlines.shp')
    await fs.writeFile(
      csvPath,
      Buffer.concat([
        Buffer.from([0xff]),
        Buffer.from('wgs_lat\tcoord_x\n1\t2\n', 'utf-8'),
      ]),
    )
    await fs.writeFile(shpPath, Buffer.from('not-a-real-shp', 'utf-8'))

    const meta = {
      sourceFiles: [{ path: csvPath }, { path: shpPath }, { path: 42 }, null],
    } as unknown as Record<string, unknown>

    expect(extractGateAnomalySourceFiles(meta)).toEqual([csvPath, shpPath])

    const parsingFallbacks = await loadGateAnomalyParsingFallbacks(meta)
    expect(parsingFallbacks.big5Fallback.used).toBe(true)
    expect(parsingFallbacks.tabDelimiter.used).toBe(true)
    expect(parsingFallbacks.headerMatchFallback.used).toBe(true)
    expect(parsingFallbacks.missingPrjHeuristic.used).toBe(true)
  })
})
