import type { AllowedAction } from './types'

export type SegmentActionFilter = 'ALL' | 'PARK_ONLY' | 'STOP_OK'

export const DEFAULT_SEGMENT_ACTION_FILTER: SegmentActionFilter = 'ALL'

export const SEGMENT_ACTION_FILTER_LABELS: Record<SegmentActionFilter, string> = {
  ALL: 'All',
  PARK_ONLY: 'Park ok',
  STOP_OK: 'Stop ok',
}

export const isSegmentActionFilter = (
  value: unknown,
): value is SegmentActionFilter => {
  return value === 'ALL' || value === 'PARK_ONLY' || value === 'STOP_OK'
}

export const getAllowedActionPriority = (value?: AllowedAction | null) => {
  if (value === 'PARK') {
    return 0
  }
  if (value === 'TEMP_STOP') {
    return 1
  }
  if (value === 'NO_STOP') {
    return 2
  }
  return 3
}

export const compareAllowedActionPriority = (
  left?: AllowedAction | null,
  right?: AllowedAction | null,
) => {
  return getAllowedActionPriority(left) - getAllowedActionPriority(right)
}

export const segmentMatchesActionFilter = (
  allowedNow: AllowedAction,
  filter: SegmentActionFilter,
) => {
  if (filter === 'ALL') {
    return true
  }
  if (filter === 'PARK_ONLY') {
    return allowedNow === 'PARK'
  }
  return allowedNow === 'PARK' || allowedNow === 'TEMP_STOP'
}

export const filterSegmentsByAction = <T extends { allowedNow: AllowedAction }>(
  segments: T[],
  filter: SegmentActionFilter,
) => {
  if (filter === 'ALL') {
    return segments
  }
  return segments.filter((segment) =>
    segmentMatchesActionFilter(segment.allowedNow, filter),
  )
}
