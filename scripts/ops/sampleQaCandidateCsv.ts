import type { QaCandidateRow } from './sampleQaCandidateTypes'

const escapeCsvCell = (value: string) => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const renderQaCandidatesCsv = (rows: QaCandidateRow[]) => {
  const header = [
    'districtId',
    'segmentId',
    'lat',
    'lon',
    'score',
    'reviewBucket',
    'tier',
    'allowedNow',
    'curbMarking',
    'sourceType',
    'sourceReliability',
    'dataFreshnessDays',
    'finalConfidence',
    'coverageConfidence',
    'overrideConfidence',
    'parkingSpaceCount',
    'topReasons[]',
    'flags',
    'riskTags',
    'signOverrideStatus',
    'signOverrideSource',
    'signOverrideVerifiedAt',
    'signOverrideNote',
    'mapsUrl',
    'streetViewUrl',
    'reviewSource',
    'reviewStatus',
    'reviewNote',
    'createdAt',
  ]
  const lines = rows.map((row) =>
    [
      row.districtId,
      row.segmentId,
      row.lat,
      row.lon,
      row.score,
      row.reviewBucket,
      row.tier,
      row.allowedNow,
      row.curbMarking,
      row.sourceType,
      row.sourceReliability,
      row.dataFreshnessDays,
      row.finalConfidence,
      row.coverageConfidence,
      row.overrideConfidence,
      row.parkingSpaceCount,
      JSON.stringify(row.topReasons),
      JSON.stringify(row.flags),
      JSON.stringify(row.riskTags),
      row.signOverrideStatus,
      row.signOverrideSource,
      row.signOverrideVerifiedAt,
      row.signOverrideNote,
      row.mapsUrl,
      row.streetViewUrl,
      row.reviewSource,
      row.reviewStatus,
      row.reviewNote,
      row.createdAt,
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(','),
  )
  return `${header.join(',')}\n${lines.join('\n')}\n`
}
