import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import {
  type HumanReviewBundleEntry,
  runHumanReviewBundleIndex,
} from './humanReviewBundleIndex'
import { VALID_QA_REVIEW_STATUSES } from './qaReviewSummaryTypes'
import { REVIEW_TIMESTAMP_MESSAGE, isValidReviewTimestamp } from './reviewTimestamp'

const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_PUBLISH_GATE_SUMMARY = 'data/generated/_ops/publish_gate_summary.json'

type IssueSeverity = 'pending' | 'error'
type ReviewPriorityState = 'pending' | 'invalid' | 'valid'

const REVIEW_REQUIREMENT_MIN_REVIEWED = 1
const REVIEW_REQUIREMENT_STATUSES = ['LEGAL', 'ILLEGAL']
const REVIEW_REQUIREMENT_BUCKETS = ['marked_space_park']
const REVIEW_REQUIREMENT_BUCKET_MINIMUMS: Record<string, number> = {
  marked_space_park: 2,
  no_stop: 2,
}

export interface ReviewHandoffAuditOptions {
  reviewRoot?: string
  districtIds?: string[]
  all?: boolean
  publishGateSummaryPath?: string | null
  strict?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
  priorityOutPath?: string | null
  priorityCsvOutPath?: string | null
  priorityJsonOutPath?: string | null
  summaryPath?: string
  json?: boolean
  reportOnly?: boolean
}

export interface ReviewHandoffRowIssue {
  rowNumber: number
  sourceRowNumber: string | null
  severity: IssueSeverity
  segmentId: string
  reviewBucket: string
  fields: string[]
  message: string
}

export interface ReviewHandoffPriorityRow {
  rowNumber: number
  sourceRowNumber: string | null
  rank: number
  segmentId: string
  reviewBucket: string
  reviewState: ReviewPriorityState
  reasons: string[]
  mapsUrl: string | null
  streetViewUrl: string | null
}

export interface ReviewHandoffAuditEntry {
  bundleId: string
  districtId: string
  status: string
  handoffCsv: string
  estimatedMinimumNewReviews: number | null
  remainingMinimumNewReviews: number | null
  rows: number
  reviewedRows: number
  validReviewedRows: number
  pendingRows: number
  invalidRows: number
  statusCounts: Record<string, number>
  bucketCounts: Record<string, number>
  reviewedBucketCounts: Record<string, number>
  priorityRows: ReviewHandoffPriorityRow[]
  issues: ReviewHandoffRowIssue[]
}

export interface ReviewHandoffAuditResult {
  pass: boolean
  strict: boolean
  reviewRoot: string
  selectedDistricts: string[]
  entries: ReviewHandoffAuditEntry[]
  errors: string[]
  warnings: string[]
}

