import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type HumanReviewBundleEntry,
  type HumanReviewBundleFinalizeInputs,
  runHumanReviewBundleIndex,
} from './humanReviewBundleIndex'
import { buildP0FinalizeReview } from './p0FinalizeReviewState'
import type {
  P0FinalizeReviewParams,
  P0FinalizeReviewResult,
} from './p0FinalizeReviewTypes'

const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_CONFIG_ROOT = 'configs/prod'
const DEFAULT_PUBLISH_GATE_SUMMARY = 'data/generated/_ops/publish_gate_summary.json'

type ReadyStatus = 'ready-to-finalize' | 'review-complete'

export interface P0FinalizeReadyReviewsOptions {
  reviewRoot?: string
  configRoot?: string
  districtIds?: string[]
  all?: boolean
  publishGateSummaryPath?: string | null
  execute?: boolean
  summaryPath?: string
  json?: boolean
  finalize?: (params: P0FinalizeReviewParams) => Promise<P0FinalizeReviewResult>
}

export interface P0FinalizeReadyReviewsEntry {
  districtId: string
  status: string
  command: string
  inputs: HumanReviewBundleFinalizeInputs
  result: P0FinalizeReviewResult | null
}

export interface P0FinalizeReadyReviewsSkippedEntry {
  districtId: string
  status: string
  reason: string
}

export interface P0FinalizeReadyReviewsResult {
  pass: boolean
  mode: 'dry-run' | 'execute'
  reviewRoot: string
  selectedDistricts: string[]
  ready: P0FinalizeReadyReviewsEntry[]
  skipped: P0FinalizeReadyReviewsSkippedEntry[]
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

export const parseP0FinalizeReadyReviewsArgs = (
  argv: string[],
): P0FinalizeReadyReviewsOptions => ({
  reviewRoot:
    getArgValue(argv, '--review-root', '--reviewRoot') ?? DEFAULT_REVIEW_ROOT,
  configRoot:
    getArgValue(argv, '--config-root', '--configRoot') ?? DEFAULT_CONFIG_ROOT,
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
  execute: hasFlag(argv, '--execute'),
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  json: hasFlag(argv, '--json'),
})

const readyStatuses = new Set<ReadyStatus>(['ready-to-finalize', 'review-complete'])

const isReadyEntry = (
  entry: HumanReviewBundleEntry,
): entry is HumanReviewBundleEntry & { status: ReadyStatus } =>
  readyStatuses.has(entry.status as ReadyStatus)

const toFinalizeParams = (
  inputs: HumanReviewBundleFinalizeInputs,
): P0FinalizeReviewParams => ({
  districtId: inputs.districtId,
  sourcePath: inputs.sourcePath,
  reviewsPath: inputs.reviewsPath,
  mergedOutPath: inputs.mergedOutPath,
  configPath: inputs.configPath,
  allowPublishWarn: inputs.allowPublishWarn,
  publishOverrideReason: inputs.publishOverrideReason,
})

export const runP0FinalizeReadyReviews = async (
  options: P0FinalizeReadyReviewsOptions = {},
): Promise<P0FinalizeReadyReviewsResult> => {
  const reviewRoot = path.resolve(options.reviewRoot ?? DEFAULT_REVIEW_ROOT)
  const configRoot = options.configRoot ?? DEFAULT_CONFIG_ROOT
  const districtIds = options.districtIds ?? []
  const errors: string[] = []
  const warnings: string[] = []
  if (!options.all && districtIds.length === 0) {
    errors.push('Pass at least one --district value or --all.')
  }

  const index = await runHumanReviewBundleIndex({
    reviewRoot,
    configRoot,
    districtIds: options.all ? [] : districtIds,
    publishGateSummaryPath:
      options.publishGateSummaryPath === undefined
        ? DEFAULT_PUBLISH_GATE_SUMMARY
        : options.publishGateSummaryPath,
  })
  warnings.push(...index.warnings)
  errors.push(...index.errors)

  const readyEntries = index.entries.filter(isReadyEntry)
  const skipped = index.entries
    .filter((entry) => !isReadyEntry(entry))
    .map((entry) => ({
      districtId: entry.districtId,
      status: entry.status,
      reason: 'human review handoff is not ready to finalize',
    }))

  if (readyEntries.length === 0) {
    errors.push('No review bundles are ready to finalize.')
  }

  const finalize = options.finalize ?? buildP0FinalizeReview
  const shouldExecute = Boolean(options.execute && errors.length === 0)
  const ready: P0FinalizeReadyReviewsEntry[] = []
  for (const entry of readyEntries) {
    let result: P0FinalizeReviewResult | null = null
    if (shouldExecute) {
      result = await finalize(toFinalizeParams(entry.finalizeInputs))
      if (!result.pass) {
        errors.push(`${entry.districtId}: finalize stopped at ${result.stage}`)
      }
    }
    ready.push({
      districtId: entry.districtId,
      status: entry.status,
      command: entry.finalizeCommand,
      inputs: entry.finalizeInputs,
      result,
    })
  }

  return {
    pass: errors.length === 0,
    mode: options.execute ? 'execute' : 'dry-run',
    reviewRoot,
    selectedDistricts: options.all ? ['*'] : districtIds,
    ready,
    skipped,
    errors,
    warnings,
  }
}

const statusLabel = (result: P0FinalizeReadyReviewsResult) =>
  result.pass ? 'PASS' : 'BLOCKED'

export const renderP0FinalizeReadyReviews = (
  result: P0FinalizeReadyReviewsResult,
) => {
  const lines = [
    `P0 finalize ready reviews: ${statusLabel(result)}`,
    `Mode: ${result.mode}`,
    `Review root: ${result.reviewRoot}`,
    `Selected districts: ${result.selectedDistricts.join(', ') || 'none'}`,
    `Ready bundles: ${result.ready.length}`,
    `Skipped bundles: ${result.skipped.length}`,
    '',
    '## Ready',
  ]

  if (result.ready.length === 0) {
    lines.push('- none')
  }
  result.ready.forEach((entry) => {
    lines.push(`- ${entry.districtId}: ${entry.status}`)
    lines.push(`  Command: ${entry.command}`)
    if (entry.result) {
      lines.push(
        `  Result: ${entry.result.pass ? 'PASS' : 'FAIL'} at ${entry.result.stage}`,
      )
    }
  })

  lines.push('', '## Skipped')
  if (result.skipped.length === 0) {
    lines.push('- none')
  }
  result.skipped.forEach((entry) => {
    lines.push(`- ${entry.districtId}: ${entry.status}; ${entry.reason}`)
  })

  if (result.errors.length > 0) {
    lines.push('', '## Errors')
    result.errors.forEach((error) => lines.push(`- ${error}`))
  }
  if (result.warnings.length > 0) {
    lines.push('', '## Warnings')
    result.warnings.forEach((warning) => lines.push(`- ${warning}`))
  }

  return lines.join('\n')
}

export const resolveP0FinalizeReadyReviewsSummaryPath = (
  options: Pick<P0FinalizeReadyReviewsOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const run = async () => {
  const options = parseP0FinalizeReadyReviewsArgs(process.argv)
  const result = await runP0FinalizeReadyReviews(options)
  const output = options.json
    ? JSON.stringify(result, null, 2)
    : renderP0FinalizeReadyReviews(result)
  console.log(output)

  const summaryPath = resolveP0FinalizeReadyReviewsSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${renderP0FinalizeReadyReviews(result)}\n\n`)
  }

  if (!result.pass) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
