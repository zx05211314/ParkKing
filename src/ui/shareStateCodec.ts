import type { TimeMode } from '../domain/rules/time'
import { isRecommendationRankMode, isRiskMode, isRouteProfile } from './appPresentationLabels'
import { isSegmentActionFilter } from './segmentActionFilter'
import type { SharedAppState, SharedSearchBounds } from './sharedAppStateTypes'

const normalizeText = (value: string | null) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const parseNumber = (value: string | null) => {
  if (!value) {
    return null
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseInteger = (value: string | null) => {
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

const parseBoolean = (value: string | null) => {
  if (value === '1') {
    return true
  }
  if (value === '0') {
    return false
  }
  return null
}

const parseBounds = (value: string | null): SharedSearchBounds | null => {
  const parts = value?.split(',').map((part) => Number.parseFloat(part.trim())) ?? []
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null
  }
  return [
    [parts[0], parts[1]],
    [parts[2], parts[3]],
  ]
}

const formatCoordinate = (value: number) => value.toFixed(6)

const formatBounds = (bounds: SharedSearchBounds) =>
  [
    formatCoordinate(bounds[0][0]),
    formatCoordinate(bounds[0][1]),
    formatCoordinate(bounds[1][0]),
    formatCoordinate(bounds[1][1]),
  ].join(',')

const isTimeMode = (value: string | null): value is TimeMode =>
  value === 'NOW' || value === 'NIGHT'

const isActiveView = (value: string | null): value is 'LIST' | 'MAP' =>
  value === 'LIST' || value === 'MAP'

export const readSharedAppStateFromParams = (
  params: URLSearchParams,
): SharedAppState => {
  const lat = parseNumber(params.get('lat'))
  const lng = parseNumber(params.get('lng'))
  const searchLabel = normalizeText(params.get('address'))
  const searchResult =
    lat !== null && lng !== null && searchLabel
      ? {
          id:
            normalizeText(params.get('place')) ??
            `shared:${lng.toFixed(5)},${lat.toFixed(5)}`,
          label: searchLabel,
          center: [lng, lat] as [number, number],
          bounds: parseBounds(params.get('bbox')),
        }
      : null

  const recommendationRankMode = params.get('rank')
  const routeProfile = params.get('route')
  const riskMode = params.get('risk')
  const mode = params.get('time')
  const actionFilter = params.get('action')
  const activeView = params.get('view')

  return {
    datasetId: normalizeText(params.get('dataset')),
    filterQuery: normalizeText(params.get('filter')) ?? '',
    searchResult,
    selectedId: normalizeText(params.get('segment')),
    selectedParkingSpaceKey: normalizeText(params.get('space')),
    recommendationRankMode: isRecommendationRankMode(recommendationRankMode)
      ? recommendationRankMode
      : null,
    routeProfile: isRouteProfile(routeProfile) ? routeProfile : null,
    riskMode: isRiskMode(riskMode) ? riskMode : null,
    mode: isTimeMode(mode) ? mode : null,
    radiusMeters: parseInteger(params.get('radius')),
    actionFilter: isSegmentActionFilter(actionFilter) ? actionFilter : null,
    markedSpacesOnly: parseBoolean(params.get('spacesOnly')),
    hideReportedIllegal: parseBoolean(params.get('hideIllegal')),
    includeInferred: parseBoolean(params.get('inferred')),
    activeView: isActiveView(activeView) ? activeView : null,
  }
}

export const buildSharedAppStateSearchFromState = (state: SharedAppState) => {
  const params = new URLSearchParams()

  if (state.datasetId) {
    params.set('dataset', state.datasetId)
  }
  if (state.filterQuery.trim().length > 0) {
    params.set('filter', state.filterQuery.trim())
  }
  if (state.searchResult) {
    params.set('place', state.searchResult.id)
    params.set('address', state.searchResult.label)
    params.set('lat', formatCoordinate(state.searchResult.center[1]))
    params.set('lng', formatCoordinate(state.searchResult.center[0]))
    if (state.searchResult.bounds) {
      params.set('bbox', formatBounds(state.searchResult.bounds))
    }
  }
  if (state.selectedId) {
    params.set('segment', state.selectedId)
  }
  if (state.selectedParkingSpaceKey) {
    params.set('space', state.selectedParkingSpaceKey)
  }
  if (state.recommendationRankMode) {
    params.set('rank', state.recommendationRankMode)
  }
  if (state.routeProfile) {
    params.set('route', state.routeProfile)
  }
  if (state.riskMode) {
    params.set('risk', state.riskMode)
  }
  if (state.mode) {
    params.set('time', state.mode)
  }
  if (state.radiusMeters !== null && Number.isFinite(state.radiusMeters)) {
    params.set('radius', String(Math.round(state.radiusMeters)))
  }
  if (state.actionFilter) {
    params.set('action', state.actionFilter)
  }
  if (state.markedSpacesOnly !== null) {
    params.set('spacesOnly', state.markedSpacesOnly ? '1' : '0')
  }
  if (state.hideReportedIllegal !== null) {
    params.set('hideIllegal', state.hideReportedIllegal ? '1' : '0')
  }
  if (state.includeInferred !== null) {
    params.set('inferred', state.includeInferred ? '1' : '0')
  }
  if (state.activeView) {
    params.set('view', state.activeView)
  }

  const query = params.toString()
  return query.length > 0 ? `?${query}` : ''
}
