import { useCallback, useMemo } from 'react'
import type { SharedAppState } from './shareState'
import {
  buildCurrentSharedAppUrl,
  buildOverriddenSharedAppUrl,
  buildShareSearchValue,
} from './sharedAppUrl'

interface UseSharedAppUrlStateOptions {
  sharedAppState: SharedAppState
  hasShareableState: boolean
}

interface UseSharedAppUrlStateResult {
  shareSearch: string
  currentShareUrl: string | null
  buildShareUrlForState: (overrides: Partial<SharedAppState>) => string | null
}

export const useSharedAppUrlState = ({
  sharedAppState,
  hasShareableState,
}: UseSharedAppUrlStateOptions): UseSharedAppUrlStateResult => {
  const shareSearch = useMemo(
    () => buildShareSearchValue(sharedAppState, hasShareableState),
    [hasShareableState, sharedAppState],
  )

  const currentShareUrl = useMemo(
    () =>
      buildCurrentSharedAppUrl({
        sharedAppState,
        hasShareableState,
        location:
          typeof window === 'undefined'
            ? null
            : {
                origin: window.location.origin,
                pathname: window.location.pathname,
                hash: window.location.hash,
              },
      }),
    [hasShareableState, sharedAppState],
  )

  const buildShareUrlForState = useCallback(
    (overrides: Partial<SharedAppState>) => {
      return buildOverriddenSharedAppUrl({
        sharedAppState,
        overrides,
        location:
          typeof window === 'undefined'
            ? null
            : {
                origin: window.location.origin,
                pathname: window.location.pathname,
                hash: window.location.hash,
              },
      })
    },
    [sharedAppState],
  )

  return {
    shareSearch,
    currentShareUrl,
    buildShareUrlForState,
  }
}
