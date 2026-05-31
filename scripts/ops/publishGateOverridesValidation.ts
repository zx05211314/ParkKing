import * as path from 'node:path'
import {
  fileExists,
  readGeoJson,
} from './publishGateFiles'
import { validatePublishGateOverrideCount } from './publishGateOverrideCounts'
import { validatePublishGateOverrideFeatures } from './publishGateOverrideFeatureValidation'
import { loadPublishGateOverrideSegmentIds } from './publishGateOverrideSegments'
import type { GateWarning } from './publishGateTypes'

const buildGateWarning = (warning: GateWarning): GateWarning => warning

export const validatePublishGateOverridesApplied = async (
  districtId: string,
  datasetDir: string,
  counts: Record<string, unknown> | undefined,
) => {
  const warnings: GateWarning[] = []
  const overridesPath = path.resolve(datasetDir, 'overrides_applied.geojson')
  if (!(await fileExists(overridesPath))) {
    return warnings
  }

  try {
    const overrides = await readGeoJson(overridesPath)
    const overridesCount = overrides.features.length
    warnings.push(
      ...validatePublishGateOverrideCount({
        districtId,
        overridesCount,
        counts,
      }),
    )

    if (overridesCount <= 0) {
      return warnings
    }

    const segmentState = await loadPublishGateOverrideSegmentIds(districtId, datasetDir)
    warnings.push(...segmentState.warnings)
    warnings.push(
      ...validatePublishGateOverrideFeatures({
        districtId,
        features: overrides.features,
        segmentIds: segmentState.segmentIds,
      }),
    )
  } catch {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'OVERRIDES_UNREADABLE',
        message: `overrides_applied.geojson unreadable for ${districtId}`,
      }),
    )
  }

  return warnings
}
