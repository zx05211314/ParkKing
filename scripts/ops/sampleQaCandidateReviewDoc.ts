import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { QaCandidateManifest } from './sampleQaCandidateManifest'
import { resolveQaReviewDocOutPath } from './sampleQaCandidatePaths'
import type { QaCandidateRow } from './sampleQaCandidateTypes'

const formatCountMap = (counts: Record<string, number>) => {
  const entries = Object.entries(counts).sort((a, b) => {
    const byCount = b[1] - a[1]
    return byCount !== 0 ? byCount : a[0].localeCompare(b[0])
  })
  if (entries.length === 0) {
    return '- none'
  }
  return entries.map(([key, count]) => `- ${key}: ${count}`).join('\n')
}

const formatValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return 'unknown'
  }
  return String(value)
}

const formatDisplayPath = (value: string) => {
  const relative = path.relative(process.cwd(), value)
  const display =
    relative && !relative.startsWith('..') && !path.isAbsolute(relative)
      ? relative
      : value
  return display.replaceAll(path.sep, '/')
}

const formatReasons = (row: QaCandidateRow) =>
  row.topReasons.length > 0 ? row.topReasons.join(', ') : 'none'

const formatFlags = (row: QaCandidateRow) =>
  row.flags.length > 0 ? row.flags.join(', ') : 'none'

const formatRiskTags = (row: QaCandidateRow) => {
  const riskTags = row.riskTags ?? []
  return riskTags.length > 0 ? riskTags.join(', ') : 'none'
}

const formatStoredReview = (row: QaCandidateRow) =>
  row.reviewStatus
    ? `${row.reviewStatus}; source ${formatValue(row.reviewSource || 'manual')}; note ${formatValue(row.reviewNote)}; createdAt ${formatValue(row.createdAt)}`
    : 'pending'

interface QaCandidateReviewDocRow {
  row: QaCandidateRow
  csvRowNumber: number
}

const groupRowsByBucket = (rows: QaCandidateRow[]) => {
  const grouped = new Map<string, QaCandidateReviewDocRow[]>()
  rows.forEach((row, index) => {
    const bucket = row.reviewBucket || 'unbucketed'
    grouped.set(bucket, [
      ...(grouped.get(bucket) ?? []),
      { row, csvRowNumber: index + 2 },
    ])
  })
  return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))
}

const renderRow = (
  { row, csvRowNumber }: QaCandidateReviewDocRow,
  index: number,
) =>
  [
    `${index + 1}. Segment \`${row.segmentId}\``,
    `   - CSV row: ${csvRowNumber}`,
    `   - Location: ${row.lat}, ${row.lon}`,
    `   - Current answer: ${row.allowedNow} / ${row.tier}; score ${row.score}; marked spaces ${row.parkingSpaceCount}`,
    `   - Source: curb ${formatValue(row.curbMarking)}, type ${formatValue(row.sourceType)}, reliability ${formatValue(row.sourceReliability)}, freshness days ${formatValue(row.dataFreshnessDays)}`,
    `   - Confidence: final ${formatValue(row.finalConfidence)}, coverage ${formatValue(row.coverageConfidence)}, override ${formatValue(row.overrideConfidence)}`,
    `   - Existing override: status ${formatValue(row.signOverrideStatus)}, source ${formatValue(row.signOverrideSource)}, verified ${formatValue(row.signOverrideVerifiedAt)}`,
    `   - Stored review: ${formatStoredReview(row)}`,
    `   - Evidence reasons: ${formatReasons(row)}`,
    `   - Flags: ${formatFlags(row)}`,
    `   - Risk tags: ${formatRiskTags(row)}`,
    `   - Review links: [Map](${row.mapsUrl}) | [Street View](${row.streetViewUrl})`,
    '   - Verdict: LEGAL / ILLEGAL / UNCLEAR',
    '   - Notes:',
  ].join('\n')

export const renderQaCandidateReviewDoc = (
  manifest: QaCandidateManifest,
  rows: QaCandidateRow[],
) => {
  const bucketSections = groupRowsByBucket(rows).map(
    ([bucket, bucketRows]) =>
      [
        `## Bucket: ${bucket}`,
        '',
        ...bucketRows.map((row, index) => renderRow(row, index)),
      ].join('\n\n'),
  )

  return [
    `# QA Review Packet: ${manifest.districtId}`,
    '',
    'This packet is for human field or imagery review only. Do not fill verdicts from model inference alone.',
    '',
    '## Source',
    '',
    `- CSV: ${formatDisplayPath(manifest.csvPath)}`,
    `- Dataset directory: ${formatDisplayPath(manifest.dataset.baseDir)}`,
    `- Dataset hash: ${formatValue(manifest.dataset.datasetHash)}`,
    `- Config hash: ${formatValue(manifest.dataset.configHash)}`,
    `- Generated at: ${formatValue(manifest.dataset.generatedAt)}`,
    `- Published at: ${formatValue(manifest.dataset.publishedAt)}`,
    `- Existing sign overrides: ${manifest.dataset.inputCounts.signOverrides}`,
    `- Existing overrides applied: ${manifest.dataset.packCounts?.overridesApplied ?? 0}`,
    '',
    '## Sampling',
    '',
    `- Rows: ${manifest.rows.total}`,
    `- Strategy: ${manifest.params.strategy}`,
    `- Evaluation time: ${manifest.params.hhmm}`,
    `- Radius meters: ${manifest.params.radiusMeters}`,
    `- Risk mode: ${manifest.params.riskMode}`,
    '',
    '## Bucket Counts',
    '',
    formatCountMap(manifest.rows.bucketCounts),
    '',
    '## Review Rules',
    '',
    '- Use `LEGAL` only when visible signs, curb markings, or official marked spaces support parking at the sampled time.',
    '- Use `ILLEGAL` when visible signs, red curb, hydrant, bus stop, intersection, crosswalk, or other restriction clearly forbids stopping or parking.',
    '- Use `UNCLEAR` when imagery is stale, blocked, inconsistent, or insufficient.',
    '- Write verdicts back to the CSV `reviewStatus` column, and keep specific evidence in `reviewNote`.',
    '',
    '## Gate Command',
    '',
    '```bash',
    manifest.review.gateCommand,
    '```',
    '',
    ...bucketSections,
    '',
  ].join('\n')
}

export const writeQaCandidateReviewDoc = async (params: {
  districtId: string
  all: boolean
  csvOutPath: string
  reviewDocOutPath: string | null
  manifest: QaCandidateManifest
  rows: QaCandidateRow[]
}) => {
  const outPath = resolveQaReviewDocOutPath({
    districtId: params.districtId,
    all: params.all,
    csvOutPath: params.csvOutPath,
    reviewDocOutPath: params.reviewDocOutPath,
  })
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(
    outPath,
    renderQaCandidateReviewDoc(params.manifest, params.rows),
    'utf-8',
  )
  return outPath
}
