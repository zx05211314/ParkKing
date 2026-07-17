import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type HumanReviewBundleEntry,
  type HumanReviewBundleIndexResult,
  renderHumanReviewBundleIndex,
  runHumanReviewBundleIndex,
} from './humanReviewBundleIndex'
import {
  type PackageHumanReviewsOptions,
  type PackageHumanReviewsResult,
  renderPackageHumanReviews,
  runPackageHumanReviews,
} from './packageHumanReviews'
import {
  type P0FinalizeReadyReviewsOptions,
  type P0FinalizeReadyReviewsResult,
  renderP0FinalizeReadyReviews,
  runP0FinalizeReadyReviews,
} from './p0FinalizeReadyReviews'
import { buildP0FinalizeReview } from './p0FinalizeReviewState'
import {
  type ReviewHandoffAuditOptions,
  type ReviewHandoffAuditResult,
  renderReviewHandoffAudit,
  runReviewHandoffAudit,
} from './reviewHandoffAudit'
import {
  type P0ReviewIntakeCandidate,
  type P0ReviewIntakeOptions,
  type P0ReviewIntakeResult,
  renderP0ReviewIntake,
  runP0ReviewIntake,
} from './p0ReviewIntake'
import type {
  P0FinalizeReviewParams,
  P0FinalizeReviewResult,
} from './p0FinalizeReviewTypes'

const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_CONFIG_ROOT = 'configs/prod'
const DEFAULT_OUT_DIR = '.tmp/human-review-packages'
const DEFAULT_PUBLISH_GATE_SUMMARY = 'data/generated/_ops/publish_gate_summary.json'

type AdvanceStatus =
  | 'completed'
  | 'action-required'
  | 'ready-to-finalize'
  | 'blocked'

export interface P0AdvanceReviewsOptions {
  reviewRoot?: string
  configRoot?: string
  districtIds?: string[]
  all?: boolean
  outDir?: string
  publishGateSummaryPath?: string | null
  requireReadyToFinalize?: boolean
  reviewIntake?: boolean
  reviewIntakeScanDirs?: string[]
  includeCommonDirs?: boolean
  validateReadyIntake?: boolean
  reviewIntakeActionableOnly?: boolean
  noPackage?: boolean
  execute?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
  summaryPath?: string
  json?: boolean
  reportOnly?: boolean
  now?: Date
  finalize?: (params: P0FinalizeReviewParams) => Promise<P0FinalizeReviewResult>
  packageReviews?: (
    options: PackageHumanReviewsOptions,
  ) => Promise<PackageHumanReviewsResult>
  auditHandoffs?: (
    options: ReviewHandoffAuditOptions,
  ) => Promise<ReviewHandoffAuditResult>
  reviewIntakeScanner?: (
    options: P0ReviewIntakeOptions,
  ) => Promise<P0ReviewIntakeResult>
  finalizeReadyReviews?: (
    options: P0FinalizeReadyReviewsOptions,
  ) => Promise<P0FinalizeReadyReviewsResult>
}

export interface P0AdvanceReviewEntry {
  bundleId: string
  districtId: string
  status: string
  nextAction: string
}

export interface P0AdvanceIntakeFinalizeEntry {
  bundleId: string
  districtId: string
  candidateFilePath: string
  command: string
  params: P0FinalizeReviewParams
  result: P0FinalizeReviewResult | null
}

