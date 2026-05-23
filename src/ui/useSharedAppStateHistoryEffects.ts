import { useEffect } from 'react'
import { readSharedAppState, type SharedAppState } from './shareState'

interface UseSharedAppStateHistoryEffectsOptions {
  shareSearch: string
  applySharedState: (nextState: SharedAppState) => void
}

export const useSharedAppStateHistoryEffects = ({
  shareSearch,
  applySharedState,
}: UseSharedAppStateHistoryEffectsOptions) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nextUrl = `${window.location.pathname}${shareSearch}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [shareSearch])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePopState = () => {
      applySharedState(readSharedAppState(window.location.search))
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [applySharedState])
}
