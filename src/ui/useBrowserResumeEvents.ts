import { useEffect } from 'react'
import {
  BROWSER_RESUME_WINDOW_EVENTS,
  shouldResumeFromVisibilityState,
} from './browserResumeEvents'

interface UseBrowserResumeEventsOptions {
  enabled?: boolean
  onResume: () => void
}

export const useBrowserResumeEvents = ({
  enabled = true,
  onResume,
}: UseBrowserResumeEventsOptions) => {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const handleResume = () => {
      onResume()
    }
    const handleVisibilityChange = () => {
      if (shouldResumeFromVisibilityState(document.visibilityState)) {
        onResume()
      }
    }

    BROWSER_RESUME_WINDOW_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleResume)
    })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      BROWSER_RESUME_WINDOW_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleResume)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, onResume])
}
