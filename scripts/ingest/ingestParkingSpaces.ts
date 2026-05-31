import { featureCollection } from '@turf/turf'
import type { Feature } from 'geojson'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { filterToBoundary, loadBoundary, readDataset, writeGeoJson } from './utils'

const pickParkingSpaceProperties = (properties: Feature['properties']) => {
  if (!properties) {
    return properties
  }
  const entries = Object.entries(properties)
  const filtered = entries.filter(([key]) =>
    /id|name|space|stall|parking|fee|rate|type|kind|class|source|update|date|status|pay/i.test(
      key,
    ),
  )
  if (filtered.length === 0) {
    return properties
  }
  return Object.fromEntries(filtered)
}

export const ingestParkingSpaces = async (config: ResolvedConfig) => {
  const inputPath = config.inputs.parking_spaces
  if (!inputPath) {
    await writeGeoJson(config, 'parking_spaces.geojson', featureCollection([]))
    console.log('Generated parking_spaces.geojson (empty)')
    return
  }

  const collection = await readDataset(inputPath, config.crs.default)
  const boundary = await loadBoundary(config)
  const filtered = filterToBoundary(collection, boundary)
  const reduced = featureCollection(
    filtered.features.map((feature) => ({
      ...feature,
      properties: pickParkingSpaceProperties(feature.properties ?? null),
    })),
  )

  await writeGeoJson(config, 'parking_spaces.geojson', reduced)
  console.log('Generated parking_spaces.geojson')
}

const run = async () => {
  const config = await readConfig()
  await ingestParkingSpaces(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
