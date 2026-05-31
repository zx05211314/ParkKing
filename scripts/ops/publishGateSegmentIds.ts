import type {
  FeatureCollection,
  LineString,
  MultiLineString,
} from 'geojson'

export const normalizeOverrideSegmentId = (value: string) => {
  return value.replace(/-part-\d+$/i, '')
}

export const parseSegmentId = (properties: Record<string, unknown> | null) => {
  if (!properties) {
    return null
  }
  const raw =
    properties.segmentId ??
    properties.segment_id ??
    properties.segment ??
    properties.segmentID ??
    properties.segmentid
  return raw ? String(raw) : null
}

const getIdBase = (
  properties: Record<string, unknown> | null,
  index: number,
  fallbackPrefix: string,
) => {
  if (properties) {
    const raw =
      properties.id ??
      properties.ID ??
      properties.objectid ??
      properties.OBJECTID
    if (raw !== undefined && raw !== null) {
      return String(raw)
    }
  }
  return `${fallbackPrefix}-${index + 1}`
}

export const collectSegmentIds = (
  collection: FeatureCollection<LineString | MultiLineString>,
  fallbackPrefix: string,
) => {
  const ids = new Set<string>()
  collection.features.forEach((feature, index) => {
    const idBase = getIdBase(
      feature.properties as Record<string, unknown> | null,
      index,
      fallbackPrefix,
    )
    const geometry = feature.geometry
    if (!geometry) {
      return
    }
    if (geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach((line, lineIndex) => {
        if (line.length === 0) {
          return
        }
        ids.add(`${idBase}-p${lineIndex + 1}`)
      })
      return
    }
    ids.add(String(idBase))
  })
  return ids
}
