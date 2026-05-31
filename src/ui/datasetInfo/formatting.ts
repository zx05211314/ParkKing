export const fallback = (value?: string | number | null) => {
  if (value === undefined || value === null) {
    return '-'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return value
}

export const formatPercent = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '-'
  }
  return `${(value * 100).toFixed(1)}%`
}

export const formatSigned = (value: number | null, decimals = 0, suffix = '') => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  const fixed = Math.abs(value).toFixed(decimals)
  return `${sign}${fixed}${suffix}`
}

export const formatSignedPercent = (value: number | null, decimals = 1) => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  return formatSigned(value * 100, decimals, '%')
}

export const formatSignedPoints = (value: number | null, decimals = 1) => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  return formatSigned(value * 100, decimals, 'pp')
}
