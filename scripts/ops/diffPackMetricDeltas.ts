import type {
  BBox,
  BBoxDelta,
  CenterDelta,
  Delta,
  DistrictMetaDiff,
} from './diffPackMetricTypes'

export const calcDiffPackDelta = (
  prev: number | null,
  next: number | null,
): Delta<number> => {
  if (prev === null || next === null) {
    return { prev, next, delta: null, deltaPct: null }
  }
  const delta = next - prev
  const deltaPct = prev !== 0 ? delta / prev : null
  return { prev, next, delta, deltaPct }
}

const bboxArea = (bbox: BBox | null): number | null => {
  if (!bbox) {
    return null
  }
  const width = bbox.maxX - bbox.minX
  const height = bbox.maxY - bbox.minY
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }
  return Math.max(0, width * height)
}

export const calcDiffPackBBoxDelta = (
  prev: BBox | null,
  next: BBox | null,
): BBoxDelta => {
  const delta =
    prev && next
      ? {
          minX: next.minX - prev.minX,
          minY: next.minY - prev.minY,
          maxX: next.maxX - prev.maxX,
          maxY: next.maxY - prev.maxY,
        }
      : null

  const areaDelta = calcDiffPackDelta(bboxArea(prev), bboxArea(next))

  return {
    prev,
    next,
    delta,
    area: areaDelta,
  }
}

export const calcDiffPackCenterDelta = (
  prev: [number, number] | null,
  next: [number, number] | null,
): CenterDelta => {
  if (!prev || !next) {
    return { prev, next, delta: null, distance: null }
  }
  const delta: [number, number] = [next[0] - prev[0], next[1] - prev[1]]
  const distance = Math.hypot(delta[0], delta[1])
  return { prev, next, delta, distance }
}

export const hasMetaChanges = (meta: DistrictMetaDiff) => {
  const deltas = [
    meta.segmentsCount.delta,
    meta.overridesAppliedCount.delta,
    meta.signOverridesCount.delta,
    meta.signOverrideMatchedSegmentCount?.delta ?? null,
    meta.signOverrideSpatialMatchCount?.delta ?? null,
    meta.signOverrideUnmatchedNamedCount.delta,
    meta.curbMarkingKnownRate.delta,
    meta.restrictionTriggeredRate.delta,
  ]
  if (deltas.some((delta) => delta !== null && delta !== 0)) {
    return true
  }
  const bboxDelta = meta.boundaryBBox.delta
  if (bboxDelta && Object.values(bboxDelta).some((value) => value !== 0)) {
    return true
  }
  const centerDelta = meta.boundaryCenter.delta
  if (centerDelta && (centerDelta[0] !== 0 || centerDelta[1] !== 0)) {
    return true
  }
  return meta.provenanceFetchedAt.changed
}
