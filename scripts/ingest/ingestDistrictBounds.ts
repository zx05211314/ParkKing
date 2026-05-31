import { featureCollection } from '@turf/turf'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { selectBoundaryFeature } from './ingestBoundarySelection'
import { getBoundaryFileName, normalizeDistrictId } from './ingestDistrictPaths'
import {
  readDataset,
  reduceProperties,
  writeGeoJson,
} from './utils'

export const ingestDistrictBounds = async (config: ResolvedConfig) => {
  const inputPath = config.inputs.districtBounds
  const collection = await readDataset(inputPath, config.crs.default)
  const boundaryFeature = selectBoundaryFeature(collection, config)
  if (!boundaryFeature || !boundaryFeature.geometry) {
    const idLabel = normalizeDistrictId(config.districtId)
    throw new Error(`Boundary not found for ${idLabel}. Configure boundary selection.`)
  }

  const boundaryCollection = featureCollection([boundaryFeature])
  const reduced = reduceProperties(boundaryCollection)
  const boundaryFile = getBoundaryFileName(config.districtId)
  await writeGeoJson(config, boundaryFile, reduced)
  console.log(`Generated ${boundaryFile}`)
}

const run = async () => {
  const config = await readConfig()
  await ingestDistrictBounds(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
