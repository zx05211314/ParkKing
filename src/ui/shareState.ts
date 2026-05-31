import {
  buildSharedAppStateSearchFromState,
  readSharedAppStateFromParams,
} from './shareStateCodec'
import type { ShareLocationLike, SharedAppState } from './sharedAppStateTypes'

export type { ShareLocationLike, SharedAppState } from './sharedAppStateTypes'

export const readSharedAppState = (search: string): SharedAppState => {
  return readSharedAppStateFromParams(new URLSearchParams(search))
}

export const buildSharedAppStateSearch = (state: SharedAppState) => {
  return buildSharedAppStateSearchFromState(state)
}

export const buildSharedAppStateUrl = (
  state: SharedAppState,
  location: ShareLocationLike,
) => {
  return `${location.origin}${location.pathname}${buildSharedAppStateSearch(state)}${location.hash ?? ''}`
}
