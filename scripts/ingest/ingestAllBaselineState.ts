import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { BenchmarkResult } from '../bench/benchEvaluate'
import type { BaselineMetrics, CurrentMetrics } from '../ops/compareBaseline'

const DEFAULT_REASON_DISTRIBUTION_TOP_N = Number.MAX_SAFE_INTEGER

export const buildReasonDistribution = (
  counts: Record<string, number>,
  total: number,
  coveragePct: number,
  topN = DEFAULT_REASON_DISTRIBUTION_TOP_N,
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

export const loadBaselineMetrics = async (
  districtId: string,
  cwd = process.cwd(),
): Promise<BaselineMetrics | null> => {
  const baselinePath = path.resolve(cwd, 'ops/baselines', `${districtId}.json`)
  try {
    const raw = await fs.readFile(baselinePath, 'utf-8')
    return JSON.parse(raw) as BaselineMetrics
  } catch {
    return null
  }
}

export const buildCurrentMetrics = (params: {
  meta: Record<string, unknown>
  counts: Record<string, number> | null
  dayEval: BenchmarkResult
  nightEval: BenchmarkResult
}): CurrentMetrics => ({
  datasetHash: params.meta.datasetHash as string | undefined,
  schemaVersion:
    typeof params.meta.schemaVersion === 'number'
      ? params.meta.schemaVersion
      : undefined,
  counts: {
    segments: params.counts?.segments ?? 0,
    intersections: params.counts?.intersections ?? 0,
    inferredCandidates: params.counts?.inferredCandidates ?? 0,
    signOverrides: params.counts?.signOverrides ?? 0,
    signOverrideUnmatchedNamedCount:
      typeof params.meta.signOverrideUnmatchedNamedCount === 'number'
        ? params.meta.signOverrideUnmatchedNamedCount
        : 0,
  },
  distributions: {
    day: params.dayEval.distribution,
    night: params.nightEval.distribution,
  },
  performance: {
    day: {
      evalFirstMs: params.dayEval.timingsMs.evalFirst,
      evalSecondMs: params.dayEval.timingsMs.evalSecond,
    },
    night: {
      evalFirstMs: params.nightEval.timingsMs.evalFirst,
      evalSecondMs: params.nightEval.timingsMs.evalSecond,
    },
  },
  reasonCodes: {
    day: {
      counts: params.dayEval.reasonCodes.counts,
      total: params.dayEval.counts.evaluatedFirst,
      coveragePct: params.dayEval.reasonCodes.coveragePct,
    },
    night: {
      counts: params.nightEval.reasonCodes.counts,
      total: params.nightEval.counts.evaluatedFirst,
      coveragePct: params.nightEval.reasonCodes.coveragePct,
    },
  },
})

export const buildBaselineCandidate = (
  currentMetrics: CurrentMetrics,
  dayEval: BenchmarkResult,
  nightEval: BenchmarkResult,
): BaselineMetrics => ({
  counts: currentMetrics.counts,
  distributions: currentMetrics.distributions,
  performance: {
    day: {
      evalFirstMsMedian: dayEval.timingsMs.evalFirst,
      evalSecondMsMedian: dayEval.timingsMs.evalSecond,
    },
    night: {
      evalFirstMsMedian: nightEval.timingsMs.evalFirst,
      evalSecondMsMedian: nightEval.timingsMs.evalSecond,
    },
  },
  reasonCodes: {
    day: buildReasonDistribution(
      dayEval.reasonCodes.counts,
      dayEval.counts.evaluatedFirst,
      dayEval.reasonCodes.coveragePct,
    ),
    night: buildReasonDistribution(
      nightEval.reasonCodes.counts,
      nightEval.counts.evaluatedFirst,
      nightEval.reasonCodes.coveragePct,
    ),
  },
})
