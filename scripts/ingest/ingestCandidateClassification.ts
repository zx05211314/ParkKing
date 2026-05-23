import type { Feature } from 'geojson'

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

export const extractRoadWidth = (properties: Feature['properties']): number | null => {
  if (!properties) {
    return null
  }

  const entries = Object.entries(properties as Record<string, unknown>)
  const candidates = ['width', 'road_width', 'roadwidth', 'width_m', 'width_meters']
  for (const candidate of candidates) {
    const found = entries.find(([key]) => key.toLowerCase() === candidate)
    const value = parseNumber(found?.[1])
    if (value !== null && value > 0) {
      return value
    }
  }

  const lanesValue = parseNumber(
    (properties as Record<string, unknown>).lanes ??
      (properties as Record<string, unknown>).lane_count,
  )
  if (lanesValue !== null) {
    return lanesValue * 3.5
  }

  return null
}

const normalizeClass = (value: unknown): string | null => {
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
    const normalized = normalizeClass(value)
    if (normalized) {
      return normalized
    }
  }
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase()
    if (candidateKeys.includes(lower)) {
      const normalized = normalizeClass(value)
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

export const pickCandidateProperties = (properties: Feature['properties']) => {
  if (!properties) {
    return properties
  }
  const entries = Object.entries(properties)
  const filtered = entries.filter(([key]) =>
    /id|name|road|class|side|source|offset|candidate|risk|zone|width|count/i.test(
      key,
    ),
  )
  if (filtered.length === 0) {
    return properties
  }
  return Object.fromEntries(filtered)
}

export const classifyRoadRisk = (roadClass: string | null) => {
  if (!roadClass) {
    return []
  }
  const majorClasses = [
    'motorway',
    'trunk',
    'primary',
    'secondary',
    'tertiary',
    'arterial',
    'highway',
    'main',
  ]
  return majorClasses.some((entry) => roadClass.includes(entry)) ? ['MAJOR_ROAD'] : []
}

export const classifyZoneDensity = (count: number) => {
  if (count >= 4) {
    return ['HARD_ZONE_DENSE']
  }
  if (count >= 2) {
    return ['HARD_ZONE_MEDIUM']
  }
  if (count >= 1) {
    return ['HARD_ZONE_NEAR']
  }
  return []
}

export const classifyRoadWidth = (width: number | null) => {
  if (width === null) {
    return []
  }
  if (width >= 18) {
    return ['WIDE_ROAD']
  }
  return []
}
