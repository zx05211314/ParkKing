import {
  buildQaReviewPlanAssignments,
  buildQaReviewPlanLines,
} from './qaReviewPlan'
import type { P0ReadinessResult } from './p0ReadinessTypes'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

const formatCheckStatus = (pass: boolean, error: string | null) => {
  if (error) {
    return `FAIL (${error.split('\n')[0]})`
  }
  return pass ? 'PASS' : 'FAIL'
}

const formatExactSmoke = (result: P0ReadinessResult) => {
  const { exactSmoke } = result
  if (!exactSmoke.summary) {
    return [`- Status: ${formatCheckStatus(exactSmoke.pass, exactSmoke.error)}`]
  }
  const { summary } = exactSmoke
  return [
    `- Status: ${formatCheckStatus(exactSmoke.pass, exactSmoke.error)}`,
    `- Dataset hash: ${summary.datasetHash}`,
    `- Evaluated segments: ${summary.evaluatedCount}`,
    `- Counts: PARK ${summary.counts.parkAnswers}, NO_STOP ${summary.counts.noStopAnswers}, MARKED_SPACE_PARK ${summary.counts.markedSpaceParkAnswers}`,
    `- Answer cases: ${
      summary.caseResults && summary.caseResults.length > 0
        ? `${summary.caseResults.filter((result) => result.pass).length}/${summary.caseResults.length} passed`
        : 'none'
    }`,
  ]
}

const formatQaReview = (result: P0ReadinessResult) => {
  const { qaReview } = result
  if (!qaReview.summary) {
    return [`- Status: ${formatCheckStatus(qaReview.pass, qaReview.error)}`]
  }
  const { summary } = qaReview
  return [
    `- Status: ${formatCheckStatus(qaReview.pass, qaReview.error)}`,
    `- Rows: total ${summary.totalRows}, valid reviewed ${summary.validReviewedRows}, pending ${summary.pendingRows}`,
    `- Review sources: ${
      Object.entries(summary.reviewSourceCounts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([source, count]) => `${source} ${count}`)
        .join(', ') || 'none'
    }`,
    `- Missing statuses: ${summary.reviewRequirements.missingStatuses.join(', ') || 'none'}`,
    `- Missing buckets: ${summary.reviewRequirements.missingBuckets.join(', ') || 'none'}`,
    `- Bucket minimums remaining: ${
      Object.entries(summary.reviewRequirements.bucketMinimumsRemaining)
        .map(([bucket, count]) => `${bucket} ${count}`)
        .join(', ') || 'none'
    }`,
  ]
}

const formatWarnings = (warnings: string[]) => {
  return warnings.length === 0 ? ['- Warnings: none'] : warnings.map((warning) => `- ${warning}`)
}

const formatPublishGate = (result: P0ReadinessResult) => {
  const { publishGate, inputs } = result
  if (!publishGate.summary) {
    return [`- Status: ${formatCheckStatus(publishGate.pass, publishGate.error)}`]
  }
  const district = publishGate.summary.districts.find(
    (item) => item.districtId === inputs.districtId,
  )
  return [
    `- Status: ${formatCheckStatus(publishGate.pass, publishGate.error)}`,
    `- Exit code: ${publishGate.summary.exitCode}`,
    `- Allow FAIL: ${publishGate.summary.allowFail ? 'yes' : 'no'}`,
    `- Override reason: ${publishGate.summary.overrideReason ?? 'none'}`,
    `- Totals: info ${publishGate.summary.totals.info}, warn ${publishGate.summary.totals.warn}, fail ${publishGate.summary.totals.fail}`,
    `- ${inputs.districtId} fails: ${district?.fail ?? 'unknown'}`,
    `- ${inputs.districtId} top fail codes: ${district?.topFailCodes.join(', ') || 'none'}`,
    `- Sign overrides: total ${district?.signOverrideBreakdown?.total ?? 'unknown'}, matchedBySegmentId ${district?.signOverrideBreakdown?.matchedBySegmentId ?? 'unknown'}`,
  ]
}

