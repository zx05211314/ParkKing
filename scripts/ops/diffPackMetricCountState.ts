import { calcDiffPackDelta } from './diffPackMetricDeltas'
import {
  getDiffPackCountField,
  getDiffPackSegmentsCount,
} from './diffPackMetricFields'

export const buildDiffPackCountDiffs = (
  prevMeta: Record<string, unknown> | null,
  nextMeta: Record<string, unknown> | null,
) => ({
  segmentsCount: calcDiffPackDelta(
    getDiffPackSegmentsCount(prevMeta),
    getDiffPackSegmentsCount(nextMeta),
  ),
  overridesAppliedCount: calcDiffPackDelta(
    getDiffPackCountField(prevMeta, 'overridesAppliedCount') ??
      getDiffPackCountField(prevMeta, 'overridesApplied'),
    getDiffPackCountField(nextMeta, 'overridesAppliedCount') ??
      getDiffPackCountField(nextMeta, 'overridesApplied'),
  ),
  signOverridesCount: calcDiffPackDelta(
    getDiffPackCountField(prevMeta, 'signOverridesCount') ??
      getDiffPackCountField(prevMeta, 'signOverrides'),
    getDiffPackCountField(nextMeta, 'signOverridesCount') ??
      getDiffPackCountField(nextMeta, 'signOverrides'),
  ),
  signOverrideMatchedSegmentCount: calcDiffPackDelta(
    getDiffPackCountField(prevMeta, 'signOverrideMatchedSegmentCount'),
    getDiffPackCountField(nextMeta, 'signOverrideMatchedSegmentCount'),
  ),
  signOverrideSpatialMatchCount: calcDiffPackDelta(
    getDiffPackCountField(prevMeta, 'signOverrideSpatialMatchCount'),
    getDiffPackCountField(nextMeta, 'signOverrideSpatialMatchCount'),
  ),
  signOverrideUnmatchedNamedCount: calcDiffPackDelta(
    getDiffPackCountField(prevMeta, 'signOverrideUnmatchedNamedCount'),
    getDiffPackCountField(nextMeta, 'signOverrideUnmatchedNamedCount'),
  ),
})
