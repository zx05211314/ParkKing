export interface OpsThresholds {
  counts: {
    segments: number
    intersections: number
    inferredCandidates: number
    signOverrides: number
  }
  tierDistributionMaxDeltaPct: number
  perfRegressionMaxDeltaPct: number
  maxReasonCodeDeltaPct: number
  maxNewReasonCodePct: number
}

export type Severity = 'INFO' | 'WARN' | 'FAIL'

export interface ReasonCodeDistribution {
  top: Record<string, number>
  other: number
  total: number
  coveragePct: number
}

export interface BaselineMetrics {
  baselineCreatedAt?: string
  baselineDatasetHash?: string
  baselineSchemaVersion?: number
  baselineSourceMetaSha256?: string
  baselineDistrictName?: string
  counts: {
    segments: number
    intersections: number
    inferredCandidates: number
    signOverrides: number
  }
  distributions: {
    day: Record<string, number>
    night: Record<string, number>
  }
  performance: {
    day: { evalFirstMsMedian: number }
    night: { evalFirstMsMedian: number }
  }
  reasonCodes: {
    day: ReasonCodeDistribution
    night: ReasonCodeDistribution
  }
}

export interface CurrentMetrics {
  datasetHash?: string
  schemaVersion?: number
  counts: {
    segments: number
    intersections: number
    inferredCandidates: number
    signOverrides: number
  }
  distributions: {
    day: Record<string, number>
    night: Record<string, number>
  }
  performance: {
    day: { evalFirstMs: number }
    night: { evalFirstMs: number }
  }
  reasonCodes: {
    day: { counts: Record<string, number>; total: number; coveragePct: number }
    night: { counts: Record<string, number>; total: number; coveragePct: number }
  }
}

export interface Warning {
  severity: Severity
  code:
    | 'COUNT_DELTA'
    | 'TIER_DELTA'
    | 'PERF_REGRESSION'
    | 'REASON_CODE_DELTA'
    | 'REASON_CODE_NEW'
    | 'REASON_CODE_COVERAGE_DROP'
    | 'BASELINE_MISSING'
    | 'BASELINE_SCHEMA_MISMATCH'
    | 'BASELINE_HASH_MATCH'
  message: string
  metric?: Record<string, unknown>
  threshold?: Record<string, unknown>
}

const deltaPct = (current: number, baseline: number) => {
  if (baseline === 0) {
    return current === 0 ? 0 : 100
  }
  return Math.abs(((current - baseline) / baseline) * 100)
}

const severityForDelta = (delta: number, warnThreshold: number): Severity => {
  if (delta > warnThreshold * 2) {
    return 'FAIL'
  }
  if (delta > warnThreshold) {
    return 'WARN'
  }
  return 'INFO'
}

const compareCounts = (
  current: CurrentMetrics['counts'],
  baseline: BaselineMetrics['counts'],
  thresholds: OpsThresholds['counts'],
): Warning[] => {
  const warnings: Warning[] = []

  const entries: Array<{
    key: keyof OpsThresholds['counts']
    label: string
  }> = [
    { key: 'segments', label: 'segments' },
    { key: 'intersections', label: 'intersections' },
    { key: 'inferredCandidates', label: 'inferredCandidates' },
    { key: 'signOverrides', label: 'signOverrides' },
  ]

  entries.forEach(({ key, label }) => {
    const baselineValue = baseline[key]
    const currentValue = current[key]
    const delta = deltaPct(currentValue, baselineValue)
    const threshold = thresholds[key]
    if (delta > threshold) {
      const severity = severityForDelta(delta, threshold)
      warnings.push({
        severity,
        code: 'COUNT_DELTA',
        message: `${label} delta ${delta.toFixed(1)}% exceeds ${threshold}%`,
        metric: {
          label,
          baseline: baselineValue,
          current: currentValue,
          deltaPct: delta,
        },
        threshold: { warn: threshold, fail: threshold * 2 },
      })
    }
  })

  return warnings
}

