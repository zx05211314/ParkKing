import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface RunSyncActionWithResourceStateOptions {
  activeResources: SyncRuntimeResource[]
  silent: boolean
  setResourceState: (resources: SyncRuntimeResource[], value: boolean) => void
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  fallbackErrorMessage: string
  action: () => Promise<TripBoardActionStatus | null | void>
  setBusyState?: Dispatch<SetStateAction<boolean>>
  inFlightRef?: MutableRefObject<boolean>
  onStart?: (resources: SyncRuntimeResource[]) => void
}

export const buildSyncActionErrorStatus = (
  error: unknown,
  fallbackErrorMessage: string,
): TripBoardActionStatus => ({
  kind: 'error',
  message:
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallbackErrorMessage,
})

export const runSyncActionWithResourceState = async ({
  activeResources,
  silent,
  setResourceState,
  setShareStatus,
  fallbackErrorMessage,
  action,
  setBusyState,
  inFlightRef,
  onStart,
}: RunSyncActionWithResourceStateOptions) => {
  if (activeResources.length === 0) {
    return false
  }
  if (inFlightRef?.current) {
    return false
  }

  if (inFlightRef) {
    inFlightRef.current = true
  }
  setBusyState?.(true)
  setResourceState(activeResources, true)
  onStart?.(activeResources)

  try {
    const status = await action()
    if (!silent && status) {
      setShareStatus(status)
    }
    return true
  } catch (error) {
    if (!silent) {
      setShareStatus(buildSyncActionErrorStatus(error, fallbackErrorMessage))
    }
    return false
  } finally {
    if (inFlightRef) {
      inFlightRef.current = false
    }
    setBusyState?.(false)
    setResourceState(activeResources, false)
  }
}
