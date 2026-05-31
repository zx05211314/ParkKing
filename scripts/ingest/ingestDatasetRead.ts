import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { TextDecoder } from 'node:util'
import { featureCollection } from '@turf/turf'
import * as shapefile from 'shapefile'
import type { Feature, FeatureCollection } from 'geojson'
import { EPSG_4326 } from './ingestCrs'
import {
  detectCrsFromPrj,
  isLikelyLngLat,
  normalizeFeatures,
  sampleCoordFromCollection,
} from './ingestCoordinateTransforms'
import { parseCsvDataset } from './ingestCsvGeometry'

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const readDataset = async (
  inputPath: string,
  defaultCrs: string,
): Promise<FeatureCollection> => {
  const ext = path.extname(inputPath).toLowerCase()

  if (ext === '.geojson' || ext === '.json') {
    const raw = await fs.readFile(inputPath, 'utf-8')
    const sanitized = raw.replace(/^\uFEFF/, '')
    const collection = JSON.parse(sanitized) as FeatureCollection
    const coordSample = sampleCoordFromCollection(collection)

    if (coordSample && (Math.abs(coordSample[0]) > 180 || Math.abs(coordSample[1]) > 90)) {
      return normalizeFeatures(collection, defaultCrs)
    }

    return collection
  }

  if (ext === '.csv') {
    const buffer = await fs.readFile(inputPath)
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
    let raw = ''
    try {
      raw = utf8Decoder.decode(buffer)
    } catch {
      raw = new TextDecoder('big5').decode(buffer)
    }
    return parseCsvDataset(raw, defaultCrs)
  }

  if (ext === '.shp') {
    const prjPath = inputPath.replace(/\.shp$/i, '.prj')
    const prj = (await fileExists(prjPath)) ? await fs.readFile(prjPath, 'utf-8') : null
    let sourceCrs = detectCrsFromPrj(prj, defaultCrs)

    const source = await shapefile.open(inputPath)
    const features: Feature[] = []
    let result = await source.read()
    while (!result.done) {
      features.push(result.value as Feature)
      result = await source.read()
    }

    const collection = featureCollection(features)
    if (!prj && isLikelyLngLat(sampleCoordFromCollection(collection))) {
      sourceCrs = EPSG_4326
    }
    return normalizeFeatures(collection, sourceCrs)
  }

  throw new Error(`Unsupported input format: ${ext}`)
}
