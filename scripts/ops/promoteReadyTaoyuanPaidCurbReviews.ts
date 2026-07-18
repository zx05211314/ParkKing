import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type HumanReviewBundleIndexOptions,
  type HumanReviewBundleIndexResult,
  runHumanReviewBundleIndex,
} from './humanReviewBundleIndex'
import { promoteTaoyuanPaidCurbReview } from './promoteTaoyuanPaidCurbReview'

const DEFAULT_REVIEW_DIR = '.tmp/taoyuan-human-review'
const DEFAULT_REFERENCE = 'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_OUTPUT_DIR = 'review-evidence/taoyuan'
const DEFAULT_REPORT = '.tmp/taoyuan-review-promotion-status.md'
const DEFAULT_JSON_REPORT = '.tmp/taoyuan-review-promotion-status.json'

export interface PromoteReadyTaoyuanReviewsOptions {
  reviewDir?: string
  referencePath?: string
  outputDir?: string
  districtIds?: string[]
  execute?: boolean
  requireAllApproved?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
}

export interface TaoyuanReviewPromotionEntry {
  districtId: string
  reviewPath: string
  manifestPath: string
  reviewStatus: string
  action: 'ready' | 'promoted' | 'skipped' | 'blocked'
  destinationReviewPath: string | null
  destinationManifestPath: string | null
  reason: string | null
}

export interface PromoteReadyTaoyuanReviewsResult {
  pass: boolean
  execute: boolean
  requireAllApproved: boolean
  reviewDir: string
  referencePath: string
  outputDir: string
  entries: TaoyuanReviewPromotionEntry[]
  readyCount: number
  promotedCount: number
  skippedCount: number
  blockedCount: number
  warnings: string[]
  errors: string[]
}

interface PromoteReadyTaoyuanReviewsDependencies {
  runIndex?: (
    options: HumanReviewBundleIndexOptions,
  ) => Promise<HumanReviewBundleIndexResult>
  promoteReview?: (options: {
    districtId: string
    inputPath: string
    manifestPath: string
    referencePath: string
    outputDir: string
  }) => Promise<{
    destinationReviewPath: string
    destinationManifestPath: string
  }>
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

const getArgValues = (argv: string[], ...flags: string[]) =>
  argv
    .flatMap((value, index) =>
      flags.includes(value) && argv[index + 1] ? [argv[index + 1]!] : [],
    )
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parsePromoteReadyTaoyuanReviewsArgs = (
  argv: string[],
): PromoteReadyTaoyuanReviewsOptions => ({
  reviewDir:
    getArgValue(argv, '--review-dir', '--reviewDir') ?? DEFAULT_REVIEW_DIR,
  referencePath:
    getArgValue(argv, '--reference') ?? DEFAULT_REFERENCE,
  outputDir:
    getArgValue(argv, '--out-dir', '--outDir') ?? DEFAULT_OUTPUT_DIR,
  districtIds: getArgValues(
    argv,
    '--district',
    '--district-id',
    '--districtId',
  ),
  execute: hasFlag(argv, '--execute'),
  requireAllApproved: hasFlag(
    argv,
    '--require-all-approved',
    '--requireAllApproved',
  ),
  outPath: getArgValue(argv, '--out') ?? DEFAULT_REPORT,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_REPORT,
})

export const promoteReadyTaoyuanPaidCurbReviews = async (
  options: PromoteReadyTaoyuanReviewsOptions = {},
  dependencies: PromoteReadyTaoyuanReviewsDependencies = {},
): Promise<PromoteReadyTaoyuanReviewsResult> => {
  const reviewDir = path.resolve(options.reviewDir ?? DEFAULT_REVIEW_DIR)
  const referencePath = path.resolve(
    options.referencePath ?? DEFAULT_REFERENCE,
  )
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR)
  const execute = options.execute ?? false
  const requireAllApproved = options.requireAllApproved ?? false
  const runIndex = dependencies.runIndex ?? runHumanReviewBundleIndex
  const promoteReview =
    dependencies.promoteReview ?? promoteTaoyuanPaidCurbReview
  const index = await runIndex({
    reviewRoot: reviewDir,
    districtIds: options.districtIds,
    publishGateSummaryPath: null,
    sourceTextReferencePath: referencePath,
  })
  const warnings = [...index.warnings]
  const errors = [...index.errors]
  const specializedEntries = index.specializedEntries ?? []
  const entries: TaoyuanReviewPromotionEntry[] = []

  if (specializedEntries.length === 0) {
    errors.push('No Taoyuan source-text review entries were found.')
  }

