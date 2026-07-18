import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizeRenderAppUrl,
  verifyRenderDeployment,
  type RenderDeploymentVerifyOptions,
  type RenderDeploymentVerifyResult,
} from './renderDeploymentVerify'

const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_INTERVAL_MS = 15 * 1000
const DEFAULT_REQUEST_TIMEOUT_MS = 30 * 1000
const DEFAULT_OUT_PATH = '.tmp/render-release-wait.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/render-release-wait.json'

export interface WaitForRenderReleaseOptions {
  appUrl: string
  handoffJsonPath: string
  timeoutMs: number
  intervalMs: number
  requestTimeoutMs: number
  outPath: string | null
  jsonOutPath: string | null
}

export interface WaitForRenderReleaseResult {
  pass: boolean
  appUrl: string
  handoffJsonPath: string
  attempts: number
  elapsedMs: number
  timeoutMs: number
  intervalMs: number
  lastVerify: RenderDeploymentVerifyResult | null
  errors: string[]
}

type VerifyRenderDeployment = (
  options: RenderDeploymentVerifyOptions,
) => Promise<RenderDeploymentVerifyResult>

export interface WaitForRenderReleaseDependencies {
  verify?: VerifyRenderDeployment
  now?: () => number
  sleep?: (ms: number) => Promise<void>
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

const parsePositiveInteger = (
  value: string | null,
  fallback: number,
  label: string,
) => {
  if (value === null) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

export const parseWaitForRenderReleaseArgs = (
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): WaitForRenderReleaseOptions => ({
  appUrl: normalizeRenderAppUrl(
    getArgValue(argv, '--app-url', '--appUrl') ??
      env.PARKKING_RENDER_APP_URL,
  ),
  handoffJsonPath:
    getArgValue(argv, '--handoff-json', '--handoffJson') ??
    DEFAULT_HANDOFF_JSON,
  timeoutMs: parsePositiveInteger(
    getArgValue(argv, '--timeout-ms', '--timeoutMs'),
    DEFAULT_TIMEOUT_MS,
    'timeout-ms',
  ),
  intervalMs: parsePositiveInteger(
    getArgValue(argv, '--interval-ms', '--intervalMs'),
    DEFAULT_INTERVAL_MS,
    'interval-ms',
  ),
  requestTimeoutMs: parsePositiveInteger(
    getArgValue(argv, '--request-timeout-ms', '--requestTimeoutMs'),
    DEFAULT_REQUEST_TIMEOUT_MS,
    'request-timeout-ms',
  ),
  outPath: getArgValue(argv, '--out') ?? DEFAULT_OUT_PATH,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_OUT_PATH,
})

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export const waitForRenderRelease = async (
  options: WaitForRenderReleaseOptions,
  dependencies: WaitForRenderReleaseDependencies = {},
): Promise<WaitForRenderReleaseResult> => {
  const verify = dependencies.verify ?? verifyRenderDeployment
  const now = dependencies.now ?? Date.now
  const sleep = dependencies.sleep ?? defaultSleep
  const startedAt = now()
  const deadline = startedAt + options.timeoutMs
  let attempts = 0
  let lastVerify: RenderDeploymentVerifyResult | null = null
  let lastError: string | null = null

  while (attempts === 0 || now() < deadline) {
    attempts += 1
    try {
      lastVerify = await verify({
        appUrl: options.appUrl,
        handoffJsonPath: options.handoffJsonPath,
        timeoutMs: options.requestTimeoutMs,
        skipApiServices: true,
        skipParkingAnswerCases: true,
      })
      lastError = null
      if (lastVerify.pass) {
        return {
          pass: true,
          appUrl: options.appUrl,
          handoffJsonPath: options.handoffJsonPath,
          attempts,
          elapsedMs: Math.max(0, now() - startedAt),
          timeoutMs: options.timeoutMs,
          intervalMs: options.intervalMs,
          lastVerify,
          errors: [],
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    const remainingMs = deadline - now()
    if (remainingMs <= 0) {
      break
    }
    await sleep(Math.min(options.intervalMs, remainingMs))
  }

  const lastVerifyErrors = lastVerify?.errors ?? []
  return {
    pass: false,
    appUrl: options.appUrl,
    handoffJsonPath: options.handoffJsonPath,
    attempts,
    elapsedMs: Math.max(0, now() - startedAt),
    timeoutMs: options.timeoutMs,
    intervalMs: options.intervalMs,
    lastVerify,
    errors: [
      `Timed out waiting for Render to serve the release contract after ${options.timeoutMs}ms.`,
      ...(lastError ? [lastError] : lastVerifyErrors),
    ],
  }
}

const shortHash = (value: string | null) => value?.slice(0, 12) ?? '-'

export const renderWaitForRenderRelease = (
  result: WaitForRenderReleaseResult,
) => {
  const districts = result.lastVerify?.districts ?? []
  return [
    `# Render Release Wait: ${result.pass ? 'PASS' : 'TIMEOUT'}`,
    '',
    `- App URL: ${result.appUrl}`,
    `- Handoff JSON: ${result.handoffJsonPath}`,
    `- Attempts: ${result.attempts}`,
    `- Elapsed: ${result.elapsedMs}ms`,
    `- Timeout: ${result.timeoutMs}ms`,
    `- Poll interval: ${result.intervalMs}ms`,
    `- Release ID: ${result.lastVerify?.releaseId ?? '-'}`,
    '',
    '| Status | District | Expected hash | Actual hash | Expected published | Actual published | Ready | Error |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...districts.map(
      (district) =>
        `| ${district.pass ? 'PASS' : 'WAIT'} | ${district.districtId} | ${shortHash(district.expectedDatasetHash)} | ${shortHash(district.actualDatasetHash)} | ${district.expectedPublishedAt} | ${district.actualPublishedAt ?? '-'} | ${String(district.ready)} | ${district.errors.join('; ')} |`,
    ),
    '',
    '## Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
    '',
  ].join('\n')
}

export const writeWaitForRenderReleaseOutputs = async (
  result: WaitForRenderReleaseResult,
  options: Pick<WaitForRenderReleaseOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, renderWaitForRenderRelease(result), 'utf-8')
  }
  if (options.jsonOutPath) {
    const resolved = path.resolve(options.jsonOutPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  }
}

const run = async () => {
  const argv = process.argv.slice(2)
  if (argv.includes('--help')) {
    console.log(
      [
        'Usage: tsx scripts/ops/waitForRenderRelease.ts --app-url <url> [options]',
        '',
        'Options:',
        '  --handoff-json <path>       Release handoff contract',
        '  --timeout-ms <ms>           Total wait; defaults to 900000',
        '  --interval-ms <ms>          Poll interval; defaults to 15000',
        '  --request-timeout-ms <ms>   Per-request timeout; defaults to 30000',
        '  --out <path>                Markdown report path',
        '  --json-out <path>           JSON report path',
      ].join('\n'),
    )
    return
  }

  const options = parseWaitForRenderReleaseArgs(argv)
  const result = await waitForRenderRelease(options)
  await writeWaitForRenderReleaseOutputs(result, options)
  console.log(renderWaitForRenderRelease(result))
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
