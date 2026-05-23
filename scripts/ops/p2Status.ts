import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  renderP0AdvanceReviews,
  runP0AdvanceReviews,
  type P0AdvanceReviewsOptions,
  type P0AdvanceReviewsResult,
} from './p0AdvanceReviews'
import {
  renderP2ExpansionReadiness,
  runP2ExpansionReadiness,
  type P2ExpansionReadinessOptions,
  type P2ExpansionReadinessResult,
} from './p2ExpansionReadiness'

type P2StatusValue =
  | 'BLOCKED'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'READY_TO_FINALIZE'
  | 'EXPANSION_READY'

export interface P2StatusOptions {
  currentDistrictId?: string | null
  expansionDistrictIds?: string[] | null
  root?: string | null
  dryRunRoot?: string | null
  registryPath?: string | null
  configGlob?: string | null
  reviewRoot?: string | null
  publishGateSummaryPath?: string | null
  skipP1?: boolean | null
  timeoutMs?: number | null
  outPath?: string | null
  jsonOutPath?: string | null
  summaryPath?: string | null
  json?: boolean | null
}

export interface P2StatusInputs {
  currentDistrictId: string
  expansionDistrictIds: string[]
  root: string
  dryRunRoot: string
  registryPath: string
  configGlob: string
  reviewRoot: string
  publishGateSummaryPath: string | null
  skipP1: boolean
  timeoutMs: number
}

export interface P2StatusResult {
  pass: boolean
  status: P2StatusValue
  readyToFinalize: boolean
  inputs: P2StatusInputs
  readiness: P2ExpansionReadinessResult
  strictReadiness: P2ExpansionReadinessResult
  reviewGate: P0AdvanceReviewsResult
  blockers: string[]
  pendingHumanReviewDistricts: string[]
  readyFinalizeDistricts: string[]
  finalizedDistricts: string[]
  latestReviewPackages: P2ReviewPackageArtifact[]
  warnings: string[]
}

export interface P2ReviewPackageArtifact {
  districtId: string
  zipPath: string
  bytes: number
  modifiedAt: string
}

export interface P2StatusRunners {
  runP2ExpansionReadiness: (
    options: P2ExpansionReadinessOptions,
  ) => Promise<P2ExpansionReadinessResult>
  runP0AdvanceReviews: (
    options: P0AdvanceReviewsOptions,
  ) => Promise<P0AdvanceReviewsResult>
  findLatestReviewPackages?: (
    outDir: string,
    districtIds: string[],
  ) => Promise<P2ReviewPackageArtifact[]>
}

const DEFAULT_CURRENT_DISTRICT = 'xinyi'
const DEFAULT_EXPANSION_DISTRICTS = ['daan', 'zhongshan']
const DEFAULT_ROOT = 'public/data/generated'
const DEFAULT_DRY_RUN_ROOT = 'data/generated'
const DEFAULT_CONFIG_GLOB = 'configs/prod/*.json'
const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_TIMEOUT_MS = 25_000