export interface ReviewHandoffPriorityExportRow {
  bundleId: string
  districtId: string
  status: string
  minimumNewReviews: number | null
  rank: number
  rowNumber: number
  sourceRowNumber: string | null
  segmentId: string
  reviewBucket: string
  reasons: string[]
  mapsUrl: string | null
  streetViewUrl: string | null
  handoffCsv: string
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const getArgValues = (argv: string[], ...flags: string[]) => {
  const values: string[] = []
  argv.forEach((arg, index) => {
    if (flags.includes(arg) && argv[index + 1]) {
      values.push(argv[index + 1])
    }
  })
  return values.flatMap((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parseReviewHandoffAuditArgs = (
  argv: string[],
): ReviewHandoffAuditOptions => ({
  reviewRoot:
    getArgValue(argv, '--review-root', '--reviewRoot') ?? DEFAULT_REVIEW_ROOT,
  districtIds: getArgValues(argv, '--district', '--district-id', '--districtId'),
  all: hasFlag(argv, '--all'),
  publishGateSummaryPath: hasFlag(argv, '--no-publish-gate-summary')
    ? null
    : (getArgValue(
        argv,
        '--publish-gate-summary',
        '--publishGateSummary',
        '--publish-gate-summary-path',
        '--publishGateSummaryPath',
      ) ?? DEFAULT_PUBLISH_GATE_SUMMARY),
  strict: hasFlag(argv, '--strict'),
  outPath: getArgValue(argv, '--out', '--out-path', '--outPath') ?? undefined,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut', '--json-out-path', '--jsonOutPath') ??
    undefined,
  priorityOutPath:
    getArgValue(argv, '--priority-out', '--priorityOut', '--priority-md-out') ??
    undefined,
  priorityCsvOutPath:
    getArgValue(
      argv,
      '--priority-csv-out',
      '--priorityCsvOut',
      '--priority-csv',
    ) ?? undefined,
  priorityJsonOutPath:
    getArgValue(
      argv,
      '--priority-json-out',
      '--priorityJsonOut',
      '--priority-json',
    ) ?? undefined,
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  json: hasFlag(argv, '--json'),
  reportOnly: hasFlag(argv, '--report-only', '--reportOnly'),
})

const getCsvValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ''
}

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1
}

const normalizeStatus = (value: string) => value.trim().toUpperCase()
const normalizeBucket = (value: string) => value.trim() || 'unbucketed'

const isValidStatus = (status: string) =>
  VALID_QA_REVIEW_STATUSES.includes(status as never)

const calculateRemainingMinimumNewReviews = ({
  validReviewedRows,
  statusCounts,
  reviewedBucketCounts,
}: {
  validReviewedRows: number
  statusCounts: Record<string, number>
  reviewedBucketCounts: Record<string, number>
}) => {
  const missingStatuses = REVIEW_REQUIREMENT_STATUSES.filter(
    (status) => (statusCounts[normalizeStatus(status)] ?? 0) === 0,
  )
  const missingBuckets = REVIEW_REQUIREMENT_BUCKETS.map(normalizeBucket).filter(
    (bucket, index, values) => values.indexOf(bucket) === index,
  ).filter((bucket) => (reviewedBucketCounts[bucket] ?? 0) === 0)
  const bucketMinimumsRemaining: Record<string, number> = {}

  Object.entries(REVIEW_REQUIREMENT_BUCKET_MINIMUMS).forEach(([bucket, minimum]) => {
    const normalized = normalizeBucket(bucket)
    const actual = reviewedBucketCounts[normalized] ?? 0
    if (actual < minimum) {
      bucketMinimumsRemaining[normalized] = minimum - actual
    }
  })

  const missingOnlyBucketMinimum = missingBuckets.filter(
    (bucket) => bucketMinimumsRemaining[bucket] === undefined,
  ).length
  const bucketMinimumReviewsRemaining =
    Object.values(bucketMinimumsRemaining).reduce((sum, value) => sum + value, 0) +
    missingOnlyBucketMinimum
  const minReviewedRemaining = Math.max(
    0,
    REVIEW_REQUIREMENT_MIN_REVIEWED - validReviewedRows,
  )

  return Math.max(
    minReviewedRemaining,
    missingStatuses.length,
    bucketMinimumReviewsRemaining,
  )
}

const buildIssue = (params: {
  rowNumber: number
  sourceRowNumber: string | null
  severity: IssueSeverity
  segmentId: string
  reviewBucket: string
  fields: string[]
}) => ({
  ...params,
  message: `${params.fields.join(', ')} required for row ${params.rowNumber}`,
})

const auditRows = (
  districtId: string,
  handoffCsv: string,
  estimatedMinimumNewReviews: number | null,
  rows: Record<string, unknown>[],
): ReviewHandoffAuditEntry => {
  const issues: ReviewHandoffRowIssue[] = []
  const priorityRows: ReviewHandoffPriorityRow[] = []
  const statusCounts: Record<string, number> = {}
  const validStatusCounts: Record<string, number> = {}
  const bucketCounts: Record<string, number> = {}
  const reviewedBucketCounts: Record<string, number> = {}
  const validReviewedBucketCounts: Record<string, number> = {}
  let reviewedRows = 0
  let validReviewedRows = 0
  let pendingRows = 0
  let invalidRows = 0

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const sourceRowNumber = getCsvValue(row, ['sourceRowNumber']) || null
    const segmentId = getCsvValue(row, ['segmentId', 'segment_id', 'segment'])
    const reviewBucket = normalizeBucket(
      getCsvValue(row, ['reviewBucket', 'bucket', 'sampleBucket']),
    )
    const status = normalizeStatus(getCsvValue(row, ['reviewStatus', 'status']))
    const reviewNote = getCsvValue(row, ['reviewNote', 'note', 'overrideNote'])
    const createdAt = getCsvValue(row, ['createdAt', 'reviewedAt', 'verifiedAt'])
    const rowDistrictId = getCsvValue(row, ['districtId', 'district_id', 'district'])
    const reviewPlanRank = Number(getCsvValue(row, ['reviewPlanRank']))
    const reviewPlanReason = getCsvValue(row, ['reviewPlanReason'])
    const addPriorityRow = (reviewState: ReviewPriorityState) => {
      if (!Number.isInteger(reviewPlanRank) || reviewPlanRank <= 0) {
        return
      }
      priorityRows.push({
        rowNumber,
        sourceRowNumber,
        rank: reviewPlanRank,
        segmentId,
        reviewBucket,
        reviewState,
        reasons: reviewPlanReason
          .split('|')
          .map((part) => part.trim())
          .filter(Boolean),
        mapsUrl: getCsvValue(row, ['mapsUrl', 'mapUrl']) || null,
        streetViewUrl: getCsvValue(row, ['streetViewUrl', 'street_view_url']) || null,
      })
    }
    const missingFields: string[] = []

    increment(bucketCounts, reviewBucket)
    if (!status) {
      addPriorityRow('pending')
      pendingRows += 1
      issues.push(
        buildIssue({
          rowNumber,
          sourceRowNumber,
          severity: 'pending',
          segmentId,
          reviewBucket,
          fields: ['reviewStatus', 'reviewNote', 'createdAt'],
        }),
      )
      return
    }

    reviewedRows += 1
    increment(statusCounts, status)
    increment(reviewedBucketCounts, reviewBucket)

    if (!isValidStatus(status)) {
      missingFields.push('valid reviewStatus')
    }
    if (!rowDistrictId) {
      missingFields.push('districtId')
    }
    if (!segmentId) {
      missingFields.push('segmentId')
    }
    if (!reviewNote) {
      missingFields.push('reviewNote')
    }
    if (!createdAt) {
      missingFields.push('createdAt')
    } else if (!isValidReviewTimestamp(createdAt)) {
      missingFields.push('valid createdAt')
    }

    if (missingFields.length > 0) {
      addPriorityRow('invalid')
      invalidRows += 1
      issues.push(
        buildIssue({
          rowNumber,
          sourceRowNumber,
          severity: 'error',
          segmentId,
          reviewBucket,
          fields: missingFields,
        }),
      )
      return
    }

    validReviewedRows += 1
    increment(validStatusCounts, status)
    increment(validReviewedBucketCounts, reviewBucket)
    addPriorityRow('valid')
  })

