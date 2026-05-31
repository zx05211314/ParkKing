import {
  calcDiffPackBBoxDelta,
  calcDiffPackCenterDelta,
  calcDiffPackDelta,
} from './diffPackMetricDeltas'
import {
  parseDiffPackMetricBBox,
  parseDiffPackMetricCenter,
  parseDiffPackMetricNumber,
} from './diffPackMetricFields'

export const buildDiffPackSpatialDiffs = (
  prevMeta: Record<string, unknown> | null,
  nextMeta: Record<string, unknown> | null,
) => {
  const provenancePrev =
    typeof prevMeta?.provenanceFetchedAt === 'string'
      ? prevMeta.provenanceFetchedAt
      : null
  const provenanceNext =
    typeof nextMeta?.provenanceFetchedAt === 'string'
      ? nextMeta.provenanceFetchedAt
      : null

  return {
    curbMarkingKnownRate: calcDiffPackDelta(
      parseDiffPackMetricNumber(prevMeta?.curbMarkingKnownRate),
      parseDiffPackMetricNumber(nextMeta?.curbMarkingKnownRate),
    ),
    restrictionTriggeredRate: calcDiffPackDelta(
      parseDiffPackMetricNumber(prevMeta?.restrictionTriggeredRate),
      parseDiffPackMetricNumber(nextMeta?.restrictionTriggeredRate),
    ),
    boundaryBBox: calcDiffPackBBoxDelta(
      parseDiffPackMetricBBox(prevMeta?.boundaryBBox),
      parseDiffPackMetricBBox(nextMeta?.boundaryBBox),
    ),
    boundaryCenter: calcDiffPackCenterDelta(
      parseDiffPackMetricCenter(prevMeta?.boundaryCenter),
      parseDiffPackMetricCenter(nextMeta?.boundaryCenter),
    ),
    provenanceFetchedAt: {
      prev: provenancePrev,
      next: provenanceNext,
      changed: provenancePrev !== provenanceNext,
    },
  }
}
