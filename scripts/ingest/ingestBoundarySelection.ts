import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { ResolvedConfig } from './readConfig'

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

export const selectBoundaryFeature = (
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
