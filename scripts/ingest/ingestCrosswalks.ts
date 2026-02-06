import { featureCollection } from '@turf/turf'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { filterToBoundary, loadBoundary, readDataset, reduceProperties, writeGeoJson } from './utils'

export const ingestCrosswalks = async (config: ResolvedConfig) => {
  const inputPath = config.inputs.crosswalks
  if (!inputPath) {
    await writeGeoJson(config, 'crosswalks.geojson', featureCollection([]))
    console.log('Generated crosswalks.geojson (empty)')
    return
  }

  const collection = await readDataset(inputPath, config.crs.default)
  const boundary = await loadBoundary(config)
  const filtered = filterToBoundary(collection, boundary)
  const reduced = reduceProperties(filtered)
  const output = featureCollection(reduced.features)

  await writeGeoJson(config, 'crosswalks.geojson', output)
  console.log('Generated crosswalks.geojson')
}

const run = async () => {
  const config = await readConfig()
  await ingestCrosswalks(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
