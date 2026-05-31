import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runWithLog } from './runWithLog'

const DEFAULT_LOG_DIR = '.tmp/release-handoff-readiness/logs'
const DEFAULT_OUT_PATH = '.tmp/release-handoff-readiness.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/release-handoff-readiness.json'
const DEFAULT_P3_OUT_PATH = '.tmp/p3-release-readiness.md'
const DEFAULT_P3_JSON_PATH = '.tmp/p3-release-readiness.json'
const DEFAULT_DEPLOY_OUT_PATH = '.tmp/deploy-readiness.md'
const DEFAULT_DEPLOY_JSON_PATH = '.tmp/deploy-readiness.json'
const DEFAULT_HANDOFF_OUT_PATH = '.tmp/render-deployment-handoff.md'
const DEFAULT_HANDOFF_JSON_PATH = '.tmp/render-deployment-handoff.json'

export interface ReleaseHandoffReadinessOptions {
  skipBuild?: boolean | null
  dryRun?: boolean | null
  logDir?: string | null
  outPath?: string | null
  jsonOutPath?: string | null
  p3OutPath?: string | null
  p3JsonPath?: string | null
  deployOutPath?: string | null
  deployJsonPath?: string | null
  handoffOutPath?: string | null
  handoffJsonPath?: string | null
}

export interface ReleaseHandoffReadinessInputs {
  skipBuild: boolean
  dryRun: boolean
  logDir: string
  p3OutPath: string
  p3JsonPath: string
  deployOutPath: string
  deployJsonPath: string
  handoffOutPath: string
  handoffJsonPath: string
}

export interface ReleaseHandoffReadinessStep {
  id: string
  label: string
  command: string
  args: string[]
  logPath: string
}

export interface ReleaseHandoffReadinessStepResult
  extends ReleaseHandoffReadinessStep {
  exitCode: number | null
  skipped: boolean
}

export interface ReleaseHandoffReadinessGateSummary {
  p3Pass: boolean | null
  deployPass: boolean | null
  handoffReady: boolean | null
  p3ReleaseId: string | null
  deployReleaseId: string | null
  handoffReleaseId: string | null
}

export interface ReleaseHandoffReadinessResult {
  pass: boolean
  dryRun: boolean
  inputs: ReleaseHandoffReadinessInputs
  steps: ReleaseHandoffReadinessStepResult[]
  gates: ReleaseHandoffReadinessGateSummary
  blockers: string[]
}

