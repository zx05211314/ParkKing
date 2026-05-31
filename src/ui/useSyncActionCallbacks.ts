import { useCallback } from 'react'
import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'

interface UseSyncActionCallbacksOptions {
  runAction: (silent: boolean, resources?: SyncRuntimeResource[]) => Promise<void>
}

interface UseSyncActionCallbacksResult {
  handleAutoAction: () => Promise<void>
  handleAutoResourcesAction: (resources: SyncRuntimeResource[]) => Promise<void>
  handleManualAction: () => Promise<void>
  handleManualResourceAction: (resource: SyncRuntimeResource) => Promise<void>
}

export const useSyncActionCallbacks = ({
  runAction,
}: UseSyncActionCallbacksOptions): UseSyncActionCallbacksResult => {
  const handleManualAction = useCallback(async () => {
    await runAction(false)
  }, [runAction])

  const handleAutoAction = useCallback(async () => {
    await runAction(true)
  }, [runAction])

  const handleAutoResourcesAction = useCallback(
    async (resources: SyncRuntimeResource[]) => {
      await runAction(true, resources)
    },
    [runAction],
  )

  const handleManualResourceAction = useCallback(
    async (resource: SyncRuntimeResource) => {
      await runAction(false, [resource])
    },
    [runAction],
  )

  return {
    handleAutoAction,
    handleAutoResourcesAction,
    handleManualAction,
    handleManualResourceAction,
  }
}
