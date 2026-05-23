export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) {
    return 0
  }
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid]
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export const buildReasonDistribution = (
  counts: Record<string, number>,
  total: number,
  coveragePct: number,
  topN = Number.MAX_SAFE_INTEGER,
) => {
  const sorted = Object.entries(counts).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  const topEntries = sorted.slice(0, topN)
  const otherEntries = sorted.slice(topN)
  const top = Object.fromEntries(topEntries)
  const other = otherEntries.reduce((sum, [, count]) => sum + count, 0)
  return { top, other, total, coveragePct }
}
