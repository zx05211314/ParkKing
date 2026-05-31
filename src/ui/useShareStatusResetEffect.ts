import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { ShareStatus } from './appLifecycleEffectTypes'

export const useShareStatusResetEffect = (
  shareStatus: ShareStatus | null,
  setShareStatus: Dispatch<SetStateAction<ShareStatus | null>>,
) => {
  useEffect(() => {
    if (!shareStatus || typeof window === 'undefined') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShareStatus(null)
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [setShareStatus, shareStatus])
}
