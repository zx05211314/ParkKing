import {
  buildSharedAppStateSearch,
  buildSharedAppStateUrl,
} from './shareState'
import type { ShareLocationLike, SharedAppState } from './shareState'

export const buildShareSearchValue = (
  sharedAppState: SharedAppState,
  hasShareableState: boolean,
) => (hasShareableState ? buildSharedAppStateSearch(sharedAppState) : '')

export const buildCurrentSharedAppUrl = ({
  sharedAppState,
  hasShareableState,
  location,
}: {
  sharedAppState: SharedAppState
  hasShareableState: boolean
  location: ShareLocationLike | null
}) => {
  if (!hasShareableState || !location) {
    return null
  }
  return buildSharedAppStateUrl(sharedAppState, location)
}

export const buildOverriddenSharedAppUrl = ({
  sharedAppState,
  overrides,
  location,
}: {
  sharedAppState: SharedAppState
  overrides: Partial<SharedAppState>
  location: ShareLocationLike | null
}) => {
  if (!location) {
    return null
  }
  return buildSharedAppStateUrl(
    {
      ...sharedAppState,
      ...overrides,
    },
    location,
  )
}
