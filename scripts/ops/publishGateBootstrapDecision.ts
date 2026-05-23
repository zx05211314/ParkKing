import {
  BOOTSTRAP_DENIED_FLAG,
  BOOTSTRAP_MODE_FLAG,
  hasPublishedPack,
  isBootstrapOverride,
} from './publishGatePolicy'

interface PublishGateBootstrapDistrict {
  districtId?: string
}

export interface PublishGateBootstrapState {
  requested: boolean
  previousPackExists: boolean
  modeUsed: boolean
  denied: boolean
  effectiveAllowFail: boolean
  gateMessageFlags: string[]
}

const resolvePreviousPackExists = async ({
  requested,
  allowFail,
  districtIds,
  publishedRootDir,
}: {
  requested: boolean
  allowFail: boolean
  districtIds: string[]
  publishedRootDir?: string | null
}) => {
  if (!requested || !allowFail) {
    return false
  }

  for (const districtId of districtIds) {
    if (await hasPublishedPack(publishedRootDir ?? null, districtId)) {
      return true
    }
  }

  return false
}

export const resolvePublishGateBootstrapState = async ({
  districts,
  overrideReason,
  allowFail,
  publishedRootDir,
}: {
  districts: PublishGateBootstrapDistrict[]
  overrideReason: string | null
  allowFail: boolean
  publishedRootDir?: string | null
}): Promise<PublishGateBootstrapState> => {
  const requested = isBootstrapOverride(overrideReason)
  const districtIds = districts
    .map((district) => district.districtId?.trim())
    .filter((districtId): districtId is string => Boolean(districtId))

  const previousPackExists = await resolvePreviousPackExists({
    requested,
    allowFail,
    districtIds,
    publishedRootDir,
  })
  const modeUsed = requested && allowFail && !previousPackExists
  const denied = requested && allowFail && previousPackExists

  return {
    requested,
    previousPackExists,
    modeUsed,
    denied,
    effectiveAllowFail: allowFail && (!requested || modeUsed),
    gateMessageFlags: [
      ...(modeUsed ? [BOOTSTRAP_MODE_FLAG] : []),
      ...(denied ? [BOOTSTRAP_DENIED_FLAG] : []),
    ],
  }
}
