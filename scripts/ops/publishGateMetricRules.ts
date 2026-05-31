import { buildPublishGateMetricState } from './publishGateMetricState'
import { buildPublishGateMetricWarnings } from './publishGateMetricWarnings'

export const validatePublishGateMetricMetadata = (
  districtId: string,
  meta: Record<string, unknown>,
) =>
  buildPublishGateMetricWarnings({
    districtId,
    metrics: buildPublishGateMetricState(meta),
  })
