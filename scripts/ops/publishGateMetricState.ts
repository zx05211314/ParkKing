export interface PublishGateMetricState {
  segmentsCount: number | null
  overridesAppliedCount: number | null
  signOverridesCount: number | null
  signOverrideMatchedSegmentCount: number | null
  signOverrideSpatialMatchCount: number | null
  signOverrideUnmatchedNamedCount: number | null
  curbMarkingKnownRate: number | null
  restrictionTriggeredRate: number | null
  overridesRatio: number | null
}

const readNumber = (value: unknown) => {
  return typeof value === 'number' ? value : null
}

export const buildPublishGateMetricState = (
  meta: Record<string, unknown>,
): PublishGateMetricState => {
  const segmentsCount = readNumber(meta.segmentsCount)
  const overridesAppliedCount = readNumber(meta.overridesAppliedCount)

  return {
    segmentsCount,
    overridesAppliedCount,
    signOverridesCount: readNumber(meta.signOverridesCount),
    signOverrideMatchedSegmentCount: readNumber(meta.signOverrideMatchedSegmentCount),
    signOverrideSpatialMatchCount: readNumber(meta.signOverrideSpatialMatchCount),
    signOverrideUnmatchedNamedCount: readNumber(
      meta.signOverrideUnmatchedNamedCount,
    ),
    curbMarkingKnownRate: readNumber(meta.curbMarkingKnownRate),
    restrictionTriggeredRate: readNumber(meta.restrictionTriggeredRate),
    overridesRatio:
      segmentsCount !== null &&
      overridesAppliedCount !== null &&
      segmentsCount > 0
        ? overridesAppliedCount / segmentsCount
        : null,
  }
}
