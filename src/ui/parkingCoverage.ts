import type { MapBounds } from '../map/bounds'
import {
  findCoverageDistrictById,
  findCoverageDistrictByLocation,
  isLocationInCoverageDistrict,
  type RuntimeCoverageCatalog,
  type RuntimeCoverageDistrict,
} from '../data/coverageCatalog'

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

const buildKnownDistrictNotice = (
  district: RuntimeCoverageDistrict,
  activeDistrictName: string,
) => {
  if (district.publishStage === 'source-only') {
    const referenceData = district.referenceData
    const countNotice = referenceData?.spatialReference
      ? ` (${referenceData.recordCount} official source rows; ${referenceData.spatialReference.featureCount} reviewed representative points, not curb geometry)`
      : referenceData
        ? ` (${referenceData.recordCount} official source rows, without geometry)`
        : ''
    return `This location is in ${district.districtName}, ${district.regionName}. ParkKing currently has paid-curb reference sources only for this area${countNotice}; curb-marking and sign rules are not available, so no parking legality answer was calculated.`
  }

  if (district.publishStage === 'candidate') {
    const aliasNotice = district.aliases
      .map(({ areaName, standaloneBoundaryRequired }) =>
        standaloneBoundaryRequired
          ? ` ${areaName} is tracked under ${district.districtName} and still needs a standalone reviewed boundary; this ${district.districtName} match does not confirm the point is inside ${areaName}.`
          : ` ${areaName} is listed as a parent-district alias.`,
      )
      .join('')
    const reviewNotice = district.requiresHumanReview
      ? ' It still requires human review and has not been published.'
      : ' It has not been published.'
    return `This location is in ${district.districtName} candidate coverage.${aliasNotice}${reviewNotice} ParkKing did not calculate a parking legality answer here.`
  }

  return `This location is in published ${district.districtName} coverage, but the active dataset is ${activeDistrictName}. ParkKing did not calculate a parking legality answer while a different district dataset is active.`
}

export const buildParkingCoverageState = (params: {
  location: [number, number] | null
  districtBounds: MapBounds | null
  districtName: string
  activeDistrictId?: string | null
  coverageCatalog?: RuntimeCoverageCatalog | null
}): ParkingCoverageState => {
  if (!params.location) {
    return { eligibleLocation: null, notice: null }
  }

  const activeCoverageDistrict =
    params.coverageCatalog && params.activeDistrictId
      ? findCoverageDistrictById(params.coverageCatalog, params.activeDistrictId)
      : null
  const isInsideActiveDistrict = activeCoverageDistrict
    ? isLocationInCoverageDistrict(activeCoverageDistrict, params.location)
    : !params.districtBounds ||
      isLocationWithinBounds(params.location, params.districtBounds)

  if (isInsideActiveDistrict) {
    return { eligibleLocation: params.location, notice: null }
  }

  const matchedDistrict = params.coverageCatalog
    ? findCoverageDistrictByLocation(params.coverageCatalog, params.location)
    : null

  return {
    eligibleLocation: null,
    notice: matchedDistrict
      ? buildKnownDistrictNotice(matchedDistrict, params.districtName)
      : `This location is outside the active ${params.districtName} dataset. ParkKing did not calculate a parking legality answer here. Switch to a published district dataset when coverage becomes available.`,
  }
}
