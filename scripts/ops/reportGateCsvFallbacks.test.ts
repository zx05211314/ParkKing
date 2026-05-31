import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { analyzeCsvFallbackFile, analyzeCsvHeaderFallbacks } from './reportGateCsvFallbacks'

describe('analyzeCsvHeaderFallbacks', () => {
  it('detects header fallback patterns without direct lat/lon pairs', () => {
    expect(analyzeCsvHeaderFallbacks('wgs_lat\tcoord_x')).toEqual({
      tabDelimiter: true,
      headerMatchFallback: true,
    })
  })
})

describe('analyzeCsvFallbackFile', () => {
  it('detects big5 fallback when utf-8 decoding fails', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-csv-fallback-'))
    const csvPath = path.join(dir, 'hydrants.csv')
    const csvBytes = Buffer.concat([
      Buffer.from([0xff]),
      Buffer.from('lat,lon\n1,2\n', 'utf-8'),
    ])

    await fs.writeFile(csvPath, csvBytes)

    await expect(analyzeCsvFallbackFile(csvPath)).resolves.toMatchObject({
      big5Fallback: true,
      tabDelimiter: false,
    })
    await fs.rm(dir, { recursive: true, force: true })
  })
})
