import * as path from 'node:path'
import { buildQaReviewPlanLines } from './qaReviewPlan'
import type { QaReviewGateResult } from './qaReviewGateTypes'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

const formatExports = (exports: QaReviewGateResult['exports']) => {
  if (exports.length === 0) {
    return '- none'
  }
  return exports
    .map((entry) => `- ${entry.districtId}: ${entry.count} -> ${entry.outputPath}`)
    .join('\n')
}

const formatManifestLines = (result: QaReviewGateResult) => {
  const manifest = result.summary.manifest
  if (!manifest) {
    return []
  }
  return [
    `- Review manifest: ${manifest.path}`,
    `- Dataset hash: ${manifest.datasetHash ?? 'unknown'}`,
    `- Config hash: ${manifest.configHash ?? 'unknown'}`,
  ]
}

const formatRequirements = (result: QaReviewGateResult) => {
  const { reviewRequirements } = result.summary
  const bucketMinimums = Object.entries(reviewRequirements.bucketMinimumsRemaining)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, remaining]) => `${bucket} ${remaining}`)
  return [
    `- Estimated minimum new reviews: ${reviewRequirements.estimatedMinimumNewReviews}`,
    `- Remaining valid reviews: ${reviewRequirements.minReviewedRemaining}`,
    `- Missing statuses: ${reviewRequirements.missingStatuses.join(', ') || 'none'}`,
    `- Missing buckets: ${reviewRequirements.missingBuckets.join(', ') || 'none'}`,
    `- Bucket minimums remaining: ${bucketMinimums.join(', ') || 'none'}`,
  ].join('\n')
}

const formatNextReviewRows = (result: QaReviewGateResult) => {
  const rows = result.summary.nextReviewRows
  if (rows.length === 0) {
    return '- none'
  }
  return rows
    .map((row) => {
      const location = row.lat && row.lon ? `${row.lat},${row.lon}` : 'unknown location'
      const context = [
        row.tier ? `tier ${row.tier}` : null,
        row.allowedNow ? `action ${row.allowedNow}` : null,
        row.score ? `score ${row.score}` : null,
        row.curbMarking ? `curb ${row.curbMarking}` : null,
        row.sourceType ? `source ${row.sourceType}` : null,
        row.finalConfidence ? `confidence ${row.finalConfidence}` : null,
        row.parkingSpaceCount ? `spaces ${row.parkingSpaceCount}` : null,
        row.topReasons ? `reasons ${row.topReasons}` : null,
        row.flags ? `flags ${row.flags}` : null,
        row.riskTags ? `risk ${row.riskTags}` : null,
      ]
        .filter(Boolean)
        .join(', ')
      return `- row ${row.rowNumber}: ${row.reviewBucket} ${row.segmentId || 'unknown segment'} at ${location}${context ? ` (${context})` : ''}${row.streetViewUrl ? ` | ${row.streetViewUrl}` : ''}`
    })
    .join('\n')
}

const quoteArg = (value: string) => `"${value}"`

const formatNextStep = (result: QaReviewGateResult) => {
  if (!result.pass) {
    return '- Gate failed; fix errors before ingesting overrides.'
  }

  const defaultOutDir = path.resolve('data', 'overrides')
  const outDirIsDefault = path.resolve(result.outDir) === defaultOutDir
  const inputPath = result.preflight?.inputPath ?? result.exports[0]?.outputPath ?? null
  const lines = outDirIsDefault
    ? [`- Ingest-ready override path: ${inputPath ?? result.outDir}`]
    : [
        `- Not ingest-ready by default: ingestSignOverrides reads ${defaultOutDir}, but this gate wrote ${result.outDir}.`,
        `- Rerun without --outDir or copy the exported JSONL into ${defaultOutDir} before ingest.`,
      ]

  lines.push(
    `- Rebuild district pack: npm run ingest:all -- --configs ${quoteArg(result.configPath)}`,
  )
  lines.push(
    `- Verify default override input: npm run ops:preflight-sign-overrides -- --config ${quoteArg(result.configPath)}`,
  )
  return lines.join('\n')
}

export const formatQaReviewGate = (result: QaReviewGateResult) => {
  const preflight = result.preflight
  return [
    `# QA Review Gate: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Input: ${result.inputPath}`,
    `- Input kind: ${result.inputKind}`,
    `- Config: ${result.configPath}`,
    `- Out dir: ${result.outDir}`,
    `- Review rows: ${result.summary.validReviewedRows} valid / ${result.summary.reviewedRows} reviewed / ${result.summary.totalRows} total`,
    `- Review segment integrity: ${result.summary.duplicateReviewedSegments} duplicate / ${result.summary.conflictingReviewedSegments} conflicting`,
    ...formatManifestLines(result),
    ...(preflight
      ? [
          `- Effective overrides: ${preflight.effectiveOverrides}`,
          `- Matched segment overrides: ${preflight.matchedSegmentOverrides}`,
          `- Missing segment overrides: ${preflight.missingSegmentOverrides}`,
        ]
      : ['- Effective overrides: not run']),
    '',
    '## Exported Override Files',
    '',
    formatExports(result.exports),
    '',
    '## Review Requirements',
    '',
    formatRequirements(result),
    '',
    '## Review Plan',
    '',
    buildQaReviewPlanLines(result.summary).join('\n'),
    '',
    '## Next Review Rows',
    '',
    formatNextReviewRows(result),
    '',
    '## Next Step',
    '',
    formatNextStep(result),
    '',
    '## Errors',
    '',
    formatList(result.errors),
    '',
    '## Warnings',
    '',
    formatList(result.warnings),
  ].join('\n')
}
