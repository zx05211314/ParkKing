import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { filterToBoundary, loadBoundary, readDataset, reduceProperties, writeGeoJson } from './utils'

export const ingestHydrants = async (config: ResolvedConfig) => {
  const inputPath = config.inputs.hydrants
  const collection = await readDataset(inputPath, config.crs.default)
  const boundary = await loadBoundary(config)
  const filtered = filterToBoundary(collection, boundary)
  const reduced = reduceProperties(filtered)

  await writeGeoJson(config, 'hydrants.geojson', reduced)
  console.log('Generated hydrants.geojson')
}

const run = async () => {
  const config = await readConfig()
  await ingestHydrants(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
