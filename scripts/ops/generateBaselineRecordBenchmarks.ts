import { buildReasonDistribution } from './generateBaselineStats'
import type {
  BaselinePeriodState,
  BuildBaselineRecordParams,
} from './generateBaselineRecordTypes'

const buildBaselinePeriodPerformance = (period: BaselinePeriodState) => ({
  evalFirstMsMedian: period.medianEvalFirstMs,
  evalSecondMsMedian: period.medianEvalSecondMs,
})

const buildBaselinePeriodReasons = (period: BaselinePeriodState) =>
  buildReasonDistribution(
    period.reasonCodes.counts,
    period.evaluatedCount,
    period.reasonCodes.coveragePct,
  )

export const buildBaselineBenchmarkSections = (
  params: Pick<BuildBaselineRecordParams, 'day' | 'night'>,
) => ({
  distributions: {
    day: params.day.distribution,
    night: params.night.distribution,
  },
  performance: {
    day: buildBaselinePeriodPerformance(params.day),
    night: buildBaselinePeriodPerformance(params.night),
  },
  reasonCodes: {
    day: buildBaselinePeriodReasons(params.day),
    night: buildBaselinePeriodReasons(params.night),
  },
})
