import { useEffect, useState } from 'react'
import {
  getSyncRuntimeStatusSnapshot,
  subscribeSyncRuntimeStatus,
} from '../api/syncRuntimeStatus'

export const useSyncRuntimeSnapshot = () => {
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(() =>
    getSyncRuntimeStatusSnapshot(),
  )

  useEffect(
    () =>
      subscribeSyncRuntimeStatus(() => {
        setRuntimeSnapshot(getSyncRuntimeStatusSnapshot())
      }),
    [],
  )

  return runtimeSnapshot
}
