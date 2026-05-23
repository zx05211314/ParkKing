import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { summarizeInvalidGeometry } from './reportGateGeometryParsing'

describe('reportGateGeometryParsing', () => {
  it('counts null and invalid geometry features from a geojson layer', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-geometry-'))
    const filePath = path.join(base, 'layer.geojson')
    await fs.writeFile(
      filePath,
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: null, properties: {} },
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[121.5, 25.03], [null, 25.04]],
            },
            properties: {},
          },
        ],
      }),
      'utf-8',
    )

    await expect(summarizeInvalidGeometry(filePath)).resolves.toEqual({
      layer: 'layer.geojson',
      totalFeatures: 2,
      nullGeometry: 1,
      invalidCoordinates: 1,
      totalInvalid: 2,
    })
  })
})
