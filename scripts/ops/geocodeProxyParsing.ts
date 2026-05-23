export const normalizeGeocodeText = (value?: string | null) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const parseCsv = (value?: string | null) => {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
}

export const clampLimit = (value: number | undefined, ceiling: number) => {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return ceiling
  }
  return Math.max(1, Math.min(Math.round(value), ceiling))
}
