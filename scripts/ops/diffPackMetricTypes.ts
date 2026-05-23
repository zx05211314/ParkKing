export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Delta<T> {
  prev: T | null
  next: T | null
  delta: T | null
  deltaPct: number | null
}

export interface BBoxDelta {
  prev: BBox | null
  next: BBox | null
  delta: BBox | null
  area: Delta<number>
}

export interface CenterDelta {
  prev: [number, number] | null
  next: [number, number] | null
  delta: [number, number] | null
  distance: number | null
}

export interface DistrictMetaDiff {
  segmentsCount: Delta<number>
  overridesAppliedCount: Delta<number>
  signOverridesCount: Delta<number>
  signOverrideMatchedSegmentCount?: Delta<number>
  signOverrideSpatialMatchCount?: Delta<number>
  signOverrideUnmatchedNamedCount: Delta<number>
  curbMarkingKnownRate: Delta<number>
  restrictionTriggeredRate: Delta<number>
  boundaryBBox: BBoxDelta
  boundaryCenter: CenterDelta
  provenanceFetchedAt: {
    prev: string | null
    next: string | null
    changed: boolean
  }
}
