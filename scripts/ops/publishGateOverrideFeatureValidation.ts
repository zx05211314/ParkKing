import { buildPublishGateOverrideFeatureState } from './publishGateOverrideFeatureState'
import { buildPublishGateOverrideFeatureWarnings } from './publishGateOverrideFeatureWarnings'

export const validatePublishGateOverrideFeatures = (params: {
  districtId: string
  features: Array<{ properties?: Record<string, unknown> | null }>
  segmentIds: Set<string> | null
}) => {
  return params.features.flatMap((feature, index) =>
    buildPublishGateOverrideFeatureWarnings({
      districtId: params.districtId,
      feature: buildPublishGateOverrideFeatureState({
        index,
        properties: feature.properties,
      }),
      segmentIds: params.segmentIds,
    }),
  )
}