const compareDistributions = (
  current: Record<string, number>,
  baseline: Record<string, number>,
  maxDeltaPct: number,
  label: string,
): Warning[] => {
  const warnings: Warning[] = []
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)])

  let worst: { key: string; delta: number; baseline: number; current: number } | null =
    null

  keys.forEach((key) => {
    const baselineValue = baseline[key] ?? 0
    const currentValue = current[key] ?? 0
    const delta = deltaPct(currentValue, baselineValue)
    if (!worst || delta > worst.delta) {
      worst = { key, delta, baseline: baselineValue, current: currentValue }
    }
  })

  if (worst && worst.delta > maxDeltaPct) {
    const severity = severityForDelta(worst.delta, maxDeltaPct)
    warnings.push({
      severity,
      code: 'TIER_DELTA',
      message: `${label} tier distribution delta ${worst.delta.toFixed(
        1,
      )}% exceeds ${maxDeltaPct}% (${worst.key})`,
      metric: {
        label,
        key: worst.key,
        baseline: worst.baseline,
        current: worst.current,
        deltaPct: worst.delta,
      },
      threshold: { warn: maxDeltaPct, fail: maxDeltaPct * 2 },
    })
  }

  return warnings
}

const comparePerformance = (
  current: CurrentMetrics['performance'],
  baseline: BaselineMetrics['performance'],
  maxDeltaPctValue: number,
): Warning[] => {
  const warnings: Warning[] = []
  const entries: Array<{ label: 'day' | 'night' }> = [{ label: 'day' }, { label: 'night' }]

  entries.forEach(({ label }) => {
    const baselineValue = baseline[label].evalFirstMsMedian
    const currentValue = current[label].evalFirstMs
    const delta = deltaPct(currentValue, baselineValue)
    if (delta > maxDeltaPctValue) {
      const severity = severityForDelta(delta, maxDeltaPctValue)
      warnings.push({
        severity,
        code: 'PERF_REGRESSION',
        message: `${label} eval time delta ${delta.toFixed(1)}% exceeds ${maxDeltaPctValue}%`,
        metric: {
          label,
          baseline: baselineValue,
          current: currentValue,
          deltaPct: delta,
        },
        threshold: { warn: maxDeltaPctValue, fail: maxDeltaPctValue * 2 },
      })
    }
  })

  return warnings
}

const computeReasonCodePct = (counts: Record<string, number>, total: number) => {
  const pct: Record<string, number> = {}
  const safeTotal = total > 0 ? total : 1
  Object.entries(counts).forEach(([code, count]) => {
    pct[code] = (count / safeTotal) * 100
  })
  return pct
}

