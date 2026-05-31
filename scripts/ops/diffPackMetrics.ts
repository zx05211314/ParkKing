import {
  hasMetaChanges,
} from './diffPackMetricDeltas'
import { buildDiffPackCountDiffs } from './diffPackMetricCountState'
import { buildDiffPackSpatialDiffs } from './diffPackMetricSpatialState'

export { hasMetaChanges }
export type * from './diffPackMetricTypes'

export const buildDistrictMetaDiff = (
  prevMeta: Record<string, unknown> | null,
  nextMeta: Record<string, unknown> | null,
) => ({
  ...buildDiffPackCountDiffs(prevMeta, nextMeta),
  ...buildDiffPackSpatialDiffs(prevMeta, nextMeta),
})
