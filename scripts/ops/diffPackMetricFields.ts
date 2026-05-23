import type { BBox } from './diffPackMetricTypes'

export const parseDiffPackMetricNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const parseDiffPackMetricBBox = (value: unknown): BBox | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Record<string, unknown>
  const minX = parseDiffPackMetricNumber(candidate.minX)
  const minY = parseDiffPackMetricNumber(candidate.minY)
  const maxX = parseDiffPackMetricNumber(candidate.maxX)
  const maxY = parseDiffPackMetricNumber(candidate.maxY)
  if (minX === null || minY === null || maxX === null || maxY === null) {
    return null
  }
  return { minX, minY, maxX, maxY }
}

export const parseDiffPackMetricCenter = (
  value: unknown,
): [number, number] | null => {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }
  const x = parseDiffPackMetricNumber(value[0])
  const y = parseDiffPackMetricNumber(value[1])
  if (x === null || y === null) {
    return null
  }
  return [x, y]
}

export const getDiffPackCountField = (
  meta: Record<string, unknown> | null,
  key: string,
) => {
  if (!meta) {
    return null
  }
  const direct = parseDiffPackMetricNumber(meta[key])
  if (direct !== null) {
    return direct
  }
  const counts = meta.counts
  if (counts && typeof counts === 'object') {
    return parseDiffPackMetricNumber((counts as Record<string, unknown>)[key])
  }
  return null
}

export const getDiffPackSegmentsCount = (meta: Record<string, unknown> | null) => {
  if (!meta) {
    return null
  }
  const direct = parseDiffPackMetricNumber(meta.segmentsCount)
  if (direct !== null) {
    return direct
  }
  return getDiffPackCountField(meta, 'segments')
}