export interface ReleaseHandoffReadinessRunner {
  (step: ReleaseHandoffReadinessStep): Promise<number>
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

export const parseReleaseHandoffReadinessArgs = (
  argv: string[],
): ReleaseHandoffReadinessOptions => ({
  skipBuild: hasFlag(argv, '--skip-build', '--skipBuild'),
  dryRun: hasFlag(argv, '--dry-run', '--dryRun'),
  logDir: getArgValue(argv, '--log-dir', '--logDir') ?? DEFAULT_LOG_DIR,
  outPath: getArgValue(argv, '--out') ?? DEFAULT_OUT_PATH,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_OUT_PATH,
  p3OutPath: getArgValue(argv, '--p3-out', '--p3Out') ?? DEFAULT_P3_OUT_PATH,
  p3JsonPath:
    getArgValue(argv, '--p3-json', '--p3Json') ?? DEFAULT_P3_JSON_PATH,
  deployOutPath:
    getArgValue(argv, '--deploy-out', '--deployOut') ?? DEFAULT_DEPLOY_OUT_PATH,
  deployJsonPath:
    getArgValue(argv, '--deploy-json', '--deployJson') ??
    DEFAULT_DEPLOY_JSON_PATH,
  handoffOutPath:
    getArgValue(argv, '--handoff-out', '--handoffOut') ??
    DEFAULT_HANDOFF_OUT_PATH,
  handoffJsonPath:
    getArgValue(argv, '--handoff-json', '--handoffJson') ??
    DEFAULT_HANDOFF_JSON_PATH,
})

export const resolveReleaseHandoffReadinessInputs = (
  options: ReleaseHandoffReadinessOptions = {},
): ReleaseHandoffReadinessInputs => ({
  skipBuild: Boolean(options.skipBuild),
  dryRun: Boolean(options.dryRun),
  logDir: path.resolve(options.logDir ?? DEFAULT_LOG_DIR),
  p3OutPath: options.p3OutPath ?? DEFAULT_P3_OUT_PATH,
  p3JsonPath: options.p3JsonPath ?? DEFAULT_P3_JSON_PATH,
  deployOutPath: options.deployOutPath ?? DEFAULT_DEPLOY_OUT_PATH,
  deployJsonPath: options.deployJsonPath ?? DEFAULT_DEPLOY_JSON_PATH,
  handoffOutPath: options.handoffOutPath ?? DEFAULT_HANDOFF_OUT_PATH,
  handoffJsonPath: options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON_PATH,
})

const logPathForStep = (inputs: ReleaseHandoffReadinessInputs, id: string) =>
  path.join(inputs.logDir, `${id}.log`)

export const buildReleaseHandoffReadinessSteps = (
  inputs: ReleaseHandoffReadinessInputs,
): ReleaseHandoffReadinessStep[] => {
  const steps: ReleaseHandoffReadinessStep[] = []

  if (!inputs.skipBuild) {
    steps.push({
      id: 'build',
      label: 'Build production app',
      command: 'npm',
      args: ['run', 'build'],
      logPath: logPathForStep(inputs, 'build'),
    })
  }

  steps.push(
    {
      id: 'p3-release-readiness',
      label: 'P3 release readiness',
      command: 'npm',
      args: [
        'exec',
        '--',
        'tsx',
        'scripts/ops/p3ReleaseReadiness.ts',
        '--',
        '--out',
        inputs.p3OutPath,
        '--json-out',
        inputs.p3JsonPath,
      ],
      logPath: logPathForStep(inputs, 'p3-release-readiness'),
    },
    {
      id: 'deploy-readiness',
      label: 'Deploy readiness',
      command: 'npm',
      args: [
        'exec',
        '--',
        'tsx',
        'scripts/ops/deployReadiness.ts',
        '--',
        '--out',
        inputs.deployOutPath,
        '--json-out',
        inputs.deployJsonPath,
      ],
      logPath: logPathForStep(inputs, 'deploy-readiness'),
    },
    {
      id: 'render-deployment-handoff',
      label: 'Render deployment handoff',
      command: 'npm',
      args: [
        'exec',
        '--',
        'tsx',
        'scripts/ops/renderDeploymentHandoff.ts',
        '--',
        '--p3-json',
        inputs.p3JsonPath,
        '--deploy-json',
        inputs.deployJsonPath,
        '--out',
        inputs.handoffOutPath,
        '--json-out',
        inputs.handoffJsonPath,
      ],
      logPath: logPathForStep(inputs, 'render-deployment-handoff'),
    },
  )

  return steps
}

const readJsonFile = async <T>(filePath: string) =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const getRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const getBoolean = (value: unknown) => (typeof value === 'boolean' ? value : null)

const getString = (value: unknown) => (typeof value === 'string' ? value : null)

const readGateSummary = async (
  inputs: ReleaseHandoffReadinessInputs,
): Promise<ReleaseHandoffReadinessGateSummary> => {
  const [p3, deploy, handoff] = await Promise.all([
    readJsonFile<unknown>(inputs.p3JsonPath),
    readJsonFile<unknown>(inputs.deployJsonPath),
    readJsonFile<unknown>(inputs.handoffJsonPath),
  ])

  const p3Record = getRecord(p3)
  const releasePackage = getRecord(p3Record?.releasePackage)
  const releasePackageSummary = getRecord(releasePackage?.summary)
  const deployRecord = getRecord(deploy)
  const deployRelease = getRecord(deployRecord?.release)
  const handoffRecord = getRecord(handoff)
  const handoffRelease = getRecord(handoffRecord?.release)

  return {
    p3Pass: getBoolean(p3Record?.pass),
    deployPass: getBoolean(deployRecord?.pass),
    handoffReady: getBoolean(handoffRecord?.ready),
    p3ReleaseId: getString(releasePackageSummary?.releaseId),
    deployReleaseId: getString(deployRelease?.releaseId),
    handoffReleaseId: getString(handoffRelease?.releaseId),
  }
}

const releaseIds = (gates: ReleaseHandoffReadinessGateSummary) =>
  [
    gates.p3ReleaseId,
    gates.deployReleaseId,
    gates.handoffReleaseId,
  ].filter((releaseId): releaseId is string => releaseId !== null)

const buildGateBlockers = (gates: ReleaseHandoffReadinessGateSummary) => {
  const blockers: string[] = []
  if (gates.p3Pass !== true) {
    blockers.push('P3 release readiness did not pass')
  }
  if (gates.deployPass !== true) {
    blockers.push('Deploy readiness did not pass')
  }
  if (gates.handoffReady !== true) {
    blockers.push('Render deployment handoff is not ready')
  }
  if (!gates.p3ReleaseId || !gates.deployReleaseId || !gates.handoffReleaseId) {
    blockers.push('Could not resolve all gate release IDs')
  }
  const uniqueReleaseIds = [...new Set(releaseIds(gates))]
  if (uniqueReleaseIds.length > 1) {
    blockers.push(
      `Gate release IDs do not match: ${uniqueReleaseIds.join(', ')}`,
    )
  }
  return blockers
}

const defaultRunner: ReleaseHandoffReadinessRunner = async (step) =>
  await runWithLog({
    logPath: step.logPath,
    command: step.command,
    args: step.args,
  })

export const runReleaseHandoffReadiness = async (
  options: ReleaseHandoffReadinessOptions = {},
  runner: ReleaseHandoffReadinessRunner = defaultRunner,
): Promise<ReleaseHandoffReadinessResult> => {
  const inputs = resolveReleaseHandoffReadinessInputs(options)
  const steps = buildReleaseHandoffReadinessSteps(inputs)
  const stepResults: ReleaseHandoffReadinessStepResult[] = []
  const blockers: string[] = []

  for (const step of steps) {
    if (inputs.dryRun) {
      stepResults.push({ ...step, exitCode: null, skipped: true })
      continue
    }

    const exitCode = await runner(step)
    stepResults.push({ ...step, exitCode, skipped: false })
    if (exitCode !== 0) {
      blockers.push(`${step.label} failed with exit code ${exitCode}`)
      break
    }
  }

  let gates: ReleaseHandoffReadinessGateSummary = {
    p3Pass: null,
    deployPass: null,
    handoffReady: null,
    p3ReleaseId: null,
    deployReleaseId: null,
    handoffReleaseId: null,
  }

  if (!inputs.dryRun && blockers.length === 0) {
    try {
      gates = await readGateSummary(inputs)
      blockers.push(...buildGateBlockers(gates))
    } catch (error) {
      blockers.push(
        `Could not read release handoff gate outputs: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return {
    pass: blockers.length === 0,
    dryRun: inputs.dryRun,
    inputs,
    steps: stepResults,
    gates,
    blockers,
  }
}

const statusForStep = (step: ReleaseHandoffReadinessStepResult) =>
  step.skipped ? 'SKIP' : step.exitCode === 0 ? 'PASS' : 'FAIL'

const releaseIdLine = (label: string, value: string | null) =>
  `- ${label}: ${value ?? '-'}`

export const renderReleaseHandoffReadiness = (
  result: ReleaseHandoffReadinessResult,
) =>
  [
    `# Release Handoff Readiness: ${
      result.dryRun ? 'DRY RUN' : result.pass ? 'PASS' : 'FAIL'
    }`,
    '',
    '## Steps',
    '',
    '| Status | Step | Command | Log |',
    '| --- | --- | --- | --- |',
    ...result.steps.map(
      (step) =>
        `| ${statusForStep(step)} | ${step.label} | ${[
          step.command,
          ...step.args,
        ].join(' ')} | ${step.logPath} |`,
    ),
    '',
    '## Gate Release IDs',
    '',
    releaseIdLine('P3 release readiness', result.gates.p3ReleaseId),
    releaseIdLine('Deploy readiness', result.gates.deployReleaseId),
    releaseIdLine('Render handoff', result.gates.handoffReleaseId),
    '',
    '## Gate Status',
    '',
    `- P3 release readiness: ${String(result.gates.p3Pass)}`,
    `- Deploy readiness: ${String(result.gates.deployPass)}`,
    `- Render handoff ready: ${String(result.gates.handoffReady)}`,
    '',
    '## Blockers',
    '',
    ...(result.blockers.length > 0
      ? result.blockers.map((blocker) => `- ${blocker}`)
      : ['- none']),
  ].join('\n')

export const writeReleaseHandoffReadinessOutputs = async (
  result: ReleaseHandoffReadinessResult,
  options: Pick<ReleaseHandoffReadinessOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(
      resolved,
      `${renderReleaseHandoffReadiness(result)}\n`,
      'utf-8',
    )
  }
  if (options.jsonOutPath) {
    const resolved = path.resolve(options.jsonOutPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  }
}

const run = async () => {
  const options = parseReleaseHandoffReadinessArgs(process.argv)
  const result = await runReleaseHandoffReadiness(options)
  await writeReleaseHandoffReadinessOutputs(result, options)
  console.log(renderReleaseHandoffReadiness(result))
  if (!result.pass && !result.dryRun) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
