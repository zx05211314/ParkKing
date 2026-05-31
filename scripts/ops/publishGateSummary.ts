import type { GateWarning } from './publishGateTypes'

export interface PublishGateCheckedDistrict {
  districtId?: string
  warnings?: GateWarning[]
  signOverrideBreakdown?: PublishGateSignOverrideBreakdown
}

export interface PublishGateSignOverrideBreakdown {
  total: number | null
  matchedBySegmentId: number | null
  matchedBySpatial: number | null
  unmatchedNamed: number | null
}

export interface PublishGateDistrictSummary {
  districtId: string
  info: number
  warn: number
  fail: number
  topWarnCodes: string[]
  topFailCodes: string[]
  signOverrideBreakdown?: PublishGateSignOverrideBreakdown
}

export interface PublishGateTotals {
  info: number
  warn: number
  fail: number
}

export const buildPublishGateDistrictSummaries = (
  districts: PublishGateCheckedDistrict[],
): PublishGateDistrictSummary[] => {
  const collectTopCodes = (codes: Record<string, number>) =>
    Object.entries(codes)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([code]) => code)

  return districts.map((district) => {
    const warnings = district.warnings ?? []
    const counts = {
      INFO: 0,
      WARN: 0,
      FAIL: 0,
    }
    const warnCodes: Record<string, number> = {}
    const failCodes: Record<string, number> = {}
    warnings.forEach((warning) => {
      const severity = warning.severity ?? 'WARN'
      counts[severity] += 1
      if (severity === 'WARN') {
        const code = warning.code ?? 'UNKNOWN'
        warnCodes[code] = (warnCodes[code] ?? 0) + 1
      }
      if (severity === 'FAIL') {
        const code = warning.code ?? 'UNKNOWN'
        failCodes[code] = (failCodes[code] ?? 0) + 1
      }
    })

    return {
      districtId: district.districtId ?? 'unknown',
      info: counts.INFO,
      warn: counts.WARN,
      fail: counts.FAIL,
      topWarnCodes: collectTopCodes(warnCodes),
      topFailCodes: collectTopCodes(failCodes),
      ...(district.signOverrideBreakdown
        ? { signOverrideBreakdown: district.signOverrideBreakdown }
        : {}),
    }
  })
}

export const buildPublishGateTotals = (
  districtSummaries: PublishGateDistrictSummary[],
): PublishGateTotals => {
  return districtSummaries.reduce(
    (acc, summary) => {
      acc.info += summary.info
      acc.warn += summary.warn
      acc.fail += summary.fail
      return acc
    },
    { info: 0, warn: 0, fail: 0 },
  )
}

export const resolvePublishGateExitCode = ({
  totals,
  mode,
  allowWarn,
  effectiveAllowFail,
}: {
  totals: PublishGateTotals
  mode: 'strict' | 'warn'
  allowWarn: boolean
  effectiveAllowFail: boolean
}) => {
  const hasFail = totals.fail > 0
  const hasWarn = totals.warn > 0
  const warnBlocking = mode === 'strict' && !allowWarn
  const failBlocking = !effectiveAllowFail

  if (hasFail && failBlocking) {
    return 3
  }
  if (hasWarn && warnBlocking) {
    return 2
  }
  return 0
}
