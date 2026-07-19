import {
  OVERRIDE_SCHEMA_VERSIONS,
  isOverrideStatus,
  parseSchemaVersion,
} from './publishGatePolicy'
import { isValidHHMM } from '../../src/domain/rules/time'
import {
  normalizeOverrideSegmentId,
  parseSegmentId,
} from './publishGateSegments'

export interface PublishGateOverrideFeatureState {
  index: number
  segmentId: string | null
  normalizedSegmentId: string | null
  hasValidStatus: boolean
  schemaRaw: unknown
  schemaVersion: number | null
  hasKnownSchemaVersion: boolean
  reviewedSegmentId: string | null
  normalizedReviewedSegmentId: string | null
  reviewedHhmm: string | null
  hasValidReviewedHhmm: boolean
}

export const buildPublishGateOverrideFeatureState = (params: {
  index: number
  properties?: Record<string, unknown> | null
}): PublishGateOverrideFeatureState => {
  const props = params.properties as Record<string, unknown> | null
  const segmentId = parseSegmentId(props)
  const statusRaw = props?.override_status ?? props?.status ?? props?.report_status
  const status =
    typeof statusRaw === 'string' ? statusRaw.trim().toUpperCase() : ''
  const schemaRaw =
    props?.override_schema_version ?? props?.schemaVersion ?? props?.schema_version
  const schemaVersion = parseSchemaVersion(schemaRaw)
  const reviewedSegmentIdRaw =
    props?.override_reviewed_segment_id ??
    props?.reviewedSegmentId ??
    props?.reviewed_segment_id
  const reviewedSegmentId =
    typeof reviewedSegmentIdRaw === 'string' && reviewedSegmentIdRaw.trim()
      ? reviewedSegmentIdRaw.trim()
      : null
  const reviewedHhmmRaw =
    props?.override_reviewed_hhmm ?? props?.reviewedHhmm ?? props?.reviewed_hhmm
  const reviewedHhmm =
    typeof reviewedHhmmRaw === 'string' && reviewedHhmmRaw.trim()
      ? reviewedHhmmRaw.trim()
      : null

  return {
    index: params.index,
    segmentId,
    normalizedSegmentId: segmentId ? normalizeOverrideSegmentId(segmentId) : null,
    hasValidStatus: Boolean(status) && isOverrideStatus(status),
    schemaRaw,
    schemaVersion,
    hasKnownSchemaVersion:
      schemaVersion !== null && OVERRIDE_SCHEMA_VERSIONS.has(schemaVersion),
    reviewedSegmentId,
    normalizedReviewedSegmentId: reviewedSegmentId
      ? normalizeOverrideSegmentId(reviewedSegmentId)
      : null,
    reviewedHhmm,
    hasValidReviewedHhmm: reviewedHhmm !== null && isValidHHMM(reviewedHhmm),
  }
}
