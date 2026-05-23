import {
  buildAppliedBaselineAdoptState,
  buildUnappliedBaselineAdoptState,
} from './publishGateBaselineAdoptState'
import type { PublishGateBaselineAdoptState } from './publishGateBaselineAdoptState'
import {
  collectPublishGateFailWarnings,
  splitPublishGateAdoptableFails,
} from './publishGateBaselineAdoptWarnings'
import type { PublishGateCheckedDistrict } from './publishGateSummary'

export const applyPublishGateBaselineAdopt = ({
  checkedDistricts,
  allowBaselineAdopt,
  overrideReason,
  gateMessageFlags,
}: {
  checkedDistricts: PublishGateCheckedDistrict[]
  allowBaselineAdopt: boolean
  overrideReason: string | null
  gateMessageFlags: string[]
}): PublishGateBaselineAdoptState => {
  if (!allowBaselineAdopt || !overrideReason) {
    return buildUnappliedBaselineAdoptState({
      checkedDistricts,
      gateMessageFlags,
    })
  }

  const failWarnings = collectPublishGateFailWarnings(checkedDistricts)
  const { nonAdoptableFails, adoptableDiffFails } =
    splitPublishGateAdoptableFails(failWarnings)

  if (adoptableDiffFails.length === 0 || nonAdoptableFails.length > 0) {
    return buildUnappliedBaselineAdoptState({
      checkedDistricts,
      gateMessageFlags,
    })
  }

  return buildAppliedBaselineAdoptState({
    checkedDistricts,
    gateMessageFlags,
  })
}
