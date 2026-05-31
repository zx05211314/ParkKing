import { buildPublishGateDiffWarnings } from './publishGateDiffValidation'
import { validatePublishGateFileHashes } from './publishGateHashValidation'
import { validatePublishGateOverridesApplied } from './publishGateOverridesValidation'
import {
  validatePublishGateBoundaryMetadata,
  validatePublishGateCountMetadata,
  validatePublishGateMetricMetadata,
} from './publishGatePackMetadata'
import type { GateWarning } from './publishGateTypes'

export const validateReadyPublishGateDataset = async (params: {
  districtId: string
  datasetDir: string
  meta: Record<string, unknown>
  publishedRootDir?: string | null
  strictDiff?: boolean
}) => {
  const warnings: GateWarning[] = []
  warnings.push(
    ...validatePublishGateBoundaryMetadata(params.districtId, params.meta),
  )

  const { counts, warnings: countWarnings } = validatePublishGateCountMetadata(
    params.districtId,
    params.meta,
  )
  warnings.push(...countWarnings)
  warnings.push(...validatePublishGateMetricMetadata(params.districtId, params.meta))
  warnings.push(
    ...(await validatePublishGateOverridesApplied(
      params.districtId,
      params.datasetDir,
      counts,
    )),
  )
  warnings.push(
    ...(await validatePublishGateFileHashes(
      params.districtId,
      params.datasetDir,
      params.meta,
    )),
  )
  warnings.push(
    ...(await buildPublishGateDiffWarnings(
      params.districtId,
      params.datasetDir,
      params.publishedRootDir,
      params.strictDiff,
    )),
  )

  return warnings
}
