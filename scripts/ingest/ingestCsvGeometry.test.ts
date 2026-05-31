import { describe, expect, it } from 'vitest'
import { EPSG_3826, EPSG_4326 } from './ingestCrs'
import { parseCsvDataset, parseWktGeometry } from './ingestCsvGeometry'

describe('ingestCsvGeometry', () => {
  it('parses WKT point and multiline geometry', () => {
    expect(parseWktGeometry('POINT (121 25)')).toEqual({
      type: 'Point',
      coordinates: [121, 25],
    })

    expect(parseWktGeometry('MULTILINESTRING ((121 25, 121.1 25.1))')).toEqual({
      type: 'MultiLineString',
      coordinates: [[[121, 25], [121.1, 25.1]]],
    })
  })

  it('parses csv lat/lon rows directly', () => {
    const collection = parseCsvDataset('lat,lon\n25,121\n', EPSG_4326)
    expect(collection.features).toHaveLength(1)
    expect(collection.features[0]?.geometry).toEqual({
      type: 'Point',
      coordinates: [121, 25],
    })
  })

  it('parses csv rows with Chinese WGS84 headers', () => {
    const collection = parseCsvDataset(
      'WGS84經度,WGS84緯度\n121.56,25.03\n',
      EPSG_4326,
    )

    expect(collection.features).toHaveLength(1)
    expect(collection.features[0]?.geometry).toEqual({
      type: 'Point',
      coordinates: [121.56, 25.03],
    })
  })

  it('transforms projected WKT rows when needed', () => {
    const collection = parseCsvDataset('geometry\nPOINT (250000 2650000)\n', EPSG_3826)
    const geometry = collection.features[0]?.geometry

    expect(geometry).not.toBeNull()
    if (!geometry || geometry.type !== 'Point') {
      throw new Error('expected point geometry')
    }
    expect(Math.abs(geometry.coordinates[0])).toBeLessThanOrEqual(180)
    expect(Math.abs(geometry.coordinates[1])).toBeLessThanOrEqual(90)
  })
})
