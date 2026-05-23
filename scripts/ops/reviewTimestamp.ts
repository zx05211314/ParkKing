export const REVIEW_TIMESTAMP_EXAMPLE = '2026-05-22T12:00:00.000Z'

export const REVIEW_TIMESTAMP_MESSAGE = `createdAt must be an ISO timestamp with timezone, for example ${REVIEW_TIMESTAMP_EXAMPLE}`

const ISO_TIMESTAMP_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u

export const isValidReviewTimestamp = (value: unknown) => {
  if (typeof value !== 'string') {
    return false
  }
  const timestamp = value.trim()
  if (!ISO_TIMESTAMP_WITH_TIMEZONE.test(timestamp)) {
    return false
  }
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) {
    return false
  }
  return new Date(parsed).getUTCFullYear() >= 2000
}

export const normalizeReviewTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const timestamp = new Date(value).toISOString()
    return isValidReviewTimestamp(timestamp) ? timestamp : null
  }
  if (typeof value !== 'string') {
    return null
  }
  const timestamp = value.trim()
  return isValidReviewTimestamp(timestamp) ? timestamp : null
}
