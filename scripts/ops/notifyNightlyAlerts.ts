import type { DiffReport, NightlyAlert } from './notifyNightlyTypes'

export const collectNightlyAlerts = (reports: DiffReport[]): NightlyAlert[] => {
  const alerts: NightlyAlert[] = []
  reports.forEach((report) => {
    report.districts?.forEach((district) => {
      const severity = district.severity ?? 'OK'
      if (severity === 'OK') {
        return
      }
      alerts.push({
        districtId: district.districtId ?? 'unknown',
        severity,
        segmentsDeltaPct: district.meta?.segmentsCount?.deltaPct ?? null,
        directOverrideMatchesDelta:
          district.meta?.signOverrideMatchedSegmentCount?.delta ?? null,
        spatialOverrideMatchesDelta:
          district.meta?.signOverrideSpatialMatchCount?.delta ?? null,
        unmatchedNamedOverridesDelta:
          district.meta?.signOverrideUnmatchedNamedCount?.delta ?? null,
        curbKnownDelta: district.meta?.curbMarkingKnownRate?.delta ?? null,
        restrictionDelta: district.meta?.restrictionTriggeredRate?.delta ?? null,
      })
    })
  })

  return alerts.sort((a, b) => a.districtId.localeCompare(b.districtId))
}
