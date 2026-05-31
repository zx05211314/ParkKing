import type { DistrictDiff, PackDiffReport } from './diffPackTypes'
import type { DeltaField } from './reportGateAnomalyTypes'

export const pickDelta = (delta: Record<string, unknown> | undefined): DeltaField | null => {
  if (!delta) {
    return null
  }
  const prev = Number(delta.prev)
  const next = Number(delta.next)
  const deltaValue = Number(delta.delta)
  const deltaPct = Number(delta.deltaPct)
  return {
    prev: Number.isFinite(prev) ? prev : null,
    next: Number.isFinite(next) ? next : null,
    delta: Number.isFinite(deltaValue) ? deltaValue : null,
    deltaPct: Number.isFinite(deltaPct) ? deltaPct : null,
  }
}

export const extractDistrictDiff = (
  diffReport: PackDiffReport | null,
  districtId: string,
): DistrictDiff | null => {
  if (!diffReport?.districts?.length) {
    return null
  }
  return diffReport.districts.find((entry) => entry.districtId === districtId) ?? null
}
