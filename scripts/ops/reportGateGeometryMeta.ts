export const parseBBox = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Record<string, unknown>
  const minX = Number(candidate.minX)
  const minY = Number(candidate.minY)
  const maxX = Number(candidate.maxX)
  const maxY = Number(candidate.maxY)
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null
  }
  return { minX, minY, maxX, maxY }
}

export const parseCenter = (value: unknown) => {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }
  const x = Number(value[0])
  const y = Number(value[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }
  return [x, y] as [number, number]
}
