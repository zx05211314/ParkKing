import { featureCollection } from '@turf/turf'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import {
  getBoundaryFileName,
  normalizeDistrictId,
  readDataset,
  reduceProperties,
  writeGeoJson,
} from './utils'

const normalizeName = (value: string) => {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

const pickFeatureId = (feature: Feature) => {
  const props = feature.properties ?? {}
  const candidates = [
    'id',
    'ID',
    'objectid',
    'OBJECTID',
    'fid',
    'Fid',
    'PERF_ID',
    'perf_id',
    'COUN_ID',
    'count_id',
    'CPID',
    'CPTID',
    'NPID',
    'NPTID',
  ]
  for (const key of candidates) {
    const value = props[key]
    if (value !== undefined && value !== null) {
      return String(value)
    }
  }
  return null
}

const matchesName = (feature: Feature, names: string[]) => {
  if (names.length === 0) {
    return false
  }
  const props = feature.properties ?? {}
  const normalizedNames = names.map((name) => normalizeName(name))
  for (const value of Object.values(props)) {
    if (typeof value !== 'string') {
      continue
    }
    const normalizedValue = normalizeName(value)
    if (normalizedNames.some((name) => normalizedValue.includes(name))) {
      return true
    }
  }
  return false
}

const selectBoundaryFeature = (
  collection: FeatureCollection,
  config: ResolvedConfig,
): Feature<Polygon | MultiPolygon> | null => {
  const featureId = config.boundary.featureId
  if (featureId) {
    const matched = collection.features.find(
      (feature) => pickFeatureId(feature) === featureId,
    )
    if (matched && matched.geometry) {
      return matched as Feature<Polygon | MultiPolygon>
    }
  }

  if (config.boundary.names.length > 0) {
    const matched = collection.features.find((feature) =>
      matchesName(feature, config.boundary.names),
    )
    if (matched && matched.geometry) {
      return matched as Feature<Polygon | MultiPolygon>
    }
  }

  if (collection.features.length === 1) {
    const single = collection.features[0]
    if (single?.geometry) {
      return single as Feature<Polygon | MultiPolygon>
    }
  }

  return null
}

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