  for (const entry of specializedEntries) {
    if (entry.status !== 'approved') {
      const blocked = entry.status === 'invalid' || entry.status === 'unknown'
      entries.push({
        districtId: entry.districtId,
        reviewPath: entry.reviewPath,
        manifestPath: entry.manifestPath,
        reviewStatus: entry.status,
        action: blocked ? 'blocked' : 'skipped',
        destinationReviewPath: null,
        destinationManifestPath: null,
        reason: blocked
          ? 'review artifacts are invalid or unverifiable'
          : 'human source-text review is not fully approved',
      })
      if (blocked) {
        errors.push(
          `${entry.districtId}: source-text review status is ${entry.status}.`,
        )
      }
      continue
    }

    if (!execute) {
      entries.push({
        districtId: entry.districtId,
        reviewPath: entry.reviewPath,
        manifestPath: entry.manifestPath,
        reviewStatus: entry.status,
        action: 'ready',
        destinationReviewPath: null,
        destinationManifestPath: null,
        reason: null,
      })
      continue
    }

    try {
      const promoted = await promoteReview({
        districtId: entry.districtId,
        inputPath: entry.reviewPath,
        manifestPath: entry.manifestPath,
        referencePath,
        outputDir,
      })
      entries.push({
        districtId: entry.districtId,
        reviewPath: entry.reviewPath,
        manifestPath: entry.manifestPath,
        reviewStatus: entry.status,
        action: 'promoted',
        destinationReviewPath: promoted.destinationReviewPath,
        destinationManifestPath: promoted.destinationManifestPath,
        reason: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${entry.districtId}: promotion failed: ${message}`)
      entries.push({
        districtId: entry.districtId,
        reviewPath: entry.reviewPath,
        manifestPath: entry.manifestPath,
        reviewStatus: entry.status,
        action: 'blocked',
        destinationReviewPath: null,
        destinationManifestPath: null,
        reason: message,
      })
    }
  }

  const notApproved = entries.filter(
    ({ reviewStatus }) => reviewStatus !== 'approved',
  )
  if (requireAllApproved && notApproved.length > 0) {
    errors.push(
      `${notApproved.length} Taoyuan district review(s) are not fully approved.`,
    )
  }

  return {
    pass: errors.length === 0,
    execute,
    requireAllApproved,
    reviewDir,
    referencePath,
    outputDir,
    entries,
    readyCount: entries.filter(({ action }) => action === 'ready').length,
    promotedCount: entries.filter(({ action }) => action === 'promoted').length,
    skippedCount: entries.filter(({ action }) => action === 'skipped').length,
    blockedCount: entries.filter(({ action }) => action === 'blocked').length,
    warnings,
    errors,
  }
}

export const renderPromoteReadyTaoyuanReviews = (
  result: PromoteReadyTaoyuanReviewsResult,
) => [
  `Taoyuan source-text promotion: ${result.pass ? 'PASS' : 'BLOCKED'}`,
  `Mode: ${result.execute ? 'execute' : 'report-only'}`,
  `Review directory: ${result.reviewDir}`,
  `Reference: ${result.referencePath}`,
  `Approved and ready: ${result.readyCount}`,
  `Promoted: ${result.promotedCount}`,
  `Skipped pending/resolution: ${result.skippedCount}`,
  `Blocked: ${result.blockedCount}`,
  '',
  '| District | Review status | Action | Reason |',
  '| --- | --- | --- | --- |',
  ...result.entries.map(
    (entry) =>
      `| ${entry.districtId} | ${entry.reviewStatus} | ${entry.action} | ${entry.reason ?? '-'} |`,
  ),
  ...(result.warnings.length > 0
    ? ['', 'Warnings:', ...result.warnings.map((warning) => `- ${warning}`)]
    : []),
  ...(result.errors.length > 0
    ? ['', 'Errors:', ...result.errors.map((error) => `- ${error}`)]
    : []),
  '',
].join('\n')

const run = async () => {
  const options = parsePromoteReadyTaoyuanReviewsArgs(process.argv)
  const result = await promoteReadyTaoyuanPaidCurbReviews(options)
  const report = renderPromoteReadyTaoyuanReviews(result)
  console.log(report)
  if (options.outPath) {
    await fs.mkdir(path.dirname(path.resolve(options.outPath)), {
      recursive: true,
    })
    await fs.writeFile(path.resolve(options.outPath), report, 'utf-8')
  }
  if (options.jsonOutPath) {
    await fs.mkdir(path.dirname(path.resolve(options.jsonOutPath)), {
      recursive: true,
    })
    await fs.writeFile(
      path.resolve(options.jsonOutPath),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf-8',
    )
  }
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
