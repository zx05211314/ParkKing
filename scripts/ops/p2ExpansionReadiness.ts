import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runDistrictReadinessMatrix,
  splitConfigGlobPatterns,
  type DistrictReadinessEntry,
  type DistrictReadinessMatrixOptions,
  type DistrictReadinessMatrixResult,
} from './districtReadinessMatrix'
import {
  runHumanReviewBundleIndex,
  type HumanReviewBundleEntry,
  type HumanReviewBundleIndexOptions,
  type HumanReviewBundleIndexResult,
} from './humanReviewBundleIndex'
import {
  runP1ReleaseReadiness,
  type P1ReleaseReadinessOptions,
  type P1ReleaseReadinessResult,
} from './p1ReleaseReadiness'

type P2ExpansionReadinessStatus =
  | 'EXPANSION_READY'
  | 'READY_TO_FINALIZE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'BLOCKED'

type P2ExpansionNextAction =
  | 'fix-blockers'
  | 'fill-human-review'
  | 'finalize-review'
  | 'already-reviewed'
  | 'published'

export interface P2ExpansionReadinessOptions {
  currentDistrictId?: string | null
  expansionDistrictIds?: string[] | null
  root?: string | null
  dryRunRoot?: string | null
  registryPath?: string | null
  configGlob?: string | null
  configRoot?: string | null
  reviewRoot?: string | null
  publishGateSummaryPath?: string | null
  skipP1?: boolean | null
  requireReadyToFinalize?: boolean | null
  timeoutMs?: number | null
  outPath?: string | null
  jsonOutPath?: string | null
  summaryPath?: string | null
  json?: boolean | null
}

export interface P2ExpansionReadinessInputs {
  currentDistrictId: string
  expansionDistrictIds: string[]
  root: string
  dryRunRoot: string
  registryPath: string
  configGlob: string
  configRoot: string
  reviewRoot: string
  publishGateSummaryPath: string | null
  skipP1: boolean
  requireReadyToFinalize: boolean
  timeoutMs: number
}

export interface P2ExpansionDistrictReadiness {
  districtId: string
  runtimeStatus: DistrictReadinessEntry['runtimeStatus'] | null
  dataPackStatus: DistrictReadinessEntry['dataPackStatus'] | null
  parkingSpaces: number | null
  inferredCandidates: number | null
  signOverrides: number | null
  reviewStatus: DistrictReadinessEntry['reviewStatus'] | null
  publishGateStatus: DistrictReadinessEntry['publishGateStatus'] | null
  matrixBlockers: string[]
  reviewBundleStatus: HumanReviewBundleEntry['status'] | 'missing'
  handoffRows: number | null
  handoffValidReviewedRows: number | null
  sourceValidReviewedRows: number | null
  automationBlockers: string[]
  nextAction: P2ExpansionNextAction
}

export interface P2ExpansionReadinessResult {
  pass: boolean
  status: P2ExpansionReadinessStatus
  inputs: P2ExpansionReadinessInputs
  p1Release: P1ReleaseReadinessResult | null
  districtMatrix: DistrictReadinessMatrixResult
  reviewIndex: HumanReviewBundleIndexResult
  currentDistrict: DistrictReadinessEntry | null
  expansionDistricts: P2ExpansionDistrictReadiness[]
  blockers: string[]
  warnings: string[]
}

export interface P2ExpansionReadinessRunners {
  runP1ReleaseReadiness: (
    options: P1ReleaseReadinessOptions,
  ) => Promise<P1ReleaseReadinessResult>
  runDistrictReadinessMatrix: (
    options: DistrictReadinessMatrixOptions,
  ) => Promise<DistrictReadinessMatrixResult>
  runHumanReviewBundleIndex: (
    options: HumanReviewBundleIndexOptions,
  ) => Promise<HumanReviewBundleIndexResult>
}

const DEFAULT_CURRENT_DISTRICT = 'xinyi'
const DEFAULT_EXPANSION_DISTRICTS = ['daan', 'zhongshan']
const DEFAULT_ROOT = 'public/data/generated'
const DEFAULT_DRY_RUN_ROOT = 'data/generated'
const DEFAULT_CONFIG_GLOB = 'configs/prod/*.json'
const DEFAULT_CONFIG_ROOT = 'configs/prod'
const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_TIMEOUT_MS = 25_000

