import { buildSegmentIdSet } from './publishGateSegments'
import type { GateWarning } from './publishGateTypes'

const buildOverrideWarning = (warning: GateWarning): GateWarning => warning

export const loadPublishGateOverrideSegmentIds = async (
  districtId: string,
  datasetDir: string,
): Promise<{
  segmentIds: Set<string> | null
  warnings: GateWarning[]
}> => {
  try {
    return {
      segmentIds: await buildSegmentIdSet(datasetDir),
      warnings: [],
    }
  } catch {
    return {
      segmentIds: null,
      warnings: [
        buildOverrideWarning({
          severity: 'FAIL',
          code: 'OVERRIDES_SEGMENT_LOAD_FAILED',
          message: `unable to load segment IDs for overrides validation (${districtId})`,
        }),
      ],
    }
  }
}
