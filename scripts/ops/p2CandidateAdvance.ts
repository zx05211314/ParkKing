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
  renderP2PromoteExpansion,
  runP2PromoteExpansion,
  type P2PromoteExpansionOptions,
  type P2PromoteExpansionResult,
} from './p2PromoteExpansion'
import {
  renderP2Status,
  runP2Status,
  type P2StatusOptions,
  type P2StatusResult,
} from './p2Status'

const DEFAULT_CURRENT_DISTRICT = 'xinyi'
const DEFAULT_CONFIG_ROOT = 'configs/expansion'
const DEFAULT_PROD_CONFIG_ROOT = 'configs/prod'
const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_PUBLIC_ROOT = 'public/data/generated'
const DEFAULT_DRY_RUN_ROOT = 'data/generated'
const DEFAULT_PUBLISH_GATE_SUMMARY =
  'data/generated/_ops/publish_gate_summary.json'
const DEFAULT_OUT_PATH = '.tmp/p2-candidate-advance.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/p2-candidate-advance.json'
const DISTRICT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u

export type P2CandidateAdvanceStage =
  | 'blocked'
  | 'human-review-required'
  | 'ready-to-finalize'
  | 'ready-to-promote'
  | 'promotion-complete'
  | 'published'

export interface P2CandidateAdvanceOptions {
  districtId?: string | null
  currentDistrictId?: string | null
  configRoot?: string | null
  prodConfigRoot?: string | null
  reviewRoot?: string | null
  root?: string | null
  dryRunRoot?: string | null
  publishGateSummaryPath?: string | null
  execute?: boolean | null
  overwrite?: boolean | null
  outPath?: string | null
  jsonOutPath?: string | null
  json?: boolean | null
  reportOnly?: boolean | null
}

export interface P2CandidateAdvanceInputs {
  districtId: string
  currentDistrictId: string
  configRoot: string
  prodConfigRoot: string
  configGlob: string
  reviewRoot: string
  root: string
  dryRunRoot: string
  publishGateSummaryPath: string | null
  execute: boolean
  overwrite: boolean
}

export interface P2CandidateAdvanceResult {
  pass: boolean
  stage: P2CandidateAdvanceStage
  mode: 'dry-run' | 'execute'
  inputs: P2CandidateAdvanceInputs
  status: P2StatusResult
  handoffResult: P0AdvanceReviewsResult | null
  finalizeResult: P0AdvanceReviewsResult | null
  promotionResult: P2PromoteExpansionResult | null
  errors: string[]
  warnings: string[]
}

export interface P2CandidateAdvanceRunners {
  runStatus: (options: P2StatusOptions) => Promise<P2StatusResult>
  runAdvanceReviews: (
    options: P0AdvanceReviewsOptions,
  ) => Promise<P0AdvanceReviewsResult>
  runPromotion: (
    options: P2PromoteExpansionOptions,
  ) => Promise<P2PromoteExpansionResult>
}

