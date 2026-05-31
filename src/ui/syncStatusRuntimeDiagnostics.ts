import type { SyncRuntimeResource, SyncRuntimeStatusSnapshot } from '../api/syncRuntimeStatus'
import {
  formatRelativeAge,
  formatRelativeDelay,
  formatRetrySourceLabel,
} from './syncStatusRuntimeFormatting'

export const buildRuntimeDiagnostics = (
  runtimeSnapshot: SyncRuntimeStatusSnapshot,
  nowMs: number,
) => {
  const resourceDiagnostics = {
    savedPlans: [] as string[],
    reports: [] as string[],
    issueReports: [] as string[],
  }

  ;(Object.entries(runtimeSnapshot) as Array<
    [SyncRuntimeResource, SyncRuntimeStatusSnapshot[SyncRuntimeResource]]
  >).forEach(([resource, status]) => {
    const diagnostics = resourceDiagnostics[resource]
    if (status.pendingCount > 0) {
      diagnostics.push(`${status.pendingCount} pending remote confirmation.`)
    }
    if (status.pendingCount > 0 && status.retryAttemptCount > 0) {
      const retrySourceLabel = formatRetrySourceLabel(status.lastRetrySource)
      diagnostics.push(
        status.nextRetryAt !== null && status.nextRetryAt > nowMs
          ? `${retrySourceLabel} ${status.retryAttemptCount} scheduled ${formatRelativeDelay(
              status.nextRetryAt,
              nowMs,
            )}.`
          : `${retrySourceLabel} window is open now.`,
      )
      if (status.lastRetryAt !== null) {
        diagnostics.push(
          `last ${retrySourceLabel} ${formatRelativeAge(
            status.lastRetryAt,
            nowMs,
          )}.`,
        )
      }
    }
    if (
      (status.lastPushAt ?? status.lastRemoteAt) !== null &&
      (status.pendingCount > 0 || status.lastFailureAt !== null)
    ) {
      const lastSuccessfulPushAt = status.lastPushAt ?? status.lastRemoteAt
      const lastSuccessfulPushCount = status.lastPushCount ?? status.lastRemoteCount
      diagnostics.push(
        `last successful push ${formatRelativeAge(
          lastSuccessfulPushAt!,
          nowMs,
        )}${lastSuccessfulPushCount !== null ? ` (${lastSuccessfulPushCount} confirmed).` : '.'}`,
      )
    }
    if (status.lastFailureAt === null) {
      return
    }

    const lastFailureAge = formatRelativeAge(status.lastFailureAt, nowMs)
    if (
      status.lastRecoveredAt !== null &&
      status.lastRecoveredAt >= status.lastFailureAt &&
      status.mode === 'remote'
    ) {
      diagnostics.push(
        `recovered ${formatRelativeAge(
          status.lastRecoveredAt,
          nowMs,
        )} after the last failure ${lastFailureAge}.`,
      )
      return
    }

    diagnostics.push(
      `last failure ${lastFailureAge}. ${status.lastFailureReason ?? status.message}`,
    )
  })

  return resourceDiagnostics
}
