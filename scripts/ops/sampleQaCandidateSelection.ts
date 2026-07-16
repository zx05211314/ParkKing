import type { EvaluatedSegment } from '../../src/ui/types'
import { isInferredSegment } from '../../src/domain/ranking/policy'
import { shuffleDeterministic } from './sampleQaCandidateOrdering'
import { toQaCandidateRow } from './sampleQaCandidateOutput'
import type { QaCandidateRow, QaCandidateStrategy } from './sampleQaCandidateTypes'

type QaReviewBucket = {
  id: string
  matches: (segment: EvaluatedSegment) => boolean
}

const hasReasonPrefix = (segment: EvaluatedSegment, prefix: string) =>
  segment.reasonCodes.some((code) => code.startsWith(prefix))

const REVIEW_BUCKETS: QaReviewBucket[] = [
  {
    id: 'marked_space_park',
    matches: (segment) =>
      segment.allowedNow === 'PARK' &&
      segment.sourceType !== 'INFERRED' &&
      (segment.parkingSpaceCount ?? 0) > 0,
  },
  {
    id: 'no_stop',
    matches: (segment) => segment.allowedNow === 'NO_STOP',
  },
  {
    id: 'inferred',
    matches: (segment) => isInferredSegment(segment),
  },
  {
    id: 'zone_restricted',
    matches: (segment) => hasReasonPrefix(segment, 'ZONE_'),
  },
  {
    id: 'stale_data',
    matches: (segment) => segment.reasonCodes.includes('DATA_FRESHNESS_STALE'),
  },
  {
    id: 'park',
    matches: (segment) => segment.allowedNow === 'PARK',
  },
  {
    id: 'temp_stop',
    matches: (segment) => segment.allowedNow === 'TEMP_STOP',
  },
  {
    id: 'override_applied',
    matches: (segment) => segment.reasonCodes.includes('OVERRIDE_APPLIED'),
  },
]

export const getQaReviewBucket = (segment: EvaluatedSegment) =>
  REVIEW_BUCKETS.find((bucket) => bucket.matches(segment))?.id ?? 'ranked_fill'

const normalizeSegmentFamilyId = (value: string) =>
  value.replace(/-part-\d+$/i, '')

const selectReviewCandidates = (
  segments: EvaluatedSegment[],
  topN: number,
): Array<{ segment: EvaluatedSegment; reviewBucket: string }> => {
  const bucketGroups = REVIEW_BUCKETS.map((bucket) => ({
    ...bucket,
    segments: segments.filter((segment) => getQaReviewBucket(segment) === bucket.id),
    cursor: 0,
  }))
  const seen = new Set<string>()
  const selected: Array<{ segment: EvaluatedSegment; reviewBucket: string }> = []

  while (selected.length < topN) {
    let addedThisRound = false

    for (const bucket of bucketGroups) {
      while (
        bucket.cursor < bucket.segments.length &&
        seen.has(bucket.segments[bucket.cursor]?.id ?? '')
      ) {
        bucket.cursor += 1
      }

      const segment = bucket.segments[bucket.cursor]
      if (!segment) {
        continue
      }

      selected.push({ segment, reviewBucket: bucket.id })
      seen.add(segment.id)
      bucket.cursor += 1
      addedThisRound = true

      if (selected.length >= topN) {
        break
      }
    }

    if (!addedThisRound) {
      break
    }
  }

  for (const segment of segments) {
    if (selected.length >= topN) {
      break
    }
    if (seen.has(segment.id)) {
      continue
    }
    selected.push({ segment, reviewBucket: 'ranked_fill' })
    seen.add(segment.id)
  }

  return selected
}

export const selectQaCandidateRows = (params: {
  districtId: string
  segments: EvaluatedSegment[]
  topN: number
  shuffle?: boolean
  seed?: number
  strategy?: QaCandidateStrategy
  requiredSegmentIds?: string[]
}): QaCandidateRow[] => {
  const ordered = params.shuffle
    ? shuffleDeterministic([...params.segments], params.seed ?? 1)
    : params.segments
  const requiredIds = [...new Set(
    (params.requiredSegmentIds ?? []).map((value) => value.trim()).filter(Boolean),
  )]
  const segmentsById = new Map(params.segments.map((segment) => [segment.id, segment]))
  const requiredFamilies = requiredIds.map((id) => {
    const exact = segmentsById.get(id)
    if (exact) {
      return [exact]
    }
    return params.segments
      .filter((segment) => normalizeSegmentFamilyId(segment.id) === id)
      .sort((left, right) => left.id.localeCompare(right.id))
  })
  const missingIds = requiredIds.filter((_id, index) => requiredFamilies[index]?.length === 0)
  if (missingIds.length > 0) {
    throw new Error(`Required segments not found: ${missingIds.join(', ')}`)
  }

  const seenRequiredIds = new Set<string>()
  const requiredSegments = requiredFamilies.flat().filter((segment) => {
    if (seenRequiredIds.has(segment.id)) {
      return false
    }
    seenRequiredIds.add(segment.id)
    return true
  })
  if (requiredSegments.length > params.topN) {
    throw new Error(
      `Required segment expansion ${requiredSegments.length} exceeds topN ${params.topN}`,
    )
  }
  const requiredIdSet = new Set(requiredSegments.map((segment) => segment.id))
  const remaining = ordered.filter((segment) => !requiredIdSet.has(segment.id))
  const remainingCount = params.topN - requiredSegments.length

  const requiredRows = requiredSegments.map((segment) =>
    toQaCandidateRow(
      params.districtId,
      segment,
      params.strategy === 'review' ? getQaReviewBucket(segment) : 'ranked',
    ),
  )

  if (params.strategy === 'review') {
    return requiredRows.concat(selectReviewCandidates(remaining, remainingCount).map(
      ({ segment, reviewBucket }) =>
        toQaCandidateRow(params.districtId, segment, reviewBucket),
    ))
  }

  return requiredRows.concat(
    remaining
      .slice(0, remainingCount)
      .map((segment) => toQaCandidateRow(params.districtId, segment, 'ranked')),
  )
}