const formatBlockers = (result: P0ReadinessResult) => {
  const blockers: string[] = []
  if (!result.exactSmoke.pass) {
    blockers.push(
      result.exactSmoke.error
        ? `Exact answer smoke failed: ${result.exactSmoke.error.split('\n')[0]}`
        : 'Exact answer smoke did not satisfy required PARK / NO_STOP / marked-space-backed PARK samples.',
    )
  }
  if (!result.qaReview.pass) {
    const errors = result.qaReview.summary?.errors ?? []
    blockers.push(
      errors.length > 0
        ? `QA review gate inputs are not ready: ${errors[0]}`
        : 'QA review gate inputs are not ready.',
    )
  }
  if (!result.publishGate.pass) {
    const summary = result.publishGate.summary
    blockers.push(
      summary
        ? `Publish gate is blocking with exit code ${summary.exitCode} and ${summary.totals.fail} failure(s).`
        : `Publish gate could not be evaluated: ${result.publishGate.error ?? 'unknown error'}`,
    )
  }
  return blockers
}

const formatNextReviewRows = (result: P0ReadinessResult) => {
  const summary = result.qaReview.summary
  if (!summary || summary.nextReviewRows.length === 0) {
    return ['- none']
  }
  const assignments = buildQaReviewPlanAssignments(summary)
  return summary.nextReviewRows.map((row) => {
    const assignment = assignments.get(row.rowNumber)
    const rank = assignment ? `rank ${assignment.rank}` : 'unranked'
    const reason = assignment ? `, reason ${assignment.reasons.join('|')}` : ''
    const location = row.lat && row.lon ? `${row.lat},${row.lon}` : 'unknown location'
    const context = [
      row.curbMarking ? `curb ${row.curbMarking}` : null,
      row.sourceType ? `source ${row.sourceType}` : null,
      row.finalConfidence ? `confidence ${row.finalConfidence}` : null,
      row.topReasons ? `topReasons ${row.topReasons}` : null,
      row.flags ? `flags ${row.flags}` : null,
      row.riskTags ? `riskTags ${row.riskTags}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    return `- ${rank}${reason}: source row ${row.rowNumber}, ${row.reviewBucket}, ${row.segmentId}, ${location}${context ? ` (${context})` : ''}`
  })
}

const resolveReadinessReviewPathForCommand = (result: P0ReadinessResult) =>
  result.inputs.reviewPath.endsWith('.merged.csv')
    ? result.inputs.reviewPath
    : `.tmp\\${result.inputs.districtId}-review.merged.csv`

const formatCommands = (result: P0ReadinessResult) => [
  '```powershell',
  '# Primary P0 flow',
  `npm run ops:p0-prepare-review -- --district ${result.inputs.districtId}`,
  `npm run ops:qa-review-checklist -- --input .tmp\\${result.inputs.districtId}-next-review.csv --source "${result.inputs.reviewPath}" --out .tmp\\${result.inputs.districtId}-next-review.md --merged-out .tmp\\${result.inputs.districtId}-review.merged.csv --config "${result.inputs.configPath}" --title "${result.inputs.districtId} gate-critical rows"`,
  `npm run ops:qa-review-geojson -- --input .tmp\\${result.inputs.districtId}-next-review.csv --out .tmp\\${result.inputs.districtId}-next-review.geojson`,
  '# Fill reviewStatus, reviewNote, and createdAt from observed evidence before this step.',
  `npm run ops:p0-finalize-review -- --district ${result.inputs.districtId}`,
  '',
  '# Manual/debug equivalents',
  `npm run ops:p0-promote-review -- --district ${result.inputs.districtId}`,
  '# Continue only after p0-promote-review passes.',
  `npm run ingest:all -- --configs "${result.inputs.configPath}"`,
  `npm run ops:refresh-publish-report -- --config "${result.inputs.configPath}"`,
  `npm run ops:p0-readiness -- --review "${resolveReadinessReviewPathForCommand(result)}" --config "${result.inputs.configPath}"${
    result.inputs.publishOverrideReason &&
    (result.inputs.allowPublishWarn || result.inputs.allowPublishFail)
      ? `${result.inputs.allowPublishWarn ? ' --allow-publish-warn' : ''}${result.inputs.allowPublishFail ? ' --allow-publish-fail' : ''} --publish-override "${result.inputs.publishOverrideReason}"`
      : ''
  }`,
  '# Production release smoke after readiness passes; requires Chrome and Node 22+.',
  'npm run build',
  `npm run ops:smoke-ui-parking-answers:preview -- --cases "${result.inputs.answerCasesPath ?? `configs/prod/${result.inputs.districtId}.answer-cases.json`}" --district ${result.inputs.districtId} --timeout-ms 25000`,
  `npm run ops:smoke-ui-parking-answers-map:preview -- --cases "${result.inputs.answerCasesPath ?? `configs/prod/${result.inputs.districtId}.answer-cases.json`}" --district ${result.inputs.districtId} --limit 1 --timeout-ms 25000`,
  'npm run ops:p1-release-readiness',
  `npm run ops:qa-review-gate -- --input "${result.inputs.reviewPath}" --config "${result.inputs.configPath}" --min-reviewed 1 --require-status LEGAL --require-status ILLEGAL --require-bucket marked_space_park --min-reviewed-bucket marked_space_park=2 --min-reviewed-bucket no_stop=2 --next-review-limit ${result.inputs.nextReviewRowsLimit} --next-review-out .tmp\\${result.inputs.districtId}-next-review.csv`,
  `npm run ops:apply-qa-review -- --source "${result.inputs.reviewPath}" --reviews .tmp\\${result.inputs.districtId}-next-review.csv --out .tmp\\${result.inputs.districtId}-review.merged.csv`,
  `npm run ops:qa-review-gate -- --input .tmp\\${result.inputs.districtId}-review.merged.csv --config "${result.inputs.configPath}" --min-reviewed 1 --require-status LEGAL --require-status ILLEGAL --require-bucket marked_space_park --min-reviewed-bucket marked_space_park=2 --min-reviewed-bucket no_stop=2`,
  '```',
]

export const formatP0Readiness = (result: P0ReadinessResult) =>
  [
    `# P0 Readiness: ${result.pass ? 'PASS' : 'BLOCKED'}`,
    '',
    '## Inputs',
    '',
    `- District: ${result.inputs.districtId}`,
    `- Dataset dir: ${result.inputs.datasetDir}`,
    `- Review CSV: ${result.inputs.reviewPath}`,
    `- Review manifest: ${result.inputs.manifestPath ?? 'adjacent/default'}`,
    `- Config: ${result.inputs.configPath}`,
    `- Publish report: ${result.inputs.publishReportPath}`,
    `- Answer cases: ${result.inputs.answerCasesPath ?? 'none'}`,
    `- Allow publish WARN override: ${result.inputs.allowPublishWarn ? 'yes' : 'no'}`,
    `- Allow publish FAIL override: ${result.inputs.allowPublishFail ? 'yes' : 'no'}`,
    `- Publish override reason: ${result.inputs.publishOverrideReason ?? 'none'}`,
    `- Time/radius: ${result.inputs.hhmm}, ${result.inputs.searchRadiusMeters}m`,
    '',
    '## Exact Answer Smoke',
    '',
    ...formatExactSmoke(result),
    '',
    '## QA Review Gate Inputs',
    '',
    ...formatQaReview(result),
    '',
    ...(result.qaReview.summary
      ? ['Review plan:', ...buildQaReviewPlanLines(result.qaReview.summary)]
      : []),
    '',
    '## Review Pack Provenance',
    '',
    ...formatWarnings(result.reviewPackProvenanceWarnings ?? []),
    '',
    '## Current Config Drift',
    '',
    ...formatWarnings(result.reviewConfigDriftWarnings ?? []),
    '',
    '## Publish Gate',
    '',
    ...formatPublishGate(result),
    '',
    '## Blockers',
    '',
    formatList(formatBlockers(result)),
    '',
    '## Next Review Rows',
    '',
    ...formatNextReviewRows(result),
    '',
    '## Next Commands',
    '',
    ...formatCommands(result),
  ].join('\n')
