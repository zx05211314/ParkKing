import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import { buildP0PromoteReview } from './p0PromoteReviewState'
import type {
  P0PromoteReviewParams,
  P0PromoteReviewResult,
} from './p0PromoteReviewTypes'

const DEFAULT_DISTRICT_ID = 'xinyi'
const DEFAULT_PRIORITY_REVIEWS = path.join('.tmp', 'human-review-priority.csv')

interface CsvTable {
  headers: string[]
  rows: string[][]
}

export interface P0ValidatePriorityReviewOptions {
  districtId?: string | null
  sourcePath?: string | null
  reviewsPath?: string | null
  filteredReviewsOutPath?: string | null
  mergedOutPath?: string | null
  configPath?: string | null
  outDir?: string | null
  allowPublishWarn?: boolean
  allowPublishFail?: boolean
  publishOverrideReason?: string | null
  json?: boolean
  promote?: (params: P0PromoteReviewParams) => Promise<P0PromoteReviewResult>
}

export interface P0ValidatePriorityReviewResult {
  pass: boolean
  districtId: string
  sourcePath: string
  reviewsPath: string
  filteredReviewsOutPath: string
  mergedOutPath: string
  configPath: string
  outDir: string
  priorityRows: number
  filteredRows: number
  promote: P0PromoteReviewResult | null
  finalizeCommand: string | null
  errors: string[]
  warnings: string[]
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

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parseP0ValidatePriorityReviewArgs = (
  argv: string[],
): P0ValidatePriorityReviewOptions => ({
  districtId: getArgValue(argv, '--district', '--districtId', '--district-id'),
  sourcePath: getArgValue(argv, '--source', '--sourcePath', '--source-path'),
  reviewsPath: getArgValue(argv, '--reviews', '--reviewsPath', '--reviews-path'),
  filteredReviewsOutPath: getArgValue(
    argv,
    '--filtered-reviews-out',
    '--filteredReviewsOut',
    '--filteredReviewsOutPath',
  ),
  mergedOutPath: getArgValue(argv, '--merged-out', '--mergedOut', '--mergedOutPath'),
  configPath: getArgValue(argv, '--config', '--configPath', '--config-path'),
  outDir: getArgValue(argv, '--out-dir', '--outDir'),
  allowPublishWarn: hasFlag(argv, '--allow-publish-warn', '--allowPublishWarn'),
  allowPublishFail: hasFlag(argv, '--allow-publish-fail', '--allowPublishFail'),
  publishOverrideReason: getArgValue(
    argv,
    '--publish-override',
    '--publishOverride',
    '--override',
  ),
  json: hasFlag(argv, '--json'),
})

const normalizeHeader = (value: string) => value.trim().toLowerCase()

const findHeaderIndex = (headers: string[], candidates: string[]) => {
  const normalizedHeaders = headers.map(normalizeHeader)
  for (const candidate of candidates) {
    const index = normalizedHeaders.findIndex(
      (header) => header === normalizeHeader(candidate),
    )
    if (index >= 0) {
      return index
    }
  }
  return -1
}

const parseCsvTable = (raw: string): CsvTable => {
  const records = parseCsv(raw, {
    bom: true,
    skip_empty_lines: true,
  }) as string[][]
  const headers = records[0] ?? []
  const rows = records.slice(1).map((row) => {
    const normalized = [...row]
    while (normalized.length < headers.length) {
      normalized.push('')
    }
    return normalized
  })
  return { headers, rows }
}

const getCell = (row: string[], index: number) =>
  index >= 0 ? (row[index] ?? '').trim() : ''

const csvEscape = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

const stringifyCsvTable = (table: CsvTable) =>
  `${[table.headers, ...table.rows]
    .map((row) => row.map((value) => csvEscape(value ?? '')).join(','))
    .join('\n')}\n`

const resolveInputs = (options: P0ValidatePriorityReviewOptions) => {
  const districtId = options.districtId?.trim() || DEFAULT_DISTRICT_ID
  return {
    districtId,
    sourcePath: path.resolve(
      options.sourcePath ?? path.join('.tmp', `${districtId}-review.csv`),
    ),
    reviewsPath: path.resolve(options.reviewsPath ?? DEFAULT_PRIORITY_REVIEWS),
    filteredReviewsOutPath: path.resolve(
      options.filteredReviewsOutPath ??
        path.join('.tmp', `${districtId}-priority-review.filtered.csv`),
    ),
    mergedOutPath: path.resolve(
      options.mergedOutPath ??
        path.join('.tmp', `${districtId}-priority-review.merged.csv`),
    ),
    configPath: path.resolve(
      options.configPath ?? path.join('configs', 'prod', `${districtId}.json`),
    ),
    outDir: path.resolve(
      options.outDir ?? path.join('.tmp', 'priority-review-overrides', districtId),
    ),
  }
}

const quoteArg = (value: string) => `"${value}"`

const buildFinalizeCommand = (
  result: Omit<P0ValidatePriorityReviewResult, 'finalizeCommand' | 'pass'>,
  options: P0ValidatePriorityReviewOptions,
) => {
  const args = [
    'npm run ops:p0-finalize-review --',
    '--district',
    result.districtId,
    '--source',
    quoteArg(result.sourcePath),
    '--reviews',
    quoteArg(result.filteredReviewsOutPath),
    '--merged-out',
    quoteArg(result.mergedOutPath),
    '--config',
    quoteArg(result.configPath),
  ]
  if (options.allowPublishWarn) {
    args.push('--allow-publish-warn')
  }
  if (options.allowPublishFail) {
    args.push('--allow-publish-fail')
  }
  const reason = options.publishOverrideReason?.trim()
  if (reason) {
    args.push('--publish-override', quoteArg(reason))
  }
  return args.join(' ')
}

const filterPriorityRows = async (params: {
  districtId: string
  reviewsPath: string
  filteredReviewsOutPath: string
  errors: string[]
}) => {
  const raw = await fs.readFile(params.reviewsPath, 'utf-8')
  const table = parseCsvTable(raw)
  if (table.headers.length === 0) {
    params.errors.push('Priority review CSV has no header row.')
    return { priorityRows: 0, filteredRows: 0 }
  }
  const districtIndex = findHeaderIndex(table.headers, [
    'districtId',
    'district_id',
    'district',
  ])
  if (districtIndex < 0) {
    params.errors.push('Priority review CSV is missing required column districtId.')
    return { priorityRows: table.rows.length, filteredRows: 0 }
  }

  const filtered = table.rows.filter(
    (row) => getCell(row, districtIndex) === params.districtId,
  )
  await fs.mkdir(path.dirname(params.filteredReviewsOutPath), { recursive: true })
  await fs.writeFile(
    params.filteredReviewsOutPath,
    stringifyCsvTable({ headers: table.headers, rows: filtered }),
    'utf-8',
  )
  return { priorityRows: table.rows.length, filteredRows: filtered.length }
}

export const runP0ValidatePriorityReview = async (
  options: P0ValidatePriorityReviewOptions = {},
): Promise<P0ValidatePriorityReviewResult> => {
  const inputs = resolveInputs(options)
  const errors: string[] = []
  const warnings: string[] = []
  let promote: P0PromoteReviewResult | null = null

  const { priorityRows, filteredRows } = await filterPriorityRows({
    districtId: inputs.districtId,
    reviewsPath: inputs.reviewsPath,
    filteredReviewsOutPath: inputs.filteredReviewsOutPath,
    errors,
  })
  if (filteredRows === 0) {
    errors.push(`No priority review rows matched district ${inputs.districtId}.`)
  }

  if (errors.length === 0) {
    promote = await (options.promote ?? buildP0PromoteReview)({
      districtId: inputs.districtId,
      sourcePath: inputs.sourcePath,
      reviewsPath: inputs.filteredReviewsOutPath,
      mergedOutPath: inputs.mergedOutPath,
      configPath: inputs.configPath,
      outDir: inputs.outDir,
    })
    errors.push(...promote.errors)
    warnings.push(...promote.warnings)
  }

  const baseResult = {
    ...inputs,
    priorityRows,
    filteredRows,
    promote,
    errors,
    warnings,
  }
  const pass = errors.length === 0 && Boolean(promote?.pass)
  return {
    ...baseResult,
    pass,
    finalizeCommand: pass ? buildFinalizeCommand(baseResult, options) : null,
  }
}

const statusLabel = (result: P0ValidatePriorityReviewResult) =>
  result.pass ? 'PASS' : 'FAIL'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

const formatPromoteSummary = (promote: P0PromoteReviewResult | null) => {
  if (!promote) {
    return ['- Promotion gate: not run']
  }
  return [
    `- Promotion gate: ${promote.pass ? 'PASS' : 'FAIL'}`,
    `- Apply: ${promote.apply ? (promote.apply.pass ? 'PASS' : 'FAIL') : 'not run'}`,
    `- Applied rows: ${promote.apply?.appliedRows ?? 'not run'}`,
    `- Skipped blank rows: ${promote.apply?.skippedBlankRows ?? 'not run'}`,
    `- Gate: ${promote.gate ? (promote.gate.pass ? 'PASS' : 'FAIL') : 'not run'}`,
    `- Review rows: ${
      promote.gate
        ? `${promote.gate.summary.validReviewedRows} valid / ${promote.gate.summary.reviewedRows} reviewed / ${promote.gate.summary.totalRows} total`
        : 'not run'
    }`,
    `- Effective overrides: ${promote.gate?.preflight?.effectiveOverrides ?? 'not run'}`,
    `- Matched segment overrides: ${promote.gate?.preflight?.matchedSegmentOverrides ?? 'not run'}`,
  ]
}

export const renderP0ValidatePriorityReview = (
  result: P0ValidatePriorityReviewResult,
) =>
  [
    `P0 priority review validation: ${statusLabel(result)}`,
    `District: ${result.districtId}`,
    `Source review CSV: ${result.sourcePath}`,
    `Priority review CSV: ${result.reviewsPath}`,
    `Filtered priority CSV: ${result.filteredReviewsOutPath}`,
    `Merged CSV: ${result.mergedOutPath}`,
    `Config: ${result.configPath}`,
    `Override out dir: ${result.outDir}`,
    `Priority rows: ${result.filteredRows}/${result.priorityRows} selected`,
    '',
    '## Promotion Gate',
    ...formatPromoteSummary(result.promote),
    '',
    '## Next Step',
    result.finalizeCommand
      ? `Run after you confirm the reviewed evidence is intentionally final:\n\n\`\`\`powershell\n${result.finalizeCommand}\n\`\`\``
      : 'Fix errors or fill review evidence before finalizing.',
    '',
    '## Errors',
    formatList(result.errors),
    '',
    '## Warnings',
    formatList(result.warnings),
  ].join('\n')

const run = async () => {
  const options = parseP0ValidatePriorityReviewArgs(process.argv)
  const result = await runP0ValidatePriorityReview(options)
  process.stdout.write(
    options.json
      ? `${JSON.stringify(result, null, 2)}\n`
      : `${renderP0ValidatePriorityReview(result)}\n`,
  )
  if (!result.pass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
