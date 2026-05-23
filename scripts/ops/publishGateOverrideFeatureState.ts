import {
  OVERRIDE_SCHEMA_VERSIONS,
  isOverrideStatus,
  parseSchemaVersion,
} from './publishGatePolicy'
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
  hasKnownSchemaVersion: boolean
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

  return {
    index: params.index,
    segmentId,
    normalizedSegmentId: segmentId ? normalizeOverrideSegmentId(segmentId) : null,
    hasValidStatus: Boolean(status) && isOverrideStatus(status),
    schemaRaw,
    hasKnownSchemaVersion:
      schemaVersion !== null && OVERRIDE_SCHEMA_VERSIONS.has(schemaVersion),
  }
}