const defaultRunners: P2CandidateAdvanceRunners = {
  runStatus: runP2Status,
  runAdvanceReviews: runP0AdvanceReviews,
  runPromotion: runP2PromoteExpansion,
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

export const parseP2CandidateAdvanceArgs = (
  argv: string[],
): P2CandidateAdvanceOptions => ({
  districtId: getArgValue(argv, '--district', '--district-id', '--districtId'),
  currentDistrictId: getArgValue(
    argv,
    '--current-district',
    '--currentDistrict',
  ),
  configRoot: getArgValue(argv, '--config-root', '--configRoot'),
  prodConfigRoot: getArgValue(
    argv,
    '--prod-config-root',
    '--prodConfigRoot',
  ),
  reviewRoot: getArgValue(argv, '--review-root', '--reviewRoot'),
  root: getArgValue(argv, '--root', '--public-root', '--publicRoot'),
  dryRunRoot: getArgValue(argv, '--dry-run-root', '--dryRunRoot'),
  publishGateSummaryPath: hasFlag(argv, '--no-publish-gate-summary')
    ? null
    : (getArgValue(
        argv,
        '--publish-gate-summary',
        '--publishGateSummary',
      ) ?? undefined),
  execute: hasFlag(argv, '--execute'),
  overwrite: hasFlag(argv, '--overwrite'),
  outPath:
    getArgValue(argv, '--out', '--out-path', '--outPath') ?? DEFAULT_OUT_PATH,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut', '--json-out-path') ??
    DEFAULT_JSON_OUT_PATH,
  json: hasFlag(argv, '--json'),
  reportOnly: hasFlag(argv, '--report-only', '--reportOnly'),
})

const normalizeRoot = (value: string | null | undefined, fallback: string) =>
  value?.trim() || fallback

export const resolveP2CandidateAdvanceInputs = (
  options: P2CandidateAdvanceOptions = {},
): P2CandidateAdvanceInputs => {
  const districtId = options.districtId?.trim().toLowerCase()
  if (!districtId) {
    throw new Error('--district is required')
  }
  if (!DISTRICT_ID_PATTERN.test(districtId)) {
    throw new Error(
      '--district must contain only lowercase letters, numbers, hyphens, or underscores',
    )
  }

  const currentDistrictId =
    options.currentDistrictId?.trim().toLowerCase() || DEFAULT_CURRENT_DISTRICT
  if (!DISTRICT_ID_PATTERN.test(currentDistrictId)) {
    throw new Error('--current-district is invalid')
  }
  if (districtId === currentDistrictId) {
    throw new Error('--district must differ from --current-district')
  }

  const configRoot = normalizeRoot(options.configRoot, DEFAULT_CONFIG_ROOT)
  const prodConfigRoot = normalizeRoot(
    options.prodConfigRoot,
    DEFAULT_PROD_CONFIG_ROOT,
  )
  return {
    districtId,
    currentDistrictId,
    configRoot,
    prodConfigRoot,
    configGlob: [
      path.posix.join(prodConfigRoot.replace(/\\/gu, '/'), `${currentDistrictId}.json`),
      path.posix.join(configRoot.replace(/\\/gu, '/'), `${districtId}.json`),
    ].join(','),
    reviewRoot: normalizeRoot(options.reviewRoot, DEFAULT_REVIEW_ROOT),
    root: normalizeRoot(options.root, DEFAULT_PUBLIC_ROOT),
    dryRunRoot: normalizeRoot(options.dryRunRoot, DEFAULT_DRY_RUN_ROOT),
    publishGateSummaryPath:
      options.publishGateSummaryPath === null
        ? null
        : normalizeRoot(
            options.publishGateSummaryPath,
            DEFAULT_PUBLISH_GATE_SUMMARY,
          ),
    execute: Boolean(options.execute),
    overwrite: Boolean(options.overwrite),
  }
}

const statusOptions = (inputs: P2CandidateAdvanceInputs): P2StatusOptions => ({
  currentDistrictId: inputs.currentDistrictId,
  expansionDistrictIds: [inputs.districtId],
  root: inputs.root,
  dryRunRoot: inputs.dryRunRoot,
  configGlob: inputs.configGlob,
  configRoot: inputs.configRoot,
  reviewRoot: inputs.reviewRoot,
  publishGateSummaryPath: inputs.publishGateSummaryPath,
  skipP1: true,
  reportOnly: true,
})

const commonAdvanceOptions = (
  inputs: P2CandidateAdvanceInputs,
): P0AdvanceReviewsOptions => ({
  districtIds: [inputs.districtId],
  reviewRoot: inputs.reviewRoot,
  configRoot: inputs.configRoot,
  publishGateSummaryPath: inputs.publishGateSummaryPath,
})

export const classifyP2CandidateStage = (
  status: P2StatusResult,
): P2CandidateAdvanceStage => {
  if (!status.pass || status.status === 'BLOCKED') {
    return 'blocked'
  }
  if (status.pendingHumanReviewDistricts.length > 0) {
    return 'human-review-required'
  }
  if (status.readyToFinalize || status.readyFinalizeDistricts.length > 0) {
    return 'ready-to-finalize'
  }
  if (
    status.readiness.expansionDistricts.some(
      (district) => district.nextAction === 'already-reviewed',
    )
  ) {
    return 'ready-to-promote'
  }
  if (
    status.readiness.expansionDistricts.length > 0 &&
    status.readiness.expansionDistricts.every(
      (district) => district.nextAction === 'published',
    )
  ) {
    return 'published'
  }
  return 'blocked'
}

const unique = (values: string[]) => Array.from(new Set(values))

export const runP2CandidateAdvance = async (
  options: P2CandidateAdvanceOptions = {},
  runners: P2CandidateAdvanceRunners = defaultRunners,
): Promise<P2CandidateAdvanceResult> => {
  const inputs = resolveP2CandidateAdvanceInputs(options)
  let status = await runners.runStatus(statusOptions(inputs))
  let stage = classifyP2CandidateStage(status)
  let handoffResult: P0AdvanceReviewsResult | null = null
  let finalizeResult: P0AdvanceReviewsResult | null = null
  let promotionResult: P2PromoteExpansionResult | null = null

  if (
    stage === 'human-review-required' &&
    !status.latestReviewPackages.some(
      (entry) => entry.districtId === inputs.districtId,
    )
  ) {
    handoffResult = await runners.runAdvanceReviews({
      ...commonAdvanceOptions(inputs),
      outPath: '.tmp/p2-human-review-handoff.md',
      jsonOutPath: '.tmp/p2-human-review-handoff.json',
    })
    if (handoffResult.pass) {
      status = await runners.runStatus(statusOptions(inputs))
      stage = classifyP2CandidateStage(status)
    }
  }

  if (stage === 'ready-to-finalize') {
    finalizeResult = await runners.runAdvanceReviews({
      ...commonAdvanceOptions(inputs),
      reviewIntake: true,
      includeCommonDirs: true,
      validateReadyIntake: true,
      reviewIntakeActionableOnly: true,
      requireReadyToFinalize: true,
      noPackage: true,
      execute: inputs.execute,
      outPath: '.tmp/p2-finalize-ready.md',
      jsonOutPath: '.tmp/p2-finalize-ready.json',
    })
    if (inputs.execute && finalizeResult.pass) {
      status = await runners.runStatus(statusOptions(inputs))
      stage = classifyP2CandidateStage(status)
    }
  }

  if (stage === 'ready-to-promote') {
    promotionResult = await runners.runPromotion({
      districtId: inputs.districtId,
      sourceRoot: inputs.configRoot,
      targetRoot: inputs.prodConfigRoot,
      execute: inputs.execute,
      overwrite: inputs.overwrite,
    })
    if (inputs.execute && promotionResult.pass) {
      stage = 'promotion-complete'
    }
  }

  const errors = unique([
    ...status.blockers,
    ...(handoffResult && !handoffResult.pass ? handoffResult.errors : []),
    ...(finalizeResult && !finalizeResult.pass ? finalizeResult.errors : []),
    ...(promotionResult && !promotionResult.pass ? promotionResult.errors : []),
  ])
  const warnings = unique([
    ...status.warnings,
    ...(handoffResult?.warnings ?? []),
    ...(finalizeResult?.warnings ?? []),
    ...(promotionResult?.warnings ?? []),
  ])

  return {
    pass: errors.length === 0 && stage !== 'blocked',
    stage,
    mode: inputs.execute ? 'execute' : 'dry-run',
    inputs,
    status,
    handoffResult,
    finalizeResult,
    promotionResult,
    errors,
    warnings,
  }
}

const nextActionLines = (result: P2CandidateAdvanceResult) => {
  const command = `npm run ops:p2-candidate-advance:execute -- --district ${result.inputs.districtId}`
  switch (result.stage) {
    case 'human-review-required':
      return [
        `- Fill reviewStatus/reviewNote/createdAt in ${path.join(
          result.inputs.reviewRoot,
          `${result.inputs.districtId}-human-review`,
          `${result.inputs.districtId}-next-review.csv`,
        )}`,
        `- Re-run: ${command}`,
      ]
    case 'ready-to-finalize':
      return [`- Review the finalize plan below.`, `- Execute: ${command}`]
    case 'ready-to-promote':
      return [`- Review the promotion plan below.`, `- Execute: ${command}`]
    case 'promotion-complete':
      return result.promotionResult?.followUpCommands.map(
        (followUp) => `- ${followUp}`,
      ) ?? ['- Run the production ingest for the promoted district.']
    case 'published':
      return ['- none; this candidate is published.']
    default:
      return ['- Fix the blockers below before continuing.']
  }
}

export const renderP2CandidateAdvance = (
  result: P2CandidateAdvanceResult,
) => {
  const lines = [
    `# P2 Candidate Advance: ${result.stage.toUpperCase().replace(/-/gu, '_')}`,
    '',
    '## Summary',
    '',
    `- District: ${result.inputs.districtId}`,
    `- Mode: ${result.mode}`,
    `- Automation pass: ${result.pass ? 'yes' : 'no'}`,
    `- Candidate config: ${path.join(
      result.inputs.configRoot,
      `${result.inputs.districtId}.json`,
    )}`,
    '',
    '## Next Action',
    '',
    ...nextActionLines(result),
  ]

  if (result.handoffResult) {
    lines.push('', '## Human Review Handoff', '', renderP0AdvanceReviews(result.handoffResult))
  }
  if (result.finalizeResult) {
    lines.push('', '## Finalize', '', renderP0AdvanceReviews(result.finalizeResult))
  }
  if (result.promotionResult) {
    lines.push('', '## Promotion', '', renderP2PromoteExpansion(result.promotionResult))
  }
  if (result.errors.length > 0) {
    lines.push('', '## Errors', '', ...result.errors.map((error) => `- ${error}`))
  }
  if (result.warnings.length > 0) {
    lines.push(
      '',
      '## Warnings',
      '',
      ...result.warnings.map((warning) => `- ${warning}`),
    )
  }
  lines.push('', '## Status Detail', '', renderP2Status(result.status))
  return lines.join('\n')
}

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseP2CandidateAdvanceArgs(process.argv)
  const result = await runP2CandidateAdvance(options)
  const markdown = renderP2CandidateAdvance(result)
  process.stdout.write(
    options.json ? `${JSON.stringify(result, null, 2)}\n` : `${markdown}\n`,
  )
  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(
      path.resolve(options.jsonOutPath),
      `${JSON.stringify(result, null, 2)}\n`,
    )
  }
  if (!result.pass && !options.reportOnly) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
