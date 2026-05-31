import type { EvaluatedSegment } from './types'

type SegmentSearchItem = Pick<
  EvaluatedSegment,
  'id' | 'name' | 'allowedNow' | 'tier' | 'sourceType'
>

const normalizeSearchText = (value: string) => {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const buildSearchHaystack = (segment: SegmentSearchItem) => {
  return normalizeSearchText(
    [
      segment.name,
      segment.id,
      segment.allowedNow,
      segment.tier,
      segment.sourceType === 'INFERRED' ? 'inferred' : 'official',
    ].join(' '),
  )
}

const getSearchMatchRank = (segment: SegmentSearchItem, normalizedQuery: string) => {
  const normalizedName = normalizeSearchText(segment.name)
  if (normalizedName === normalizedQuery) {
    return 0
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return 1
  }
  if (normalizedName.includes(` ${normalizedQuery}`)) {
    return 2
  }
  return 3
}

export const filterSegmentsByQuery = <T extends SegmentSearchItem>(
  segments: T[],
  query: string,
) => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return segments
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean)
  if (tokens.length === 0) {
    return segments
  }

  return segments.filter((segment) => {
    const haystack = buildSearchHaystack(segment)
    return tokens.every((token) => haystack.includes(token))
  })
}

export const getSegmentSearchSuggestions = <T extends SegmentSearchItem>(
  segments: T[],
  query: string,
  limit = 6,
) => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return [] as T[]
  }

  return filterSegmentsByQuery(segments, query)
    .map((segment, index) => ({
      segment,
      index,
      rank: getSearchMatchRank(segment, normalizedQuery),
    }))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank
      }
      return left.index - right.index
    })
    .slice(0, limit)
    .map(({ segment }) => segment)
}