export interface P0AdvanceReviewsResult {
  pass: boolean
  status: AdvanceStatus
  mode: 'dry-run' | 'execute'
  reviewRoot: string
  configRoot: string
  outDir: string
  selectedDistricts: string[]
  entries: P0AdvanceReviewEntry[]
  index: HumanReviewBundleIndexResult
  reviewIntakeResult: P0ReviewIntakeResult | null
  auditResult: ReviewHandoffAuditResult | null
  packageResult: PackageHumanReviewsResult | null
  finalizeResult: P0FinalizeReadyReviewsResult | null
  intakeFinalizeResults: P0AdvanceIntakeFinalizeEntry[]
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

export const parseP0AdvanceReviewsArgs = (
  argv: string[],
): P0AdvanceReviewsOptions => ({
  reviewRoot:
    getArgValue(argv, '--review-root', '--reviewRoot') ?? DEFAULT_REVIEW_ROOT,
  configRoot:
    getArgValue(argv, '--config-root', '--configRoot') ?? DEFAULT_CONFIG_ROOT,
  districtIds: getArgValues(argv, '--district', '--district-id', '--districtId'),
  all: hasFlag(argv, '--all'),
  outDir: getArgValue(argv, '--out-dir', '--outDir') ?? DEFAULT_OUT_DIR,
  publishGateSummaryPath: hasFlag(argv, '--no-publish-gate-summary')
    ? null
    : (getArgValue(
        argv,
        '--publish-gate-summary',
        '--publishGateSummary',
        '--publish-gate-summary-path',
        '--publishGateSummaryPath',
      ) ?? DEFAULT_PUBLISH_GATE_SUMMARY),
  requireReadyToFinalize: hasFlag(
    argv,
    '--require-ready-to-finalize',
    '--requireReadyToFinalize',
  ),
  reviewIntake: hasFlag(argv, '--review-intake', '--reviewIntake'),
  reviewIntakeScanDirs: getArgValues(argv, '--scan-dir', '--scanDir'),
  includeCommonDirs: hasFlag(argv, '--include-common-dirs', '--includeCommonDirs'),
  validateReadyIntake: hasFlag(argv, '--validate-ready', '--validateReady'),
  reviewIntakeActionableOnly: hasFlag(
    argv,
    '--actionable-only',
    '--actionableOnly',
  ),
  noPackage: hasFlag(argv, '--no-package', '--noPackage', '--skip-package'),
  execute: hasFlag(argv, '--execute'),
  outPath: getArgValue(argv, '--out', '--out-path', '--outPath') ?? undefined,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut', '--json-out-path', '--jsonOutPath') ??
    undefined,
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  json: hasFlag(argv, '--json'),
  reportOnly: hasFlag(argv, '--report-only', '--reportOnly'),
})

const readyForReview = (entry: HumanReviewBundleEntry) =>
  entry.status === 'ready-for-review'

const readyForFinalize = (entry: HumanReviewBundleEntry) =>
  entry.canFinalizeIndependently &&
  (entry.status === 'ready-to-finalize' || entry.status === 'review-complete')

const incomplete = (entry: HumanReviewBundleEntry) => entry.status === 'incomplete'

const requiredNotReadyDistricts = (
  entries: HumanReviewBundleEntry[],
  districtIds: string[],
  all: boolean | undefined,
  readyBundleIds: Set<string> = new Set(),
) => {
  const readyStatuses = new Set(['ready-to-finalize', 'review-complete'])
  if (all) {
    return entries
      .filter(
        (entry) =>
          (!readyStatuses.has(entry.status) ||
            !entry.canFinalizeIndependently) &&
          !readyBundleIds.has(entry.bundleId),
      )
      .map((entry) => entry.bundleId)
  }

  const matched = new Set<string>()
  const notReady = entries
    .filter((entry) => {
      const selected =
        districtIds.includes(entry.districtId) || districtIds.includes(entry.bundleId)
      if (selected) {
        matched.add(entry.districtId)
        matched.add(entry.bundleId)
      }
      return (
        selected &&
        (!readyStatuses.has(entry.status) ||
          !entry.canFinalizeIndependently) &&
        !readyBundleIds.has(entry.bundleId)
      )
    })
    .map((entry) => entry.bundleId)

  districtIds.forEach((districtId) => {
    if (!matched.has(districtId) && !readyBundleIds.has(districtId)) {
      notReady.push(districtId)
    }
  })

  return Array.from(new Set(notReady))
}

const nextAction = (entry: HumanReviewBundleEntry) => {
  if (readyForReview(entry)) {
    return 'package-human-review'
  }
  if (readyForFinalize(entry)) {
    return 'finalize-review'
  }
  return 'repair-review-bundle'
}

const candidateBundleId = (candidate: P0ReviewIntakeCandidate) =>
  candidate.bundleId ?? candidate.districtId

const toIntakeFinalizeParams = (
  candidate: P0ReviewIntakeCandidate,
  bundleEntry: HumanReviewBundleEntry | undefined,
): P0FinalizeReviewParams | null => {
  const validation = candidate.validation
  if (!candidate.finalizeCommand || !validation?.pass) {
    return null
  }

  return {
    districtId: validation.districtId,
    sourcePath: validation.sourcePath,
    reviewsPath: validation.filteredReviewsOutPath,
    mergedOutPath: validation.mergedOutPath,
    configPath: validation.configPath,
    answerCasesPath: bundleEntry?.finalizeInputs.answerCasesPath,
    allowPublishWarn: bundleEntry?.finalizeInputs.allowPublishWarn,
    publishOverrideReason: bundleEntry?.finalizeInputs.publishOverrideReason,
  }
}

const resolveStatus = (params: {
  hasErrors: boolean
  hasIncomplete: boolean
  packaged: boolean
  finalized: boolean
  readyForFinalize: boolean
  execute: boolean
}): AdvanceStatus => {
  if (params.hasErrors || params.hasIncomplete) {
    return 'blocked'
  }
  if (params.packaged) {
    return 'action-required'
  }
  if (params.readyForFinalize && !params.execute) {
    return 'ready-to-finalize'
  }
  return params.finalized ? 'completed' : 'action-required'
}

export const runP0AdvanceReviews = async (
  options: P0AdvanceReviewsOptions = {},
): Promise<P0AdvanceReviewsResult> => {
  const reviewRoot = path.resolve(options.reviewRoot ?? DEFAULT_REVIEW_ROOT)
  const configRoot = options.configRoot ?? DEFAULT_CONFIG_ROOT
  const outDir = path.resolve(options.outDir ?? DEFAULT_OUT_DIR)
  const districtIds = options.districtIds ?? []
  const selectedDistricts = options.all ? ['*'] : districtIds
  const errors: string[] = []
  const warnings: string[] = []
  if (!options.all && districtIds.length === 0) {
    errors.push('Pass at least one --district value or --all.')
  }

  const publishGateSummaryPath =
    options.publishGateSummaryPath === undefined
      ? DEFAULT_PUBLISH_GATE_SUMMARY
      : options.publishGateSummaryPath
  const index = await runHumanReviewBundleIndex({
    reviewRoot,
    configRoot,
    districtIds: options.all ? [] : districtIds,
    publishGateSummaryPath,
    requireReadyToFinalize: options.requireReadyToFinalize,
  })
  errors.push(...index.errors)
  warnings.push(...index.warnings)

  const entries = index.entries.map((entry) => ({
    bundleId: entry.bundleId,
    districtId: entry.districtId,
    status: entry.status,
    nextAction: nextAction(entry),
  }))
  const bundleById = new Map(
    index.entries.map((entry) => [entry.bundleId, entry] as const),
  )
  const reviewEntries = index.entries.filter(readyForReview)
  const finalizeEntries = index.entries.filter(readyForFinalize)
  const incompleteEntries = index.entries.filter(incomplete)
  incompleteEntries.forEach((entry) => {
    errors.push(`${entry.districtId}: human review bundle is incomplete`)
  })

  let reviewIntakeResult: P0ReviewIntakeResult | null = null
  if (options.reviewIntake && selectedDistricts.length > 0) {
    reviewIntakeResult = await (options.reviewIntakeScanner ?? runP0ReviewIntake)({
      reviewRoot,
      configRoot,
      districtIds: options.all
        ? index.entries.map((entry) => entry.bundleId)
        : districtIds,
      scanDirs: options.reviewIntakeScanDirs,
      includeCommonDirs: options.includeCommonDirs,
      publishGateSummaryPath,
      validateReady: options.validateReadyIntake,
      actionableOnly: options.reviewIntakeActionableOnly,
    })
    if (!reviewIntakeResult.pass) {
      errors.push(...reviewIntakeResult.errors)
    }
    warnings.push(...reviewIntakeResult.warnings)
  }

  const intakeReadyBundleIds = new Set(
    (reviewIntakeResult?.candidates ?? [])
      .filter((candidate) => candidate.finalizeCommand)
      .map(candidateBundleId),
  )
  const notReadyForRequiredFinalize = options.requireReadyToFinalize
    ? requiredNotReadyDistricts(
        index.entries,
        districtIds,
        options.all,
        intakeReadyBundleIds,
      )
    : []
  if (notReadyForRequiredFinalize.length > 0) {
    errors.push(
      `Require-ready-to-finalize failed; not ready for finalize: ${notReadyForRequiredFinalize.join(', ')}`,
    )
  }
  const reviewEntriesToPackage = reviewEntries.filter(
    (entry) => !intakeReadyBundleIds.has(entry.bundleId),
  )

  let auditResult: ReviewHandoffAuditResult | null = null
  if (reviewEntriesToPackage.length > 0 && selectedDistricts.length > 0) {
    auditResult = await (options.auditHandoffs ?? runReviewHandoffAudit)({
      reviewRoot,
      districtIds: reviewEntriesToPackage.map((entry) => entry.bundleId),
      publishGateSummaryPath,
    })
    errors.push(...auditResult.errors)
    warnings.push(...auditResult.warnings)
  }

  let packageResult: PackageHumanReviewsResult | null = null
  if (
    reviewEntriesToPackage.length > 0 &&
    selectedDistricts.length > 0 &&
    options.noPackage
  ) {
    warnings.push(
      `Packaging skipped by --no-package for: ${reviewEntriesToPackage
        .map((entry) => entry.bundleId)
        .join(', ')}`,
    )
  } else if (reviewEntriesToPackage.length > 0 && selectedDistricts.length > 0) {
    packageResult = await (options.packageReviews ?? runPackageHumanReviews)({
      reviewRoot,
      districtIds: reviewEntriesToPackage.map((entry) => entry.bundleId),
      outDir,
      configRoot,
      publishGateSummaryPath,
      now: options.now,
    })
    errors.push(...packageResult.errors)
    warnings.push(...packageResult.warnings)
  }

  let finalizeResult: P0FinalizeReadyReviewsResult | null = null
  if (finalizeEntries.length > 0 && errors.length === 0) {
    finalizeResult = await (options.finalizeReadyReviews ?? runP0FinalizeReadyReviews)({
      reviewRoot,
      districtIds: finalizeEntries.map((entry) => entry.bundleId),
      configRoot,
      publishGateSummaryPath,
      execute: options.execute,
      finalize: options.finalize,
    })
    errors.push(...finalizeResult.errors)
    warnings.push(...finalizeResult.warnings)
  }

  const bundleFinalizeIds = new Set(
    finalizeEntries.map((entry) => entry.bundleId),
  )
  const intakeFinalizeCandidates = (reviewIntakeResult?.candidates ?? []).filter(
    (candidate) =>
      Boolean(candidate.finalizeCommand) &&
      !bundleFinalizeIds.has(candidateBundleId(candidate)),
  )
  const intakeFinalizeResults: P0AdvanceIntakeFinalizeEntry[] = []
  const shouldExecuteIntakeFinalize = Boolean(
    options.execute && errors.length === 0 && intakeFinalizeCandidates.length > 0,
  )
  const finalize = options.finalize ?? buildP0FinalizeReview
  for (const candidate of intakeFinalizeCandidates) {
    const params = toIntakeFinalizeParams(
      candidate,
      bundleById.get(candidateBundleId(candidate)),
    )
    if (!params || !candidate.finalizeCommand) {
      continue
    }
    let result: P0FinalizeReviewResult | null = null
    if (shouldExecuteIntakeFinalize) {
      result = await finalize(params)
      if (!result.pass) {
        errors.push(`${candidate.districtId}: intake finalize stopped at ${result.stage}`)
      }
    }
    intakeFinalizeResults.push({
      bundleId: candidateBundleId(candidate),
      districtId: candidate.districtId,
      candidateFilePath: candidate.filePath,
      command: candidate.finalizeCommand,
      params,
      result,
    })
  }

  const status = resolveStatus({
    hasErrors: errors.length > 0,
    hasIncomplete: incompleteEntries.length > 0,
    packaged: Boolean(packageResult?.packages.length),
    finalized: Boolean(
      finalizeResult?.ready.some((entry) => entry.result?.pass) ||
        intakeFinalizeResults.some((entry) => entry.result?.pass),
    ),
    readyForFinalize:
      finalizeEntries.length > 0 || intakeReadyBundleIds.size > 0,
    execute: Boolean(options.execute),
  })

  return {
    pass: status !== 'blocked',
    status,
    mode: options.execute ? 'execute' : 'dry-run',
    reviewRoot,
    configRoot,
    outDir,
    selectedDistricts,
    entries,
    index,
    reviewIntakeResult,
    auditResult,
    packageResult,
    finalizeResult,
    intakeFinalizeResults,
    errors,
    warnings,
  }
}

const statusLabel = (result: P0AdvanceReviewsResult) =>
  result.pass ? result.status.toUpperCase() : 'BLOCKED'

export const renderP0AdvanceReviews = (result: P0AdvanceReviewsResult) => {
  const lines = [
    `P0 advance reviews: ${statusLabel(result)}`,
    `Mode: ${result.mode}`,
    `Review root: ${result.reviewRoot}`,
    `Config root: ${result.configRoot}`,
    `Output dir: ${result.outDir}`,
    `Selected districts: ${result.selectedDistricts.join(', ') || 'none'}`,
    '',
    '## Districts',
  ]

  if (result.entries.length === 0) {
    lines.push('- none')
  }
  result.entries.forEach((entry) => {
    const label =
      entry.bundleId === entry.districtId
        ? entry.districtId
        : `${entry.bundleId} (district ${entry.districtId})`
    lines.push(`- ${label}: ${entry.status}; next ${entry.nextAction}`)
  })

  lines.push('', '## Human Review Index', renderHumanReviewBundleIndex(result.index))

  if (result.reviewIntakeResult) {
    lines.push('', '## Review Intake', renderP0ReviewIntake(result.reviewIntakeResult))
  }
  if (result.auditResult) {
    lines.push('', '## Handoff Audit', renderReviewHandoffAudit(result.auditResult))
  }
  if (result.packageResult) {
    lines.push('', '## Review Packages', renderPackageHumanReviews(result.packageResult))
  }
  if (result.finalizeResult) {
    lines.push('', '## Finalize', renderP0FinalizeReadyReviews(result.finalizeResult))
  }
  if (result.intakeFinalizeResults.length > 0) {
    lines.push('', '## Intake Finalize')
    result.intakeFinalizeResults.forEach((entry) => {
      lines.push(
        `- ${entry.bundleId} (district ${entry.districtId}): ${entry.candidateFilePath}`,
      )
      lines.push(`  Command: ${entry.command}`)
      if (entry.result) {
        lines.push(
          `  Result: ${entry.result.pass ? 'PASS' : 'FAIL'} at ${entry.result.stage}`,
        )
      }
    })
  }

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

export const resolveP0AdvanceReviewsSummaryPath = (
  options: Pick<P0AdvanceReviewsOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseP0AdvanceReviewsArgs(process.argv)
  const result = await runP0AdvanceReviews(options)
  const markdown = renderP0AdvanceReviews(result)
  const output = options.json ? JSON.stringify(result, null, 2) : markdown
  console.log(output)

  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(path.resolve(options.jsonOutPath), `${JSON.stringify(result, null, 2)}\n`)
  }
  const summaryPath = resolveP0AdvanceReviewsSummaryPath(options)
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