  return {
    districtId,
    status: 'audited',
    handoffCsv,
    estimatedMinimumNewReviews,
    remainingMinimumNewReviews: calculateRemainingMinimumNewReviews({
      validReviewedRows,
      statusCounts: validStatusCounts,
      reviewedBucketCounts: validReviewedBucketCounts,
    }),
    rows: rows.length,
    reviewedRows,
    validReviewedRows,
    pendingRows,
    invalidRows,
    statusCounts,
    bucketCounts,
    reviewedBucketCounts,
    priorityRows: priorityRows.sort((left, right) => left.rank - right.rank),
    issues,
  }
}

const readHandoffRows = async (handoffCsv: string) => {
  const raw = await fs.readFile(handoffCsv, 'utf-8')
  return parseCsv(raw, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[]
}

const auditEntry = async (
  entry: HumanReviewBundleEntry,
): Promise<ReviewHandoffAuditEntry> => {
  const handoffCsv = entry.files.handoffCsv.path
  const rows = await readHandoffRows(handoffCsv)
  return {
    ...auditRows(
      entry.districtId,
      handoffCsv,
      entry.handoffEstimatedMinimumNewReviews,
      rows,
    ),
    bundleId: entry.bundleId,
    status: entry.status,
  }
}

export const runReviewHandoffAudit = async (
  options: ReviewHandoffAuditOptions = {},
): Promise<ReviewHandoffAuditResult> => {
  const reviewRoot = path.resolve(options.reviewRoot ?? DEFAULT_REVIEW_ROOT)
  const districtIds = options.districtIds ?? []
  const errors: string[] = []
  const warnings: string[] = []
  if (!options.all && districtIds.length === 0) {
    errors.push('Pass at least one --district value or --all.')
  }

  const index = await runHumanReviewBundleIndex({
    reviewRoot,
    districtIds: options.all ? [] : districtIds,
    publishGateSummaryPath:
      options.publishGateSummaryPath === undefined
        ? DEFAULT_PUBLISH_GATE_SUMMARY
        : options.publishGateSummaryPath,
  })
  warnings.push(...index.errors.map((error) => `Index validation: ${error}`))
  warnings.push(...index.warnings)
  if (index.entries.length === 0) {
    errors.push('No review handoff bundles matched the selected districts.')
  }

  const entries: ReviewHandoffAuditEntry[] = []
  if (errors.length === 0) {
    for (const entry of index.entries) {
      try {
        entries.push(await auditEntry(entry))
      } catch (error) {
        errors.push(
          `${entry.bundleId}: failed to audit ${entry.files.handoffCsv.path}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  if (options.strict) {
    entries.forEach((entry) => {
      if (entry.pendingRows > 0 || entry.invalidRows > 0) {
        errors.push(
          `${entry.bundleId}: ${entry.pendingRows} pending row(s), ${entry.invalidRows} invalid reviewed row(s)`,
        )
      }
    })
  }

  return {
    pass: errors.length === 0,
    strict: Boolean(options.strict),
    reviewRoot,
    selectedDistricts: options.all ? ['*'] : districtIds,
    entries,
    errors,
    warnings,
  }
}

const formatCounts = (counts: Record<string, number>) => {
  const entries = Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return entries.length === 0
    ? 'none'
    : entries.map(([key, value]) => `${key} ${value}`).join(', ')
}

const formatIssue = (issue: ReviewHandoffRowIssue) =>
  `- row ${issue.rowNumber}${issue.sourceRowNumber ? ` (source row ${issue.sourceRowNumber})` : ''}: ${issue.severity}; ${issue.fields.join(', ')}; ${issue.reviewBucket}; ${issue.segmentId || 'unknown segment'}`

const formatPriorityRow = (row: ReviewHandoffPriorityRow) =>
  `- rank ${row.rank}: row ${row.rowNumber}${row.sourceRowNumber ? ` (source row ${row.sourceRowNumber})` : ''}; ${row.reviewBucket}; ${row.segmentId || 'unknown segment'}; ${row.reasons.join('|') || 'review_plan'}${row.streetViewUrl ? ` | ${row.streetViewUrl}` : ''}`

const selectOutstandingPriorityRows = (entry: ReviewHandoffAuditEntry) => {
  const minimum = entry.remainingMinimumNewReviews ?? entry.priorityRows.length
  if (minimum <= 0) {
    return []
  }
  return entry.priorityRows
    .filter((row) => row.reviewState !== 'valid')
    .slice(0, minimum)
}

export const buildReviewHandoffPriorityRows = (
  result: ReviewHandoffAuditResult,
): ReviewHandoffPriorityExportRow[] =>
  result.entries.flatMap((entry) => {
    const rows = selectOutstandingPriorityRows(entry)
    return rows.map((row) => ({
      bundleId: entry.bundleId,
      districtId: entry.districtId,
      status: entry.status,
      minimumNewReviews: entry.remainingMinimumNewReviews,
      rank: row.rank,
      rowNumber: row.rowNumber,
      sourceRowNumber: row.sourceRowNumber,
      segmentId: row.segmentId,
      reviewBucket: row.reviewBucket,
      reasons: row.reasons,
      mapsUrl: row.mapsUrl,
      streetViewUrl: row.streetViewUrl,
      handoffCsv: entry.handoffCsv,
    }))
  })

const escapeMarkdownCell = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/\|/g, '\\|')

export const renderReviewHandoffPriorityGuide = (
  result: ReviewHandoffAuditResult,
) => {
  const lines = [
    '# Review Priority Rows',
    '',
    `Review root: ${result.reviewRoot}`,
    `Selected districts: ${result.selectedDistricts.join(', ') || 'none'}`,
    '',
    'Fill the original handoff CSV rows with observed `reviewStatus`, `reviewNote`, and `createdAt`; this file is only a guide.',
    `Timestamp format: ${REVIEW_TIMESTAMP_MESSAGE}.`,
  ]

  result.entries.forEach((entry) => {
    const rows = buildReviewHandoffPriorityRows({
      ...result,
      entries: [entry],
    })
    const heading =
      entry.bundleId === entry.districtId
        ? entry.districtId
        : `${entry.bundleId} (district ${entry.districtId})`
    lines.push('', `## ${heading}`)
    lines.push(`Handoff CSV: ${entry.handoffCsv}`)
    lines.push(
      `Minimum remaining new reviews: ${entry.remainingMinimumNewReviews ?? 'unknown'}`,
    )
    if (rows.length === 0) {
      lines.push('Priority rows: none marked')
      return
    }
    lines.push(
      '',
      '| Rank | Handoff row | Source row | Bucket | Segment | Reasons | Street View |',
      '| ---: | ---: | ---: | --- | --- | --- | --- |',
    )
    rows.forEach((row) => {
      lines.push(
        [
          `| ${row.rank}`,
          row.rowNumber,
          row.sourceRowNumber ?? '',
          escapeMarkdownCell(row.reviewBucket),
          escapeMarkdownCell(row.segmentId || 'unknown segment'),
          escapeMarkdownCell(row.reasons.join('|') || 'review_plan'),
          `${escapeMarkdownCell(row.streetViewUrl)} |`,
        ].join(' | '),
      )
    })
  })

  return lines.join('\n')
}

const csvEscape = (value: unknown) => {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const renderReviewHandoffPriorityCsv = (
  result: ReviewHandoffAuditResult,
) => {
  const headers = [
    'bundleId',
    'districtId',
    'status',
    'minimumNewReviews',
    'rank',
    'handoffRowNumber',
    'sourceRowNumber',
    'segmentId',
    'reviewBucket',
    'reasons',
    'mapsUrl',
    'streetViewUrl',
    'handoffCsv',
    'reviewStatus',
    'reviewNote',
    'createdAt',
  ]
  const lines = [headers.join(',')]
  buildReviewHandoffPriorityRows(result).forEach((row) => {
    lines.push(
      [
        row.bundleId,
        row.districtId,
        row.status,
        row.minimumNewReviews ?? '',
        row.rank,
        row.rowNumber,
        row.sourceRowNumber ?? '',
        row.segmentId,
        row.reviewBucket,
        row.reasons,
        row.mapsUrl ?? '',
        row.streetViewUrl ?? '',
        row.handoffCsv,
        '',
        '',
        '',
      ]
        .map(csvEscape)
        .join(','),
    )
  })
  return lines.join('\n')
}

export const renderReviewHandoffAudit = (result: ReviewHandoffAuditResult) => {
  const lines = [
    `Review handoff audit: ${result.pass ? 'PASS' : 'FAIL'}`,
    `Mode: ${result.strict ? 'strict' : 'report'}`,
    `Review root: ${result.reviewRoot}`,
    `Selected districts: ${result.selectedDistricts.join(', ') || 'none'}`,
    '',
    '| Bundle | District | Status | Rows | Reviewed | Valid | Remaining | Pending | Invalid | Statuses | Reviewed buckets |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ]

  result.entries.forEach((entry) => {
    lines.push(
      [
        `| ${entry.bundleId}`,
        entry.districtId,
        entry.status,
        entry.rows,
        entry.reviewedRows,
        entry.validReviewedRows,
        entry.remainingMinimumNewReviews ?? 'unknown',
        entry.pendingRows,
        entry.invalidRows,
        formatCounts(entry.statusCounts),
        `${formatCounts(entry.reviewedBucketCounts)} |`,
      ].join(' | '),
    )
  })

  result.entries.forEach((entry) => {
    const heading =
      entry.bundleId === entry.districtId
        ? entry.districtId
        : `${entry.bundleId} (district ${entry.districtId})`
    lines.push('', `## ${heading}`)
    lines.push(`Handoff CSV: ${entry.handoffCsv}`)
    lines.push(
      `Minimum remaining new reviews: ${entry.remainingMinimumNewReviews ?? 'unknown'}`,
    )
    lines.push(`Buckets: ${formatCounts(entry.bucketCounts)}`)
    const priorityRows = selectOutstandingPriorityRows(entry)
    if (priorityRows.length > 0) {
      lines.push('Priority rows to review first:')
      priorityRows.forEach((row) => lines.push(formatPriorityRow(row)))
    } else {
      lines.push('Priority rows to review first: none marked')
    }
    if (entry.issues.length === 0) {
      lines.push('Issues: none')
    } else {
      lines.push('Issues:')
      entry.issues.slice(0, 30).forEach((issue) => lines.push(formatIssue(issue)))
      if (entry.issues.length > 30) {
        lines.push(`- ... ${entry.issues.length - 30} more issue(s)`)
      }
    }
  })

  if (result.errors.length > 0) {
    lines.push('', 'Errors:')
    result.errors.forEach((error) => lines.push(`- ${error}`))
  }
  if (result.warnings.length > 0) {
    lines.push('', 'Warnings:')
    result.warnings.forEach((warning) => lines.push(`- ${warning}`))
  }

  return lines.join('\n')
}

export const resolveReviewHandoffAuditSummaryPath = (
  options: Pick<ReviewHandoffAuditOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseReviewHandoffAuditArgs(process.argv)
  const result = await runReviewHandoffAudit(options)
  const markdown = renderReviewHandoffAudit(result)
  const output = options.json ? JSON.stringify(result, null, 2) : markdown
  console.log(output)

  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(path.resolve(options.jsonOutPath), `${JSON.stringify(result, null, 2)}\n`)
  }
  if (options.priorityOutPath) {
    await writeText(
      path.resolve(options.priorityOutPath),
      `${renderReviewHandoffPriorityGuide(result)}\n`,
    )
  }
  if (options.priorityCsvOutPath) {
    await writeText(
      path.resolve(options.priorityCsvOutPath),
      `${renderReviewHandoffPriorityCsv(result)}\n`,
    )
  }
  if (options.priorityJsonOutPath) {
    await writeText(
      path.resolve(options.priorityJsonOutPath),
      `${JSON.stringify(buildReviewHandoffPriorityRows(result), null, 2)}\n`,
    )
  }
  const summaryPath = resolveReviewHandoffAuditSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${markdown}\n\n`)
  }

  if (!result.pass && !options.reportOnly) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
