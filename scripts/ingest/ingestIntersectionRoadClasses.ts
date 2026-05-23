import type { Feature } from 'geojson'

export const normalizeRoadClass = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

export const getRoadClass = (feature: Feature): string | null => {
  const props = feature.properties ?? {}
  const candidateKeys = [
    'road_class',
    'class',
    'class_name',
    'type',
    'kind',
    'highway',
    'road_type',
  ]
  for (const key of candidateKeys) {
    const value = (props as Record<string, unknown>)[key]
    const normalized = normalizeRoadClass(value)
    if (normalized) {
      return normalized
    }
  }
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase()
    if (candidateKeys.includes(lower)) {
      const normalized = normalizeRoadClass(value)
      if (normalized) {
        return normalized
      }
    }
  }
  return null
}

export const shouldIncludeRoadClass = (
  roadClass: string | null,
  includeSet: Set<string>,
  excludeSet: Set<string>,
) => {
  if (roadClass && excludeSet.has(roadClass)) {
    return false
  }
  if (includeSet.size === 0) {
    return true
  }
  return roadClass ? includeSet.has(roadClass) : false
}
