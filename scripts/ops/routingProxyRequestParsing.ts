import {
  isRoutingProfile,
  normalizeRoutingText,
  parseRoutingNumber,
} from './routingProxyConfig'
import type { RoutingProfile } from './routingProxyTypes'

export const parseCoordinate = (value: string | null): [number, number] | null => {
  if (!value) {
    return null
  }
  const [lngRaw, latRaw] = value.split(',', 2)
  const lng = parseRoutingNumber(lngRaw)
  const lat = parseRoutingNumber(latRaw)
  if (lng === null || lat === null) {
    return null
  }
  return [lng, lat]
}

export const parseCoordinates = (value: string | null): [number, number][] => {
  if (!value) {
    return []
  }
  return value
    .split(';')
    .map((part) => parseCoordinate(part.trim()))
    .filter((coordinate): coordinate is [number, number] => coordinate !== null)
}

export interface ParsedRoutingProxyRequest {
  profile: RoutingProfile | null
  mode: 'matrix' | 'path'
  origin: [number, number] | null
  destination: [number, number] | null
  destinations: [number, number][]
}

export const parseRoutingProxyRequest = (
  url: URL,
): ParsedRoutingProxyRequest => {
  const profileValue = normalizeRoutingText(url.searchParams.get('profile'))
  const profile = isRoutingProfile(profileValue) ? profileValue : null
  const mode = normalizeRoutingText(url.searchParams.get('mode')) === 'path'
    ? 'path'
    : 'matrix'
  const origin = parseCoordinate(url.searchParams.get('origin'))
  const destination = parseCoordinate(url.searchParams.get('destination'))
  const destinations =
    mode === 'path' ? [] : parseCoordinates(url.searchParams.get('destinations'))

  return {
    profile,
    mode,
    origin,
    destination,
    destinations,
  }
}
