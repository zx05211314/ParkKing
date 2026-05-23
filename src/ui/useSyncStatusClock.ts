import { useEffect, useState } from 'react'
import {
  resolveSyncStatusClockBoundaryDelay,
  SYNC_STATUS_CLOCK_MS,
} from './syncStatusPolling'

export const useSyncStatusClock = () => {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    let intervalId: number | null = null
    const tick = () => {
      if (!cancelled) {
        setNowMs(Date.now())
      }
    }
    const nextBoundaryDelay = resolveSyncStatusClockBoundaryDelay(Date.now())
    const timeoutId = window.setTimeout(() => {
      tick()
      intervalId = window.setInterval(tick, SYNC_STATUS_CLOCK_MS)
    }, nextBoundaryDelay)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [])

  return {
    nowMs,
    setNowMs,
  }
}
