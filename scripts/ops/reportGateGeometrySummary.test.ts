import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { summarizeInvalidGeometry } from './reportGateGeometrySummary'

describe('reportGateGeometrySummary', () => {
  it('returns a synthetic invalid summary when the layer cannot be parsed', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'gate-geometry-summary-'))
    const filePath = path.join(baseDir, 'broken.geojson')
    await fs.writeFile(filePath, '{not-valid-json', 'utf-8')

    await expect(summarizeInvalidGeometry(filePath)).resolves.toEqual({
      layer: 'broken.geojson',
      totalFeatures: 0,
      nullGeometry: 0,
      invalidCoordinates: 0,
      totalInvalid: 1,
    })
  })
})
