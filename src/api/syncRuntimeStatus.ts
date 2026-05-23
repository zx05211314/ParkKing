export type SyncRuntimeResource = 'savedPlans' | 'reports' | 'issueReports'
export type SyncRetrySource = 'auto' | 'manual'

export type SyncRuntimeMode =
  | 'idle'
  | 'local-only'
  | 'syncing'
  | 'remote'
  | 'fallback-local'

export interface SyncRuntimeResourceStatus {
  mode: SyncRuntimeMode
  message: string
  updatedAt: number | null
  lastFailureReason: string | null
  lastFailureAt: number | null
  lastRecoveredAt: number | null
  lastRemoteAt: number | null
  lastPushAt: number | null
  lastRetryAt: number | null
  lastRetrySource: SyncRetrySource | null
  retryAttemptCount: number
  nextRetryAt: number | null
  pendingCount: number
  lastRemoteCount: number | null
  lastPushCount: number | null
}

export type SyncRuntimeStatusSnapshot = Record<
  SyncRuntimeResource,
  SyncRuntimeResourceStatus
>

type SyncRuntimeListener = () => void

const createIdleStatus = (): SyncRuntimeResourceStatus => ({
  mode: 'idle',
  message: '',
  updatedAt: null,
  lastFailureReason: null,
  lastFailureAt: null,
  lastRecoveredAt: null,
  lastRemoteAt: null,
  lastPushAt: null,
  lastRetryAt: null,
  lastRetrySource: null,
  retryAttemptCount: 0,
  nextRetryAt: null,
  pendingCount: 0,
  lastRemoteCount: null,
  lastPushCount: null,
})

const createDefaultSnapshot = (): SyncRuntimeStatusSnapshot => ({
  savedPlans: createIdleStatus(),
  reports: createIdleStatus(),
  issueReports: createIdleStatus(),
})

let runtimeSnapshot: SyncRuntimeStatusSnapshot = createDefaultSnapshot()
const listeners = new Set<SyncRuntimeListener>()

const emitRuntimeStatusChange = () => {
  listeners.forEach((listener) => {
    listener()
  })
}

export const getSyncRuntimeStatusSnapshot = (): SyncRuntimeStatusSnapshot =>
  runtimeSnapshot

export const setSyncRuntimeResourceStatus = (
  resource: SyncRuntimeResource,
  status: Pick<SyncRuntimeResourceStatus, 'mode' | 'message'> & {
    failureReason?: string | null
    pendingCount?: number
    lastRemoteCount?: number | null
    remoteEvent?: 'pull' | 'push'
  },
) => {
  const currentStatus = runtimeSnapshot[resource]
  const now = Date.now()
  const normalizeCount = (value: number | null | undefined) => {
    if (value === null) {
      return null
    }
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      return undefined
    }
    return Math.floor(value)
  }
  const nextPendingCount = normalizeCount(status.pendingCount)
  const nextRemoteCount = normalizeCount(status.lastRemoteCount)
  const didTouchRemote = status.remoteEvent === 'pull' || status.remoteEvent === 'push'
  const shouldResetRetryState =
    status.mode === 'remote' || status.mode === 'local-only' || status.mode === 'idle'
  runtimeSnapshot = {
    ...runtimeSnapshot,
    [resource]: {
      mode: status.mode,
      message: status.message,
      updatedAt: now,
      lastFailureReason:
        status.mode === 'fallback-local'
          ? status.failureReason?.trim() || status.message
          : currentStatus.lastFailureReason,
      lastFailureAt:
        status.mode === 'fallback-local' ? now : currentStatus.lastFailureAt,
      lastRecoveredAt:
        status.mode === 'remote' && currentStatus.mode !== 'remote'
          ? now
          : currentStatus.lastRecoveredAt,
      lastRemoteAt: didTouchRemote ? now : currentStatus.lastRemoteAt,
      lastPushAt:
        status.remoteEvent === 'push' ? now : currentStatus.lastPushAt,
      lastRetryAt: currentStatus.lastRetryAt,
      lastRetrySource: currentStatus.lastRetrySource,
      retryAttemptCount: shouldResetRetryState ? 0 : currentStatus.retryAttemptCount,
      nextRetryAt: shouldResetRetryState ? null : currentStatus.nextRetryAt,
      pendingCount:
        nextPendingCount !== undefined
          ? nextPendingCount ?? 0
          : status.mode === 'local-only' || status.mode === 'idle'
            ? 0
            : currentStatus.pendingCount,
      lastRemoteCount:
        nextRemoteCount !== undefined
          ? nextRemoteCount
          : currentStatus.lastRemoteCount,
      lastPushCount:
        status.remoteEvent === 'push'
          ? nextRemoteCount !== undefined
            ? nextRemoteCount
            : currentStatus.lastPushCount
          : currentStatus.lastPushCount,
    },
  }
  emitRuntimeStatusChange()
}

interface NoteSyncRuntimeRetryAttemptOptions {
  nowMs?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitterRatio?: number
  randomFn?: () => number
  source?: SyncRetrySource
}

const DEFAULT_SYNC_RETRY_BASE_DELAY_MS = 60_000
const DEFAULT_SYNC_RETRY_MAX_DELAY_MS = 15 * 60_000
const DEFAULT_SYNC_RETRY_JITTER_RATIO = 0.25

export const noteSyncRuntimeRetryAttempt = (
  resource: SyncRuntimeResource,
  {
    nowMs = Date.now(),
    baseDelayMs = DEFAULT_SYNC_RETRY_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_SYNC_RETRY_MAX_DELAY_MS,
    jitterRatio = DEFAULT_SYNC_RETRY_JITTER_RATIO,
    randomFn = Math.random,
    source = 'auto',
  }: NoteSyncRuntimeRetryAttemptOptions = {},
) => {
  const currentStatus = runtimeSnapshot[resource]
  const nextAttemptCount = currentStatus.retryAttemptCount + 1
  const normalizedJitterRatio =
    Number.isFinite(jitterRatio) && jitterRatio >= 0 ? jitterRatio : 0
  const randomValue = randomFn()
  const normalizedRandom = Number.isFinite(randomValue) ? randomValue : 0.5
  const jitterMultiplier = Math.max(
    0.1,
    1 + (normalizedRandom * 2 - 1) * normalizedJitterRatio,
  )
  const nextRetryDelayMs = Math.min(
    maxDelayMs,
    Math.round(
      baseDelayMs * 2 ** Math.max(0, nextAttemptCount - 1) * jitterMultiplier,
    ),
  )

  runtimeSnapshot = {
    ...runtimeSnapshot,
    [resource]: {
      ...currentStatus,
      updatedAt: nowMs,
      lastRetryAt: nowMs,
      lastRetrySource: source,
      retryAttemptCount: nextAttemptCount,
      nextRetryAt: nowMs + nextRetryDelayMs,
    },
  }
  emitRuntimeStatusChange()
}

export const subscribeSyncRuntimeStatus = (listener: SyncRuntimeListener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const resetSyncRuntimeStatusForTests = () => {
  runtimeSnapshot = createDefaultSnapshot()
  listeners.clear()
}
