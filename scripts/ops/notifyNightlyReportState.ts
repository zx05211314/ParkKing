import { collectNightlyAlerts } from './notifyNightlyAlerts'
import { readNightlyDiffReport, resolveNightlyDiffPaths } from './notifyNightlyFiles'
import type { NightlyAlert } from './notifyNightlyTypes'

export interface NightlyAlertLoadResult {
  diffPaths: string[]
  alerts: NightlyAlert[]
}

export const loadNightlyAlertsFromInputs = async (
  diffInputs: string[],
): Promise<NightlyAlertLoadResult> => {
  const diffPaths = await resolveNightlyDiffPaths(diffInputs)
  if (diffPaths.length === 0) {
    return { diffPaths, alerts: [] }
  }

  const reports = await Promise.all(diffPaths.map((diffPath) => readNightlyDiffReport(diffPath)))
  return {
    diffPaths,
    alerts: collectNightlyAlerts(reports),
  }
}
