import { useEffect, useState } from 'react'

interface UseBrowserOnlineStateOptions {
  onOffline?: () => void
}

export const useBrowserOnlineState = ({
  onOffline,
}: UseBrowserOnlineStateOptions = {}) => {
  const [isOnline, setIsOnline] = useState<boolean | null>(() =>
    typeof navigator === 'undefined' ? null : navigator.onLine,
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleOnline = () => {
      setIsOnline(true)
    }
    const handleOffline = () => {
      onOffline?.()
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [onOffline])

  return isOnline
}
