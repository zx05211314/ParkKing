import { getPathMidpoint } from '../../src/map/geo'
import type { EvaluatedSegment } from '../../src/ui/types'
import type { QaCandidateRow } from './sampleQaCandidateTypes'
import { toFlags, toTopReasons } from './sampleQaCandidateFlags'

const formatCoord = (value: number) => value.toFixed(6)
const formatScore = (value: number) => value.toFixed(4)
const formatOptional = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value)

export const toQaCandidateRow = (
  districtId: string,
  segment: EvaluatedSegment,
  reviewBucket = 'ranked',
): QaCandidateRow => {
  const [lon, lat] = getPathMidpoint(segment.path)
  const latText = formatCoord(lat)
  const lonText = formatCoord(lon)
  const rankScore = (segment as EvaluatedSegment & { rankScore?: unknown }).rankScore
  const score = formatScore(typeof rankScore === 'number' ? rankScore : 0)
  return {
    districtId,
    segmentId: segment.id,
    lat: latText,
    lon: lonText,
    score,
    reviewBucket,
    tier: segment.tier,
    allowedNow: segment.allowedNow,
    curbMarking: segment.curbMarking,
    sourceType: segment.sourceType ?? '',
    sourceReliability: formatOptional(segment.sourceReliability),
    dataFreshnessDays: formatOptional(segment.dataFreshnessDays),
    finalConfidence: formatOptional(segment.finalConfidence),
    coverageConfidence: formatOptional(segment.coverageConfidence),
    overrideConfidence: formatOptional(segment.overrideConfidence),
    parkingSpaceCount: String(segment.parkingSpaceCount ?? 0),
    topReasons: toTopReasons(segment),
    flags: toFlags(segment),
    riskTags: segment.riskTags ?? [],
    signOverrideStatus: segment.signOverride?.status ?? '',
    signOverrideSource: segment.signOverride?.source ?? '',
    signOverrideVerifiedAt: segment.signOverride?.verifiedAt ?? '',
    signOverrideNote: segment.signOverride?.note ?? '',
    mapsUrl: `https://www.google.com/maps?q=${latText},${lonText}`,
    streetViewUrl: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latText},${lonText}`,
    reviewSource: '',
    reviewStatus: '',
    reviewNote: '',
    createdAt: '',
  }
}