const defaultRunners: P2ExpansionReadinessRunners = {
  runP1ReleaseReadiness,
  runDistrictReadinessMatrix,
  runHumanReviewBundleIndex,
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

export const parseP2ExpansionReadinessArgs = (
  argv: string[],
): P2ExpansionReadinessOptions => ({
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
  registryPath: getArgValue(
    argv,
    '--registry',
    '--registry-path',
    '--registryPath',
  ),
  configGlob: getArgValue(argv, '--configs', '--config-glob', '--configGlob'),
  configRoot: getArgValue(argv, '--config-root', '--configRoot'),
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
  requireReadyToFinalize: hasFlag(
    argv,
    '--require-ready-to-finalize',
    '--requireReadyToFinalize',
  ),
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

export const resolveP2ExpansionReadinessInputs = (
  options: P2ExpansionReadinessOptions = {},
): P2ExpansionReadinessInputs => {
  const root = options.root?.trim() || DEFAULT_ROOT
  const dryRunRoot = options.dryRunRoot?.trim() || DEFAULT_DRY_RUN_ROOT
  const configGlob = options.configGlob?.trim() || DEFAULT_CONFIG_GLOB
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
    configGlob,
    configRoot:
      options.configRoot?.trim() ||
      inferConfigRootFromGlob(configGlob) ||
      DEFAULT_CONFIG_ROOT,
    reviewRoot: options.reviewRoot?.trim() || DEFAULT_REVIEW_ROOT,
    publishGateSummaryPath:
      options.publishGateSummaryPath === null
        ? null
        : options.publishGateSummaryPath?.trim() ||
          path.join(dryRunRoot, '_ops', 'publish_gate_summary.json'),
    skipP1: Boolean(options.skipP1),
    requireReadyToFinalize: Boolean(options.requireReadyToFinalize),
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
}

const inferConfigRootFromPattern = (configPattern: string) => {
  const normalized = configPattern.replace(/\\/g, '/').trim()
  if (!normalized) {
    return null
  }
  const globIndex = ['*', '[', ']', '{', '}'].reduce((lowest, marker) => {
    const index = normalized.indexOf(marker)
    return index >= 0 && (lowest < 0 || index < lowest) ? index : lowest
  }, -1)
  const pathPart =
    globIndex >= 0 ? normalized.slice(0, globIndex) : normalized
  const withoutTrailingSlash = pathPart.replace(/\/+$/u, '')
  if (!withoutTrailingSlash) {
    return null
  }
  return normalized.endsWith('.json') && globIndex < 0
    ? path.posix.dirname(withoutTrailingSlash)
    : withoutTrailingSlash
}

export const inferConfigRootFromGlob = (configGlob: string) => {
  const roots = splitConfigGlobPatterns(configGlob)
    .map(inferConfigRootFromPattern)
    .filter((root): root is string => Boolean(root))
  const uniqueRoots = Array.from(new Set(roots))
  return uniqueRoots.length === 1 ? uniqueRoots[0] : null
}

const expectedFailCodes = new Set([
  'SIGN_OVERRIDE_COVERAGE_ZERO',
  'SIGN_OVERRIDE_INPUT_MISSING',
])

const isExpectedPublishFailBlocker = (blocker: string) => {
  if (!blocker.startsWith('publish gate fail:')) {
    return false
  }
  const codes = blocker
    .replace('publish gate fail:', '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
  return codes.length > 0 && codes.every((code) => expectedFailCodes.has(code))
}

const isExpectedExpansionMatrixBlocker = (blocker: string) =>
  blocker === 'runtime stale-public-dir' ||
  blocker === 'runtime not-published' ||
  blocker === 'sign overrides missing or zero' ||
  blocker === 'review blocked' ||
  blocker === 'review missing' ||
  blocker === 'publish gate warn: BASELINE_MISSING' ||
  isExpectedPublishFailBlocker(blocker)

const isPublishedExpansionDistrict = (
  matrixEntry: DistrictReadinessEntry | null,
) =>
  matrixEntry?.runtimeStatus === 'published' &&
  matrixEntry.dataPackStatus === 'available' &&
  matrixEntry.reviewStatus === 'pass' &&
  Boolean(matrixEntry.counts.signOverrides && matrixEntry.counts.signOverrides > 0)

const reviewBundleNextAction = (
  matrixEntry: DistrictReadinessEntry | null,
  reviewBundle: HumanReviewBundleEntry | null,
  automationBlockers: string[],
): P2ExpansionNextAction => {
  if (automationBlockers.length > 0) {
    return 'fix-blockers'
  }
  if (isPublishedExpansionDistrict(matrixEntry)) {
    return 'published'
  }
  if (!reviewBundle) {
    return 'fix-blockers'
  }
  if (reviewBundle.status === 'ready-for-review') {
    return 'fill-human-review'
  }
  if (reviewBundle.status === 'ready-to-finalize') {
    return 'finalize-review'
  }
  if (reviewBundle.status === 'review-complete') {
    return 'already-reviewed'
  }
  return 'fix-blockers'
}

const findEntry = <T extends { districtId: string }>(
  entries: T[],
  districtId: string,
) => entries.find((entry) => entry.districtId === districtId) ?? null

const buildExpansionDistrictReadiness = (
  districtId: string,
  matrixEntry: DistrictReadinessEntry | null,
  reviewBundle: HumanReviewBundleEntry | null,
): P2ExpansionDistrictReadiness => {
  const automationBlockers: string[] = []
  if (!matrixEntry) {
    automationBlockers.push('district missing from readiness matrix')
  } else {
    automationBlockers.push(
      ...matrixEntry.blockers.filter(
        (blocker) => !isExpectedExpansionMatrixBlocker(blocker),
      ),
    )
    if (matrixEntry.dataPackStatus !== 'available') {
      automationBlockers.push('dry-run data pack is not available')
    }
    if (!matrixEntry.counts.parkingSpaces) {
      automationBlockers.push('parking space evidence missing or zero')
    }
    if (!matrixEntry.counts.inferredCandidates) {
      automationBlockers.push('inferred candidates missing or zero')
    }
  }
  if (!reviewBundle) {
    if (!isPublishedExpansionDistrict(matrixEntry)) {
      automationBlockers.push('human review bundle missing')
    }
  } else if (reviewBundle.status === 'incomplete') {
    automationBlockers.push('human review bundle incomplete')
  } else if (!reviewBundle.handoffRows || reviewBundle.handoffRows <= 0) {
    automationBlockers.push('human review handoff has no rows')
  }

  return {
    districtId,
    runtimeStatus: matrixEntry?.runtimeStatus ?? null,
    dataPackStatus: matrixEntry?.dataPackStatus ?? null,
    parkingSpaces: matrixEntry?.counts.parkingSpaces ?? null,
    inferredCandidates: matrixEntry?.counts.inferredCandidates ?? null,
    signOverrides: matrixEntry?.counts.signOverrides ?? null,
    reviewStatus: matrixEntry?.reviewStatus ?? null,
    publishGateStatus: matrixEntry?.publishGateStatus ?? null,
    matrixBlockers: matrixEntry?.blockers ?? [],
    reviewBundleStatus: reviewBundle?.status ?? 'missing',
    handoffRows: reviewBundle?.handoffRows ?? null,
    handoffValidReviewedRows: reviewBundle?.handoffValidReviewedRows ?? null,
    sourceValidReviewedRows: reviewBundle?.validReviewedRows ?? null,
    automationBlockers,
    nextAction: reviewBundleNextAction(
      matrixEntry,
      reviewBundle,
      automationBlockers,
    ),
  }
}

const resolveStatus = (
  blockers: string[],
  expansionDistricts: P2ExpansionDistrictReadiness[],
): P2ExpansionReadinessStatus => {
  if (blockers.length > 0) {
    return 'BLOCKED'
  }
  if (expansionDistricts.some((district) => district.nextAction === 'fill-human-review')) {
    return 'HUMAN_REVIEW_REQUIRED'
  }
  if (expansionDistricts.some((district) => district.nextAction === 'finalize-review')) {
    return 'READY_TO_FINALIZE'
  }
  return 'EXPANSION_READY'
}

export const runP2ExpansionReadiness = async (
  options: P2ExpansionReadinessOptions = {},
  runners: P2ExpansionReadinessRunners = defaultRunners,
): Promise<P2ExpansionReadinessResult> => {
  const inputs = resolveP2ExpansionReadinessInputs(options)
  const p1Release = inputs.skipP1
    ? null
    : await runners.runP1ReleaseReadiness({
        districtId: inputs.currentDistrictId,
        root: inputs.root,
        registryPath: inputs.registryPath,
        configGlob: inputs.configGlob,
        timeoutMs: inputs.timeoutMs,
      })
  const districtMatrix = await runners.runDistrictReadinessMatrix({
    configGlob: inputs.configGlob,
    publicRoot: inputs.root,
    dryRunRoot: inputs.dryRunRoot,
    reviewRoot: inputs.reviewRoot,
    registryPath: inputs.registryPath,
  })
  const reviewIndex = await runners.runHumanReviewBundleIndex({
    reviewRoot: inputs.reviewRoot,
    configRoot: inputs.configRoot,
    districtIds: inputs.expansionDistrictIds,
    publishGateSummaryPath: inputs.publishGateSummaryPath,
  })
  const currentDistrict = findEntry(
    districtMatrix.entries,
    inputs.currentDistrictId,
  )
  const expansionDistricts = inputs.expansionDistrictIds.map((districtId) =>
    buildExpansionDistrictReadiness(
      districtId,
      findEntry(districtMatrix.entries, districtId),
      findEntry(reviewIndex.entries, districtId),
    ),
  )
  const blockers: string[] = []
  const warnings = [...reviewIndex.warnings]
  if (p1Release && !p1Release.pass) {
    blockers.push('P1 release readiness is blocked')
  }
  if (!inputs.skipP1) {
    if (!currentDistrict) {
      blockers.push(`current district ${inputs.currentDistrictId} missing from matrix`)
    } else if (currentDistrict.blockers.length > 0) {
      blockers.push(
        `current district ${inputs.currentDistrictId} has blockers: ${currentDistrict.blockers.join('; ')}`,
      )
    }
  }
  reviewIndex.errors.forEach((error) => blockers.push(error))
  expansionDistricts.forEach((district) => {
    district.automationBlockers.forEach((blocker) => {
      blockers.push(`${district.districtId}: ${blocker}`)
    })
  })
  if (inputs.requireReadyToFinalize) {
    const pendingReviewDistricts = expansionDistricts
      .filter((district) => district.nextAction === 'fill-human-review')
      .map((district) => district.districtId)
    if (pendingReviewDistricts.length > 0) {
      blockers.push(
        `expansion districts not ready to finalize: ${pendingReviewDistricts.join(', ')}`,
      )
    }
  }
  const status = resolveStatus(blockers, expansionDistricts)

  return {
    pass: blockers.length === 0,
    status,
    inputs,
    p1Release,
    districtMatrix,
    reviewIndex,
    currentDistrict,
    expansionDistricts,
    blockers,
    warnings,
  }
}

const formatCount = (value: number | null) => (value === null ? '-' : String(value))

const formatP1 = (result: P1ReleaseReadinessResult | null) =>
  result ? (result.pass ? 'pass' : 'blocked') : 'skipped'

const nextActionText = (district: P2ExpansionDistrictReadiness) => {
  switch (district.nextAction) {
    case 'fill-human-review':
      return 'fill reviewStatus/reviewNote/createdAt in the handoff CSV'
    case 'finalize-review':
      return 'run p0-finalize-review for this district'
    case 'already-reviewed':
      return 'source review already satisfies P0 review coverage'
    case 'published':
      return 'published'
    case 'fix-blockers':
      return 'fix listed automation blockers'
  }
}

export const renderP2ExpansionReadiness = (
  result: P2ExpansionReadinessResult,
) => {
  const pendingHumanReviewDistricts = result.expansionDistricts.filter(
    (district) => district.nextAction === 'fill-human-review',
  )
  const lines = [
    `# P2 Expansion Readiness: ${result.status}`,
    '',
    '## Inputs',
    '',
    `- Current district: ${result.inputs.currentDistrictId}`,
    `- Expansion districts: ${result.inputs.expansionDistrictIds.join(', ')}`,
    `- Public root: ${result.inputs.root}`,
    `- Dry-run root: ${result.inputs.dryRunRoot}`,
    `- Config root: ${result.inputs.configRoot}`,
    `- Review root: ${result.inputs.reviewRoot}`,
    `- P1 release: ${formatP1(result.p1Release)}`,
    `- Require ready to finalize: ${result.inputs.requireReadyToFinalize ? 'yes' : 'no'}`,
    '',
    '## Expansion Districts',
    '',
    '| District | Runtime | Data | Parking | Inferred | Overrides | Review | Handoff | Next action | Automation blockers |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |',
  ]

  result.expansionDistricts.forEach((district) => {
    lines.push(
      [
        `| ${district.districtId}`,
        district.runtimeStatus ?? '-',
        district.dataPackStatus ?? '-',
        formatCount(district.parkingSpaces),
        formatCount(district.inferredCandidates),
        formatCount(district.signOverrides),
        district.reviewStatus ?? '-',
        `${district.reviewBundleStatus} (${formatCount(district.handoffValidReviewedRows)}/${formatCount(district.handoffRows)} valid)`,
        nextActionText(district),
        `${district.automationBlockers.join('; ') || 'none'} |`,
      ].join(' | '),
    )
  })

  if (pendingHumanReviewDistricts.length > 0) {
    lines.push('', '## Human Review Required', '')
    pendingHumanReviewDistricts.forEach((district) => {
      const handoffPath = path.join(
        result.inputs.reviewRoot,
        `${district.districtId}-human-review`,
        `${district.districtId}-next-review.csv`,
      )
      lines.push(
        `- ${district.districtId}: fill reviewStatus/reviewNote/createdAt in ${handoffPath}`,
      )
    })
  }
  lines.push('', '## Automation Blockers', '')
  lines.push(
    ...(result.blockers.length === 0
      ? ['- none']
      : result.blockers.map((blocker) => `- ${blocker}`)),
  )
  lines.push('', '## Warnings', '')
  lines.push(
    ...(result.warnings.length === 0
      ? ['- none']
      : result.warnings.map((warning) => `- ${warning}`)),
  )
  lines.push('', '## Recommended Next Commands', '')
  result.expansionDistricts.forEach((district) => {
    if (district.nextAction === 'fill-human-review') {
      lines.push(
        `- ${district.districtId}: review ${path.join(result.inputs.reviewRoot, `${district.districtId}-human-review`, `${district.districtId}-next-review.csv`)}`,
      )
    }
    if (district.nextAction === 'finalize-review') {
      const entry = findEntry(result.reviewIndex.entries, district.districtId)
      lines.push(`- ${district.districtId}: ${entry?.finalizeCommand ?? 'run p0-finalize-review'}`)
    }
  })
  if (
    !result.expansionDistricts.some((district) =>
      ['fill-human-review', 'finalize-review'].includes(district.nextAction),
    )
  ) {
    lines.push('- none')
  }

  return lines.join('\n')
}

export const resolveP2ExpansionReadinessSummaryPath = (
  options: Pick<P2ExpansionReadinessOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseP2ExpansionReadinessArgs(process.argv)
  const result = await runP2ExpansionReadiness(options)
  const markdown = renderP2ExpansionReadiness(result)
  const output = options.json
    ? JSON.stringify(result, null, 2)
    : markdown
  console.log(output)
  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(
      path.resolve(options.jsonOutPath),
      `${JSON.stringify(result, null, 2)}\n`,
    )
  }
  const summaryPath = resolveP2ExpansionReadinessSummaryPath(options)
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
