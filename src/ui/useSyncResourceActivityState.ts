import { useCallback, useRef, useState } from 'react'
import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'

const createInitialSyncResourceActivityState = (): Record<
  SyncRuntimeResource,
  boolean
> => ({
  savedPlans: false,
  reports: false,
  issueReports: false,
})

export const useSyncResourceActivityState = () => {
  const [resourceState, setResourceStateValue] = useState(
    createInitialSyncResourceActivityState,
  )
  const resourceStateRef = useRef(resourceState)

  const setResourceState = useCallback(
    (resources: SyncRuntimeResource[], value: boolean) => {
      if (resources.length === 0) {
        return
      }

      const nextState = { ...resourceStateRef.current }
      resources.forEach((resource) => {
        nextState[resource] = value
      })
      resourceStateRef.current = nextState
      setResourceStateValue(nextState)
    },
    [],
  )

  return {
    resourceState,
    resourceStateRef,
    setResourceState,
  }
}
