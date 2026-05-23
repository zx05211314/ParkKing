import { isAdoptableDiffFail } from './publishGatePolicy'
import type { PublishGateCheckedDistrict } from './publishGateSummary'

export interface PublishGateFailWarningMatch {
  districtId: string
  warning: NonNullable<PublishGateCheckedDistrict['warnings']>[number]
}

export const collectPublishGateFailWarnings = (
  checkedDistricts: PublishGateCheckedDistrict[],
): PublishGateFailWarningMatch[] =>
  checkedDistricts.flatMap((district) =>
    (district.warnings ?? [])
      .filter((warning) => warning.severity === 'FAIL')
      .map((warning) => ({ districtId: district.districtId ?? 'unknown', warning })),
  )

export const splitPublishGateAdoptableFails = (
  matches: PublishGateFailWarningMatch[],
) => ({
  nonAdoptableFails: matches.filter(({ warning }) => !isAdoptableDiffFail(warning)),
  adoptableDiffFails: matches.filter(({ warning }) => isAdoptableDiffFail(warning)),
})
