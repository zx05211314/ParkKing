import { featureCollection } from '@turf/turf'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { filterToBoundary, loadBoundary, readDataset, reduceProperties, writeGeoJson } from './utils'

export const ingestRedYellow = async (config: ResolvedConfig) => {
  const inputPath = config.inputs.redYellow
  const collection = await readDataset(inputPath, config.crs.default)
  const boundary = await loadBoundary(config)
  const filtered = filterToBoundary(collection, boundary)
  const reduced = reduceProperties(filtered)
  const output = featureCollection(reduced.features)

  await writeGeoJson(config, 'red_yellow.geojson', output)
  console.log('Generated red_yellow.geojson')
}

const run = async () => {
  const config = await readConfig()
  await ingestRedYellow(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