const defaultRunners: P2StatusRunners = {
  runP2ExpansionReadiness,
  runP0AdvanceReviews,
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

const parsePositiveInteger = (value: string | null, label: string) => {
  if (value === null) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

export const parseP2StatusArgs = (argv: string[]): P2StatusOptions => ({
  currentDistrictId: getArgValue(
    argv,
    '--current-district',
    '--currentDistrict',
  ),
  expansionDistrictIds: getArgValues(
    argv,
    '--expansion-district',
    '--expansionDistrict',
    '--district',
  ),
  root: getArgValue(argv, '--root', '--public-root', '--publicRoot'),
  dryRunRoot: getArgValue(argv, '--dry-run-root', '--dryRunRoot'),
  registryPath: getArgValue(argv, '--registry', '--registry-path', '--registryPath'),
  configGlob: getArgValue(argv, '--configs', '--config-glob', '--configGlob'),
  reviewRoot: getArgValue(argv, '--review-root', '--reviewRoot'),
  publishGateSummaryPath: hasFlag(argv, '--no-publish-gate-summary')
    ? null
    : (getArgValue(
        argv,
        '--publish-gate-summary',
        '--publishGateSummary',
        '--publish-gate-summary-path',
        '--publishGateSummaryPath',
      ) ?? undefined),
  skipP1: hasFlag(argv, '--skip-p1', '--skipP1'),
  timeoutMs:
    parsePositiveInteger(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      'timeout-ms',
    ) ?? null,
  outPath: getArgValue(argv, '--out', '--out-path', '--outPath'),
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut', '--json-out-path', '--jsonOutPath') ??
    undefined,
  summaryPath: getArgValue(argv, '--summary', '--summary-path', '--summaryPath'),
  json: hasFlag(argv, '--json'),
})

export const resolveP2StatusInputs = (
  options: P2StatusOptions = {},
): P2StatusInputs => {
  const root = options.root?.trim() || DEFAULT_ROOT
  const dryRunRoot = options.dryRunRoot?.trim() || DEFAULT_DRY_RUN_ROOT
  return {
    currentDistrictId:
      options.currentDistrictId?.trim() || DEFAULT_CURRENT_DISTRICT,
    expansionDistrictIds:
      options.expansionDistrictIds && options.expansionDistrictIds.length > 0
        ? options.expansionDistrictIds
        : DEFAULT_EXPANSION_DISTRICTS,
    root,
    dryRunRoot,
    registryPath:
      options.registryPath?.trim() || path.join(root, 'registry.json'),
    configGlob: options.configGlob?.trim() || DEFAULT_CONFIG_GLOB,
    reviewRoot: options.reviewRoot?.trim() || DEFAULT_REVIEW_ROOT,
    publishGateSummaryPath:
      options.publishGateSummaryPath === null
        ? null
        : options.publishGateSummaryPath?.trim() ||
          path.join(dryRunRoot, '_ops', 'publish_gate_summary.json'),
    skipP1: Boolean(options.skipP1),
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
}

const expectedReviewGateBlocker = (error: string) =>
  error.startsWith('Require-ready-to-finalize failed; not ready for finalize:')

const unique = (values: string[]) => Array.from(new Set(values))

const p2ReadinessOptions = (
  inputs: P2StatusInputs,
  requireReadyToFinalize: boolean,
): P2ExpansionReadinessOptions => ({
  currentDistrictId: inputs.currentDistrictId,
  expansionDistrictIds: inputs.expansionDistrictIds,
  root: inputs.root,
  dryRunRoot: inputs.dryRunRoot,
  registryPath: inputs.registryPath,
  configGlob: inputs.configGlob,
  reviewRoot: inputs.reviewRoot,
  publishGateSummaryPath: inputs.publishGateSummaryPath,
  skipP1: inputs.skipP1,
  requireReadyToFinalize,
  timeoutMs: inputs.timeoutMs,
})

const reviewGateOptions = (inputs: P2StatusInputs): P0AdvanceReviewsOptions => ({
  reviewRoot: inputs.reviewRoot,
  districtIds: inputs.expansionDistrictIds,
  publishGateSummaryPath: inputs.publishGateSummaryPath,
  reviewIntake: true,
  includeCommonDirs: true,
  validateReadyIntake: true,
  reviewIntakeActionableOnly: true,
  requireReadyToFinalize: true,
  noPackage: true,
})

const findLatestReviewPackages = async (
  outDir: string,
  districtIds: string[],
): Promise<P2ReviewPackageArtifact[]> => {
  if (districtIds.length === 0) {
    return []
  }
  let entries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    entries = await fs.readdir(outDir, { withFileTypes: true })
  } catch {
    return []
  }

  const packages: P2ReviewPackageArtifact[] = []
  for (const districtId of districtIds) {
    const prefix = `${districtId}-human-review-`
    const districtFiles = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith(prefix) &&
          entry.name.endsWith('.zip'),
      )
      .map((entry) => path.join(outDir, entry.name))
    const stats = await Promise.all(
      districtFiles.map(async (zipPath) => ({
        districtId,
        zipPath,
        stat: await fs.stat(zipPath),
      })),
    )
    const latest = stats.sort((left, right) => {
      const delta = right.stat.mtimeMs - left.stat.mtimeMs
      return delta === 0 ? right.zipPath.localeCompare(left.zipPath) : delta
    })[0]
    if (latest) {
      packages.push({
        districtId: latest.districtId,
        zipPath: latest.zipPath,
        bytes: latest.stat.size,
        modifiedAt: latest.stat.mtime.toISOString(),
      })
    }
  }
  return packages
}

const resolveP2Status = (params: {
  readiness: P2ExpansionReadinessResult
  strictReadiness: P2ExpansionReadinessResult
  reviewGate: P0AdvanceReviewsResult
  unexpectedReviewGateErrors: string[]
}): P2StatusValue => {
  if (!params.readiness.pass || params.unexpectedReviewGateErrors.length > 0) {
    return 'BLOCKED'
  }
  if (params.strictReadiness.pass && params.reviewGate.pass) {
    return params.readiness.status === 'EXPANSION_READY'
      ? 'EXPANSION_READY'
      : 'READY_TO_FINALIZE'
  }
  if (params.readiness.status === 'READY_TO_FINALIZE') {
    return 'READY_TO_FINALIZE'
  }
  return params.readiness.status === 'EXPANSION_READY'
    ? 'EXPANSION_READY'
    : 'HUMAN_REVIEW_REQUIRED'
}

export const runP2Status = async (
  options: P2StatusOptions = {},
  runners: P2StatusRunners = defaultRunners,
): Promise<P2StatusResult> => {
  const inputs = resolveP2StatusInputs(options)
  const readiness = await runners.runP2ExpansionReadiness(
    p2ReadinessOptions(inputs, false),
  )
  const strictReadiness = await runners.runP2ExpansionReadiness(
    p2ReadinessOptions(inputs, true),
  )
  const reviewGate = await runners.runP0AdvanceReviews(reviewGateOptions(inputs))
  const unexpectedReviewGateErrors = reviewGate.errors.filter(
    (error) => !expectedReviewGateBlocker(error),
  )
  const pendingHumanReviewDistricts = unique(
    readiness.expansionDistricts
      .filter((district) => district.nextAction === 'fill-human-review')
      .map((district) => district.districtId),
  )
  const finalizedDistricts = unique(
    readiness.expansionDistricts
      .filter((district) => district.nextAction === 'published')
      .map((district) => district.districtId),
  )
  const finalizedDistrictSet = new Set(finalizedDistricts)
  const latestReviewPackages = await (
    runners.findLatestReviewPackages ?? findLatestReviewPackages
  )(reviewGate.outDir, pendingHumanReviewDistricts)
  const readyFinalizeDistricts = unique([
    ...readiness.expansionDistricts
      .filter((district) => district.nextAction === 'finalize-review')
      .map((district) => district.districtId),
    ...reviewGate.intakeFinalizeResults.map((entry) => entry.districtId),
    ...(reviewGate.finalizeResult?.ready.map((entry) => entry.districtId) ?? []),
  ]).filter((districtId) => !finalizedDistrictSet.has(districtId))
  const blockers = [
    ...readiness.blockers,
    ...unexpectedReviewGateErrors.map((error) => `review gate: ${error}`),
  ]
  const status = resolveP2Status({
    readiness,
    strictReadiness,
    reviewGate,
    unexpectedReviewGateErrors,
  })

  return {
    pass: blockers.length === 0,
    status,
    readyToFinalize: status === 'READY_TO_FINALIZE',
    inputs,
    readiness,
    strictReadiness,
    reviewGate,
    blockers,
    pendingHumanReviewDistricts,
    readyFinalizeDistricts,
    finalizedDistricts,
    latestReviewPackages,
    warnings: unique([
      ...readiness.warnings,
      ...strictReadiness.warnings,
      ...reviewGate.warnings,
    ]),
  }
}

const formatList = (values: string[]) => values.join(', ') || 'none'

const finalizeCommandLines = (result: P2StatusResult) =>
  unique([
    ...result.reviewGate.intakeFinalizeResults
      .filter((entry) => result.readyFinalizeDistricts.includes(entry.districtId))
      .map((entry) => entry.command),
    ...(result.reviewGate.finalizeResult?.ready
      .filter((entry) => result.readyFinalizeDistricts.includes(entry.districtId))
      .map((entry) => entry.command) ?? []),
  ]).map((command) => `- ${command}`)

const nextCommandLines = (result: P2StatusResult) => {
  if (result.status === 'BLOCKED') {
    return ['- Fix blockers listed above before continuing.']
  }
  if (result.status === 'EXPANSION_READY') {
    return ['- none; expansion districts are published. Continue with the next roadmap priority.']
  }
  if (result.readyFinalizeDistricts.length > 0 || result.readyToFinalize) {
    const finalizeCommands = finalizeCommandLines(result)
    return [
      '- npm run ops:p2-finalize-ready',
      ...(finalizeCommands.length > 0
        ? finalizeCommands
        : ['- Review the `ops:p2-finalize-ready` report for district finalize commands.']),
      '- npm run ops:p2-finalize-ready:execute',
      '- npm run ops:p2-expansion-readiness:strict',
    ]
  }
  return [
    '- npm run ops:p2-human-review-handoff',
    '- npm run ops:p2-review-diagnostics',
    '- Fill reviewStatus/reviewNote/createdAt in returned Daan/Zhongshan reviewer CSVs.',
    '- npm run ops:p2-review-intake',
    '- npm run ops:p2-review-gate',
  ]
}

const humanReviewRequiredLines = (result: P2StatusResult) =>
  result.pendingHumanReviewDistricts.map((districtId) => {
    const handoffPath = path.join(
      result.inputs.reviewRoot,
      `${districtId}-human-review`,
      `${districtId}-next-review.csv`,
    )
    return `- ${districtId}: fill reviewStatus/reviewNote/createdAt in ${handoffPath}`
  })

const latestReviewPackageLines = (result: P2StatusResult) => {
  const packageByDistrict = new Map(
    result.latestReviewPackages.map((entry) => [entry.districtId, entry] as const),
  )
  return result.pendingHumanReviewDistricts.map((districtId) => {
    const packageEntry = packageByDistrict.get(districtId)
    if (!packageEntry) {
      return `- ${districtId}: none found; run \`npm run ops:p2-human-review-handoff\``
    }
    return `- ${districtId}: ${packageEntry.zipPath} (${packageEntry.bytes} bytes, ${packageEntry.modifiedAt})`
  })
}

const reviewGateLines = (result: P2StatusResult) =>
  result.status === 'EXPANSION_READY'
    ? [
        'Review intake/gate output is omitted because expansion districts are already published.',
        `Finalized districts: ${formatList(result.finalizedDistricts)}`,
      ]
    : [renderP0AdvanceReviews(result.reviewGate)]

export const renderP2Status = (result: P2StatusResult) => {
  const humanReviewLines = humanReviewRequiredLines(result)
  const reviewPackageLines = latestReviewPackageLines(result)
  const lines = [
    `# P2 Status: ${result.status}`,
    '',
    '## Summary',
    '',
    `- Automation pass: ${result.pass ? 'yes' : 'no'}`,
    `- Ready to finalize: ${result.readyToFinalize ? 'yes' : 'no'}`,
    `- Current district: ${result.inputs.currentDistrictId}`,
    `- Expansion districts: ${result.inputs.expansionDistrictIds.join(', ')}`,
    `- P1 release: ${result.readiness.p1Release ? (result.readiness.p1Release.pass ? 'pass' : 'blocked') : 'skipped'}`,
    `- Pending human review: ${formatList(result.pendingHumanReviewDistricts)}`,
    `- Ready finalize districts: ${formatList(result.readyFinalizeDistricts)}`,
    `- Finalized districts: ${formatList(result.finalizedDistricts)}`,
    '',
    '## Current Readiness',
    '',
    renderP2ExpansionReadiness(result.readiness),
    '',
    '## Strict Readiness',
    '',
    renderP2ExpansionReadiness(result.strictReadiness),
    '',
    '## Review Intake And Gate',
    '',
    ...reviewGateLines(result),
    '',
    ...(humanReviewLines.length > 0
      ? ['## Human Review Required', '', ...humanReviewLines, '']
      : []),
    ...(reviewPackageLines.length > 0
      ? ['## Latest Review Packages', '', ...reviewPackageLines, '']
      : []),
    '## Automation Blockers',
    '',
    ...(result.blockers.length === 0
      ? ['- none']
      : result.blockers.map((blocker) => `- ${blocker}`)),
    '',
    '## Next Commands',
    '',
    ...nextCommandLines(result),
  ]
  if (result.warnings.length > 0) {
    lines.push('', '## Warnings', '')
    result.warnings.forEach((warning) => lines.push(`- ${warning}`))
  }
  return lines.join('\n')
}

export const resolveP2StatusSummaryPath = (
  options: Pick<P2StatusOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseP2StatusArgs(process.argv)
  const result = await runP2Status(options)
  const markdown = renderP2Status(result)
  process.stdout.write(
    options.json ? `${JSON.stringify(result, null, 2)}\n` : `${markdown}\n`,
  )
  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(path.resolve(options.jsonOutPath), `${JSON.stringify(result, null, 2)}\n`)
  }
  const summaryPath = resolveP2StatusSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${markdown}\n\n`)
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
