import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { NightlyPublishGateSummary } from './notifyNightlyTypes'
import type { PublishGateRunSummary } from './publishGateRunSummary'

const sortNightlyPublishGateDistricts = (
  left: PublishGateRunSummary['districts'][number],
  right: PublishGateRunSummary['districts'][number],
) =>
  right.fail - left.fail || right.warn - left.warn || left.districtId.localeCompare(right.districtId)

export const hasNightlyPublishGateAlerts = (summary: NightlyPublishGateSummary | null) =>
  Boolean(summary && (summary.totals.warn > 0 || summary.totals.fail > 0))

export const loadNightlyPublishGateSummary = async (
  summaryPath: string | null,
  cwd = process.cwd(),
): Promise<NightlyPublishGateSummary | null> => {
  if (!summaryPath) {
    return null
  }

  const resolvedPath = path.resolve(cwd, summaryPath)
  let raw: string
  try {
    raw = await fs.readFile(resolvedPath, 'utf-8')
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null
    }
    throw error
  }
  const summary = JSON.parse(raw) as PublishGateRunSummary

  return {
    generatedAt: summary.generatedAt,
    mode: summary.mode,
    exitCode: summary.exitCode,
    allowWarn: summary.allowWarn,
    allowFail: summary.allowFail,
    overrideReason: summary.overrideReason,
    totals: summary.totals,
    topDistricts: summary.districts
      .filter((district) => district.warn > 0 || district.fail > 0)
      .sort(sortNightlyPublishGateDistricts)
      .slice(0, 5)
      .map((district) => ({
        districtId: district.districtId,
        warn: district.warn,
        fail: district.fail,
        topWarnCodes: district.topWarnCodes,
        topFailCodes: district.topFailCodes,
        signOverrideBreakdown: district.signOverrideBreakdown
          ? {
              matchedBySegmentId: district.signOverrideBreakdown.matchedBySegmentId,
              matchedBySpatial: district.signOverrideBreakdown.matchedBySpatial,
              unmatchedNamed: district.signOverrideBreakdown.unmatchedNamed,
            }
          : null,
      })),
    summaryPath: resolvedPath,
    summaryUrl: null,
  }
}