const compareReasonCodes = (
  current: CurrentMetrics['reasonCodes'],
  baseline: BaselineMetrics['reasonCodes'] | undefined,
  thresholds: OpsThresholds,
): Warning[] => {
  const warnings: Warning[] = []
  if (!baseline) {
    return warnings
  }

  const compareSlot = (slot: 'day' | 'night') => {
    const baselineSlot = baseline[slot]
    const currentSlot = current[slot]
    const currentPct = computeReasonCodePct(currentSlot.counts, currentSlot.total)
    const baselinePct = computeReasonCodePct(baselineSlot.top, baselineSlot.total)

    Object.entries(baselineSlot.top).forEach(([code]) => {
      const basePct = baselinePct[code] ?? 0
      const currentValue = currentPct[code] ?? 0
      const delta = Math.abs(currentValue - basePct)
      if (delta > thresholds.maxReasonCodeDeltaPct) {
        const severity = severityForDelta(delta, thresholds.maxReasonCodeDeltaPct)
        warnings.push({
          severity,
          code: 'REASON_CODE_DELTA',
          message: `${slot} reason code ${code} delta ${delta.toFixed(
            1,
          )}% exceeds ${thresholds.maxReasonCodeDeltaPct}%`,
          metric: { slot, code, baselinePct: basePct, currentPct: currentValue },
          threshold: {
            warn: thresholds.maxReasonCodeDeltaPct,
            fail: thresholds.maxReasonCodeDeltaPct * 2,
          },
        })
      }
    })

    Object.entries(currentPct).forEach(([code, pct]) => {
      if (!baselineSlot.top[code] && pct > thresholds.maxNewReasonCodePct) {
        const severity = severityForDelta(pct, thresholds.maxNewReasonCodePct)
        warnings.push({
          severity,
          code: 'REASON_CODE_NEW',
          message: `${slot} new reason code ${code} at ${pct.toFixed(
            1,
          )}% exceeds ${thresholds.maxNewReasonCodePct}%`,
          metric: { slot, code, pct },
          threshold: {
            warn: thresholds.maxNewReasonCodePct,
            fail: thresholds.maxNewReasonCodePct * 2,
          },
        })
      }
    })

    if (
      baselineSlot.coveragePct - currentSlot.coveragePct >
      thresholds.maxReasonCodeDeltaPct
    ) {
      const delta = baselineSlot.coveragePct - currentSlot.coveragePct
      const severity = severityForDelta(delta, thresholds.maxReasonCodeDeltaPct)
      warnings.push({
        severity,
        code: 'REASON_CODE_COVERAGE_DROP',
        message: `${slot} reason code coverage dropped from ${baselineSlot.coveragePct.toFixed(
          1,
        )}% to ${currentSlot.coveragePct.toFixed(1)}%`,
        metric: {
          slot,
          baseline: baselineSlot.coveragePct,
          current: currentSlot.coveragePct,
        },
        threshold: {
          warn: thresholds.maxReasonCodeDeltaPct,
          fail: thresholds.maxReasonCodeDeltaPct * 2,
        },
      })
    }
  }

  compareSlot('day')
  compareSlot('night')

  return warnings
}

export const compareWithBaseline = (
  current: CurrentMetrics,
  baseline: BaselineMetrics | null,
  thresholds: OpsThresholds,
): Warning[] => {
  if (!baseline) {
    return [
      {
        severity: 'WARN',
        code: 'BASELINE_MISSING',
        message: 'Baseline missing; generate with npm run ops:baseline',
      },
    ]
  }

  const warnings: Warning[] = []
  if (
    typeof baseline.baselineSchemaVersion === 'number' &&
    typeof current.schemaVersion === 'number' &&
    baseline.baselineSchemaVersion !== current.schemaVersion
  ) {
    warnings.push({
      severity: 'WARN',
      code: 'BASELINE_SCHEMA_MISMATCH',
      message: `Baseline schemaVersion ${baseline.baselineSchemaVersion} does not match current ${current.schemaVersion}`,
    })
  }

  if (
    baseline.baselineDatasetHash &&
    current.datasetHash &&
    baseline.baselineDatasetHash === current.datasetHash
  ) {
    warnings.push({
      severity: 'INFO',
      code: 'BASELINE_HASH_MATCH',
      message: `Baseline datasetHash matches current (${current.datasetHash}).`,
    })
  }

  return [
    ...warnings,
    ...compareCounts(current.counts, baseline.counts, thresholds.counts),
    ...compareDistributions(
      current.distributions.day,
      baseline.distributions.day,
      thresholds.tierDistributionMaxDeltaPct,
      'day',
    ),
    ...compareDistributions(
      current.distributions.night,
      baseline.distributions.night,
      thresholds.tierDistributionMaxDeltaPct,
      'night',
    ),
    ...comparePerformance(
      current.performance,
      baseline.performance,
      thresholds.perfRegressionMaxDeltaPct,
    ),
    ...compareReasonCodes(current.reasonCodes, baseline.reasonCodes, thresholds),
  ]
}
