import type { MapBounds } from '../map/bounds'

export interface ParkingCoverageState {
  eligibleLocation: [number, number] | null
  notice: string | null
}

export const isLocationWithinBounds = (
  location: [number, number],
  bounds: MapBounds,
) => {
  const [longitude, latitude] = location
  const [[west, south], [east, north]] = bounds
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= west &&
    longitude <= east &&
    latitude >= south &&
    latitude <= north
  )
}

export const buildParkingCoverageState = (params: {
  location: [number, number] | null
  districtBounds: MapBounds | null
  districtName: string
}): ParkingCoverageState => {
  if (!params.location) {
    return { eligibleLocation: null, notice: null }
  }
  if (
    !params.districtBounds ||
    isLocationWithinBounds(params.location, params.districtBounds)
  ) {
    return { eligibleLocation: params.location, notice: null }
  }

  return {
    eligibleLocation: null,
    notice: `This location is outside the active ${params.districtName} dataset. ParkKing did not calculate a parking legality answer here. Switch to a published district dataset when coverage becomes available.`,
  }
}
