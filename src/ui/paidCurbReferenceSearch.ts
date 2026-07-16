import type {
  PaidCurbReferenceDistrict,
  PaidCurbReferenceRecord,
} from '../data/paidCurbReference'

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')

export const suggestPaidCurbRoadQuery = (addressLabel: string | null) => {
  if (!addressLabel) {
    return ''
  }
  const normalized = addressLabel
    .normalize('NFKC')
    .trim()
    .replace(/^\d{3,5}\s*/u, '')
  const localAddress = normalized
    .replace(/^[^市縣]{1,8}[市縣]/u, '')
    .replace(/^[^區鄉鎮市]{1,8}[區鄉鎮市]/u, '')
  const roadMatch = localAddress.match(
    /^(.{1,12}?(?:大道|路|街)(?:[一二三四五六七八九十0-9]+段)?)/u,
  )
  return roadMatch?.[1]?.trim() ?? ''
}

const compareReferenceRecords = (
  left: PaidCurbReferenceRecord,
  right: PaidCurbReferenceRecord,
) =>
  left.parkingSegmentId < right.parkingSegmentId
    ? -1
    : left.parkingSegmentId > right.parkingSegmentId
      ? 1
      : 0

export const findPaidCurbReferenceMatches = (
  district: PaidCurbReferenceDistrict,
  query: string,
  limit = 6,
) => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery || limit <= 0) {
    return { total: 0, records: [] }
  }
  const matching = district.records
    .filter((record) =>
      normalizeSearchText(record.description).includes(normalizedQuery),
    )
    .sort(compareReferenceRecords)
  return {
    total: matching.length,
    records: matching.slice(0, limit),
  }
}
