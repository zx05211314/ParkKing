import { BASELINE_ADOPT_APPLIED_FLAG, isAdoptableDiffFail } from './publishGatePolicy'
import type { PublishGateCheckedDistrict } from './publishGateSummary'

export interface PublishGateBaselineAdoptState {
  checkedDistricts: PublishGateCheckedDistrict[]
  applied: boolean
  districtIds: string[]
  gateMessageFlags: string[]
}

export const buildUnappliedBaselineAdoptState = ({
  checkedDistricts,
  gateMessageFlags,
}: {
  checkedDistricts: PublishGateCheckedDistrict[]
  gateMessageFlags: string[]
}): PublishGateBaselineAdoptState => ({
  checkedDistricts,
  applied: false,
  districtIds: [],
  gateMessageFlags,
})

export const buildAppliedBaselineAdoptState = ({
  checkedDistricts,
  gateMessageFlags,
}: {
  checkedDistricts: PublishGateCheckedDistrict[]
  gateMessageFlags: string[]
}): PublishGateBaselineAdoptState => {
  const districtSet = new Set<string>()
  const nextCheckedDistricts = checkedDistricts.map((district) => {
    const districtId = district.districtId ?? 'unknown'
    let touched = false
    const warnings = (district.warnings ?? []).map((warning) => {
      if (!isAdoptableDiffFail(warning)) {
        return warning
      }
      touched = true
      return {
        ...warning,
        severity: 'WARN' as const,
      }
    })
    if (touched && districtId !== 'unknown') {
      districtSet.add(districtId)
    }
    return { ...district, warnings }
  })

  return {
    checkedDistricts: nextCheckedDistricts,
    applied: true,
    districtIds: Array.from(districtSet).sort((a, b) => a.localeCompare(b)),
    gateMessageFlags: [...gateMessageFlags, BASELINE_ADOPT_APPLIED_FLAG],
  }
}
