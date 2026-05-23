import { distanceMeters, getPathMidpoint } from './geo'

export type NavigationMode = 'walking' | 'driving'

export interface NavigationLinks {
  walking: string
  driving: string
}

export interface SegmentArrivalTarget {
  destination: [number, number]
  label: string
  description: string
  hint: string
  kind: 'SEGMENT' | 'PARKING_SPACE'
}

const GOOGLE_MAPS_DIRECTIONS_URL = 'https://www.google.com/maps/dir/'
const WALK_DISTANCE_DETOUR_FACTOR = 1.18

const formatLatLng = ([lng, lat]: [number, number]) => `${lat},${lng}`

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const getDirectionalEndDescriptions = (
  start: [number, number],
  end: [number, number],
) => {
  const deltaLng = end[0] - start[0]
  const deltaLat = end[1] - start[1]

  if (Math.abs(deltaLng) >= Math.abs(deltaLat)) {
    return deltaLng >= 0
      ? {
          startLabel: 'West end',
          startDescription: 'west end of this curb segment',
          endLabel: 'East end',
          endDescription: 'east end of this curb segment',
        }
      : {
          startLabel: 'East end',
          startDescription: 'east end of this curb segment',
          endLabel: 'West end',
          endDescription: 'west end of this curb segment',
        }
  }

  return deltaLat >= 0
    ? {
        startLabel: 'South end',
        startDescription: 'south end of this curb segment',
        endLabel: 'North end',
        endDescription: 'north end of this curb segment',
      }
    : {
        startLabel: 'North end',
        startDescription: 'north end of this curb segment',
        endLabel: 'South end',
        endDescription: 'south end of this curb segment',
      }
}

const buildArrivalTarget = (
  destination: [number, number],
  label: string,
  description: string,
  options: {
    kind?: SegmentArrivalTarget['kind']
    hintAction?: 'at' | 'near'
  } = {},
): SegmentArrivalTarget => ({
  destination,
  label,
  description: capitalize(description),
  hint: `Arrive ${options.hintAction ?? 'near'} the ${description}.`,
  kind: options.kind ?? 'SEGMENT',
})

const describePointAlongSegment = (
  path: [number, number][],
  destination: [number, number],
  noun: string,
) => {
  if (path.length <= 1) {
    return `${noun} at this curb point`
  }

  const start = path[0]
  const end = path[path.length - 1]
  const { startDescription, endDescription } = getDirectionalEndDescriptions(start, end)

  if (path.length === 2) {
    return distanceMeters(destination, start) <= distanceMeters(destination, end)
      ? `${noun} near the ${startDescription}`
      : `${noun} near the ${endDescription}`
  }

  const nearestIndex = path.reduce((bestIndex, point, index) => {
    const bestDistance = distanceMeters(destination, path[bestIndex])
    const candidateDistance = distanceMeters(destination, point)
    return candidateDistance < bestDistance ? index : bestIndex
  }, 0)
  const positionRatio = nearestIndex / (path.length - 1)

  if (positionRatio <= 0.2) {
    return `${noun} near the ${startDescription}`
  }
  if (positionRatio >= 0.8) {
    return `${noun} near the ${endDescription}`
  }

  return `${noun} near the middle of this curb segment`
}

export const estimateWalkDistanceMeters = (
  origin: [number, number] | null,
  destination: [number, number] | null,
) => {
  if (!origin || !destination) {
    return null
  }

  // Inflate straight-line distance slightly to approximate an on-street path.
  return Math.round(distanceMeters(origin, destination) * WALK_DISTANCE_DETOUR_FACTOR)
}

export const getSegmentArrivalTarget = (
  path: [number, number][],
  origin: [number, number] | null = null,
  preferredDestination: [number, number] | null = null,
): SegmentArrivalTarget | null => {
  if (path.length === 0) {
    return null
  }

  if (preferredDestination) {
    return buildArrivalTarget(
      preferredDestination,
      'Marked space',
      describePointAlongSegment(path, preferredDestination, 'marked parking space'),
      {
        kind: 'PARKING_SPACE',
        hintAction: 'at',
      },
    )
  }

  if (path.length === 1) {
    return {
      destination: path[0],
      label: 'Curb point',
      description: 'This curb point',
      hint: 'Arrive at this curb point.',
      kind: 'SEGMENT',
    }
  }

  if (!origin) {
    return buildArrivalTarget(
      getPathMidpoint(path),
      'Mid-segment',
      'middle of this curb segment',
    )
  }

  const start = path[0]
  const end = path[path.length - 1]
  const { startLabel, startDescription, endLabel, endDescription } =
    getDirectionalEndDescriptions(start, end)

  if (path.length === 2) {
    return distanceMeters(origin, start) <= distanceMeters(origin, end)
      ? buildArrivalTarget(start, startLabel, startDescription)
      : buildArrivalTarget(end, endLabel, endDescription)
  }

  const nearestIndex = path.reduce((bestIndex, point, index) => {
    const bestDistance = distanceMeters(origin, path[bestIndex])
    const candidateDistance = distanceMeters(origin, point)
    return candidateDistance < bestDistance ? index : bestIndex
  }, 0)
  const positionRatio = nearestIndex / (path.length - 1)

  if (positionRatio <= 0.2) {
    return buildArrivalTarget(start, startLabel, startDescription)
  }
  if (positionRatio >= 0.8) {
    return buildArrivalTarget(end, endLabel, endDescription)
  }

  return buildArrivalTarget(
    path[nearestIndex],
    'Mid-segment',
    'middle of this curb segment',
  )
}

export const getSegmentDestination = (
  path: [number, number][],
  origin: [number, number] | null = null,
  preferredDestination: [number, number] | null = null,
) => {
  return getSegmentArrivalTarget(path, origin, preferredDestination)?.destination ?? null
}

export const buildNavigationUrl = (
  destination: [number, number] | null,
  options: {
    mode: NavigationMode
    origin?: [number, number] | null
  },
) => {
  if (!destination) {
    return null
  }

  const url = new URL(GOOGLE_MAPS_DIRECTIONS_URL)
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', formatLatLng(destination))
  url.searchParams.set('travelmode', options.mode)
  url.searchParams.set('dir_action', 'navigate')

  if (options.origin) {
    url.searchParams.set('origin', formatLatLng(options.origin))
  }

  return url.toString()
}

export const buildNavigationLinks = (
  destination: [number, number] | null,
  origin?: [number, number] | null,
): NavigationLinks | null => {
  const walking = buildNavigationUrl(destination, {
    mode: 'walking',
    origin,
  })
  const driving = buildNavigationUrl(destination, {
    mode: 'driving',
    origin,
  })

  if (!walking || !driving) {
    return null
  }

  return {
    walking,
    driving,
  }
}
