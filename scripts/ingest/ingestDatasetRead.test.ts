import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { EPSG_3826, EPSG_4326 } from './ingestCrs'
import { readDataset } from './ingestDatasetRead'

describe('ingestDatasetRead', () => {
  it('normalizes projected geojson coordinates during reads', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-read-geojson-'))
    const filePath = path.join(base, 'sample.geojson')
    await fs.writeFile(
      filePath,
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [250000, 2650000],
            },
            properties: {},
          },
        ],
      }),
      'utf-8',
    )

    const collection = await readDataset(filePath, EPSG_3826)
    const geometry = collection.features[0]?.geometry

    expect(geometry).not.toBeNull()
    if (!geometry || geometry.type !== 'Point') {
      throw new Error('expected point geometry')
    }
    expect(Math.abs(geometry.coordinates[0])).toBeLessThanOrEqual(180)
    expect(Math.abs(geometry.coordinates[1])).toBeLessThanOrEqual(90)
  })

  it('reads csv datasets through the extracted parser', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-read-csv-'))
    const filePath = path.join(base, 'sample.csv')
    await fs.writeFile(filePath, 'lat,lon\n25,121\n', 'utf-8')

    const collection = await readDataset(filePath, EPSG_4326)
    expect(collection.features).toHaveLength(1)
    expect(collection.features[0]?.geometry).toEqual({
      type: 'Point',
      coordinates: [121, 25],
    })
  })
})
