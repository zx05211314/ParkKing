import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { createServer } from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  ParkingAnswer,
  ParkingAnswerEvidenceKind,
} from '../../src/domain/answers/parkingAnswer'
import {
  loadSmokeExactParkingAnswerCases,
  type SmokeExactParkingAnswerCase,
} from './smokeExactParkingAnswers'
import { resolveReviewedCaseHashMismatchAllowance } from './reviewedCaseHashMismatch'

export interface SmokeUiParkingAnswersOptions {
  appUrl?: string
  casesPath?: string
  district?: string
  view?: SmokeUiParkingAnswerView
  chromePath?: string
  cdpPort?: number
  timeoutMs?: number
  suiteTimeoutMs?: number
  limit?: number
  filter?: string | null
  startPreview?: boolean
  previewPort?: number
  datasetMetaUrl?: string | null
  allowUnpinnedCases?: boolean
  allowMismatchedCaseHash?: boolean
}

export interface SmokeUiParkingAnswerCaseExpectation {
  id: string
  label: string | null
  url: string
  view: SmokeUiParkingAnswerView
  expectedKind: ParkingAnswer['kind']
  expectedEvidenceKind: ParkingAnswerEvidenceKind | null
  requiredText: string[]
}

export interface SmokeUiParkingAnswerCaseResult
  extends SmokeUiParkingAnswerCaseExpectation {
  pass: boolean
  missingText: string[]
  loadingIndicators?: SmokeUiLoadingIndicator[]
  attemptCount?: number
}

export interface SmokeUiParkingAnswersSummary {
  appUrl: string
  casesPath: string
  district: string
  view: SmokeUiParkingAnswerView
  caseDatasetHash: string | null
  runtimeDatasetHash: string | null
  caseCount: number
  passCount: number
  results: SmokeUiParkingAnswerCaseResult[]
}

export type SmokeUiParkingAnswerView = 'LIST' | 'MAP'
export type SmokeUiLoadingIndicator =
  | 'parking data loading'
  | 'map loading'
  | 'map failed'

export interface WebSocketLike {
  send(data: string): void
  close(): void
  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: { data?: unknown }) => void,
    options?: { once?: boolean },
  ): void
}

export interface CdpClient {
  send<T>(method: string, params?: Record<string, unknown>): Promise<T>
  close(): void
}

interface CdpResponse {
  id?: number
  result?: unknown
  error?: {
    message?: string
  }
}

export interface RuntimeEvaluateResult {
  result?: {
    value?: unknown
  }
}

export interface LaunchedChrome {
  chrome: ChildProcess
  profileDir: string
}

export interface LaunchedPreview {
  preview: ChildProcess
  appUrl: string
}

const DEFAULT_APP_URL = 'http://127.0.0.1:4173'
const DEFAULT_CASES_PATH = 'configs/prod/xinyi.answer-cases.json'
const DEFAULT_DISTRICT = 'xinyi'
const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_CDP_TIMEOUT_MS = 10_000
const DEFAULT_FILTER = '__ui_smoke_no_match__'
const DEFAULT_VIEW = 'LIST' as const satisfies SmokeUiParkingAnswerView
const DEFAULT_PROFILE_CLEANUP_ATTEMPTS = 10
const DEFAULT_PROFILE_CLEANUP_INITIAL_DELAY_MS = 250
const MAP_MOUNT_MARKER = 'Click map to check parking here'
const PROFILE_CLEANUP_RETRYABLE_ERROR_CODES = new Set([
  'EBUSY',
  'ENOTEMPTY',
  'EPERM',
])

export interface SmokeProfileCleanupOptions {
  attempts?: number
  initialDelayMs?: number
  rm?: (
    profileDir: string,
    options: { recursive: true; force: true },
  ) => Promise<void>
  waitMs?: (ms: number) => Promise<void>
}

const ANSWER_TITLES = {
  PARK: 'Park allowed at nearest mapped curb',
  TEMP_STOP: 'No parking now; temporary stop only',
  NO_STOP: 'Do not stop or park here',
  NO_DATA: 'No mapped curb answer',
} as const satisfies Record<ParkingAnswer['kind'], string>

const ANSWER_DECISIONS = {
  PARK: 'Use this curb only if posted signs still match the mapped rule.',
  TEMP_STOP: 'Do not park here now. Treat this as temporary stopping only.',
  NO_STOP: 'Avoid stopping or parking at this pinned curb.',
  NO_DATA: 'Pick a nearby curb segment or widen the search radius.',
} as const satisfies Record<ParkingAnswer['kind'], string>

const EVIDENCE_LABELS = {
  MARKED_SPACE: 'Mapped marked spaces',
  CURB_RULE: 'Mapped curb rule',
  INFERRED: 'Inferred curb',
  NO_DATA: 'No mapped evidence',
} as const satisfies Record<ParkingAnswerEvidenceKind, string>

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

const parsePositiveIntegerArg = (argv: string[], ...flags: string[]) => {
  const value = getArgValue(argv, ...flags)
  if (value === null) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flags[0]} must be a positive integer`)
  }
  return parsed
}

const parseSmokeUiParkingAnswerViewArg = (
  argv: string[],
): SmokeUiParkingAnswerView | undefined => {
  const value = getArgValue(argv, '--view')
  if (value === null) {
    return undefined
  }
  const normalized = value.trim().toUpperCase()
  if (normalized !== 'LIST' && normalized !== 'MAP') {
    throw new Error('--view must be LIST or MAP')
  }
  return normalized
}

export const parseSmokeUiParkingAnswersArgs = (
  argv: string[],
): SmokeUiParkingAnswersOptions => ({
  appUrl: getArgValue(argv, '--app-url', '--appUrl') ?? DEFAULT_APP_URL,
  casesPath:
    getArgValue(argv, '--cases', '--casesPath', '--cases-path') ??
    DEFAULT_CASES_PATH,
  district: getArgValue(argv, '--district') ?? undefined,
  view: parseSmokeUiParkingAnswerViewArg(argv),
  chromePath:
    getArgValue(argv, '--chrome-path', '--chromePath') ??
    process.env.CHROME_PATH ??
    undefined,
  cdpPort: parsePositiveIntegerArg(argv, '--cdp-port', '--cdpPort', '--port'),
  timeoutMs:
    parsePositiveIntegerArg(argv, '--timeout-ms', '--timeoutMs') ??
    DEFAULT_TIMEOUT_MS,
  suiteTimeoutMs: parsePositiveIntegerArg(
    argv,
    '--suite-timeout-ms',
    '--suiteTimeoutMs',
  ),
  limit: parsePositiveIntegerArg(argv, '--limit'),
  filter: hasFlag(argv, '--no-filter')
    ? null
    : getArgValue(argv, '--filter') ?? DEFAULT_FILTER,
  startPreview: hasFlag(argv, '--start-preview'),
  previewPort: parsePositiveIntegerArg(
    argv,
    '--preview-port',
    '--previewPort',
  ),
  datasetMetaUrl: hasFlag(argv, '--no-dataset-hash-check')
    ? null
    : getArgValue(argv, '--dataset-meta-url', '--datasetMetaUrl') ?? undefined,
  allowUnpinnedCases: hasFlag(
    argv,
    '--allow-unpinned-cases',
    '--allowUnpinnedCases',
  ),
  allowMismatchedCaseHash: hasFlag(
    argv,
    '--allow-mismatched-case-hash',
    '--allowMismatchedCaseHash',
  )
    ? true
    : undefined,
})

const toUiTimePreset = (hhmm: string | undefined) => {
  const value = hhmm ?? '21:00'
  if (value === '21:00') {
    return 'NIGHT'
  }
  if (value === '13:00') {
    return 'NOW'
  }
  throw new Error(
    `UI smoke only supports share-link time presets for 13:00 and 21:00; got ${value}`,
  )
}

export const buildSmokeUiParkingAnswerCaseUrl = (params: {
  appUrl: string
  district: string
  answerCase: SmokeExactParkingAnswerCase
  view?: SmokeUiParkingAnswerView
  filter?: string | null
}) => {
  const url = new URL(params.appUrl)
  url.searchParams.set('dataset', params.district)
  url.searchParams.set('address', params.answerCase.label ?? params.answerCase.id)
  url.searchParams.set('lat', String(params.answerCase.lat))
  url.searchParams.set('lng', String(params.answerCase.lng))
  url.searchParams.set('time', toUiTimePreset(params.answerCase.hhmm))
  url.searchParams.set('view', params.view ?? DEFAULT_VIEW)
  if (params.answerCase.searchRadiusMeters !== undefined) {
    url.searchParams.set('radius', String(params.answerCase.searchRadiusMeters))
  }
  if (params.answerCase.includeInferred !== undefined) {
    url.searchParams.set('inferred', params.answerCase.includeInferred ? '1' : '0')
  }
  if (params.filter) {
    url.searchParams.set('filter', params.filter)
  }
  return url.toString()
}

export const buildSmokeUiDatasetMetaUrl = (params: {
  appUrl: string
  district: string
}) => new URL(`/data/generated/${params.district}/dataset_meta.json`, params.appUrl).toString()

const getStringField = (record: unknown, field: string) =>
  record && typeof record === 'object' && typeof (record as Record<string, unknown>)[field] === 'string'
    ? ((record as Record<string, unknown>)[field] as string)
    : null

export const getDatasetHashFromMeta = (meta: unknown) =>
  getStringField(meta, 'datasetHash')

export const validateSmokeUiDatasetHash = (params: {
  caseDatasetHash?: string | null
  runtimeDatasetHash?: string | null
  allowUnpinnedCases?: boolean
  allowMismatchedCaseHash?: boolean
}) => {
  if (!params.caseDatasetHash) {
    return params.allowUnpinnedCases
      ? null
      : 'answer cases file is missing datasetHash'
  }
  if (!params.runtimeDatasetHash) {
    return 'runtime dataset_meta.json is missing datasetHash'
  }
  if (params.caseDatasetHash !== params.runtimeDatasetHash) {
    if (params.allowMismatchedCaseHash) {
      return null
    }
    return `answer cases datasetHash ${params.caseDatasetHash} does not match runtime datasetHash ${params.runtimeDatasetHash}`
  }
  return null
}

export const resolveSmokeUiDatasetHashError = (params: {
  datasetMetaUrl: string | null | undefined
  caseDatasetHash: string | null
  runtimeDatasetHash: string | null
  allowUnpinnedCases?: boolean
  allowMismatchedCaseHash?: boolean
}) =>
  params.datasetMetaUrl === null
    ? null
    : validateSmokeUiDatasetHash({
        caseDatasetHash: params.caseDatasetHash,
        runtimeDatasetHash: params.runtimeDatasetHash,
        allowUnpinnedCases: params.allowUnpinnedCases,
        allowMismatchedCaseHash: params.allowMismatchedCaseHash,
      })

export const buildSmokeUiParkingAnswerExpectations = (params: {
  appUrl: string
  district: string
  answerCase: SmokeExactParkingAnswerCase
  view?: SmokeUiParkingAnswerView
  filter?: string | null
}): SmokeUiParkingAnswerCaseExpectation => {
  const { answerCase } = params
  const view = params.view ?? DEFAULT_VIEW
  const requiredText = [
    'Pinned location answer',
    ANSWER_TITLES[answerCase.expectedKind],
    answerCase.expectedKind.replace('_', ' '),
    `Decision: ${ANSWER_DECISIONS[answerCase.expectedKind]}`,
  ]

  if (answerCase.expectedEvidenceKind) {
    requiredText.push(
      `Evidence type: ${EVIDENCE_LABELS[answerCase.expectedEvidenceKind]}`,
    )
  }
  if (answerCase.expectedFinalConfidence) {
    requiredText.push(`${answerCase.expectedFinalConfidence} confidence`)
  }
  if (params.filter) {
    requiredText.push(
      'Exact curb answer is shown above. Route-ranked parking targets are unavailable with the current filters or route data.',
    )
  }
  if (view === 'MAP') {
    requiredText.push(
      'Mode: Map + list',
      'Green: park ok',
      MAP_MOUNT_MARKER,
    )
  }

  return {
    id: answerCase.id,
    label: answerCase.label ?? null,
    url: buildSmokeUiParkingAnswerCaseUrl({ ...params, view }),
    view,
    expectedKind: answerCase.expectedKind,
    expectedEvidenceKind: answerCase.expectedEvidenceKind ?? null,
    requiredText,
  }
}

export const normalizeText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, ' ').trim()

export const chooseAvailablePort = async (preferredPort: number | undefined) => {
  if (preferredPort) {
    return preferredPort
  }

  return await new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate CDP port')))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve(port)
        }
      })
    })
  })
}

const getChromePathCandidates = (explicitPath: string | undefined) =>
  [
    explicitPath,
    process.env.CHROME_PATH,
    process.env.CHROME_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((candidate): candidate is string => Boolean(candidate))

export const resolveChromePath = async (explicitPath: string | undefined) => {
  for (const candidate of getChromePathCandidates(explicitPath)) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try the next common Chrome location.
    }
  }

  throw new Error(
    'Chrome executable not found. Set CHROME_PATH or pass --chrome-path.',
  )
}

export const wait = async (ms: number) =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const formatTransportError = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message.trim()
    : String(error)

export const assertSmokeUiAppReachable = async (appUrl: string) => {
  let response: Response
  try {
    response = await fetch(appUrl)
  } catch (error) {
    throw new Error(
      `UI app ${appUrl} is not reachable. Start the app or rerun with --start-preview. Cause: ${formatTransportError(error)}`,
    )
  }
  if (!response.ok) {
    throw new Error(
      `UI app ${appUrl} returned HTTP ${response.status}. Start the app or rerun with --start-preview.`,
    )
  }
}

export const waitForCdp = async (port: number, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      const requestTimeoutMs = Math.max(
        1,
        Math.min(DEFAULT_CDP_TIMEOUT_MS, deadline - Date.now()),
      )
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(requestTimeoutMs),
      })
      if (response.ok) {
        return
      }
      lastError = new Error(`CDP returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await wait(150)
  }
  throw new Error(
    `Timed out waiting for Chrome CDP on port ${port}: ${String(lastError)}`,
  )
}

const collectProcessLog = (processToRead: ChildProcess) => {
  const logs: string[] = []
  const addLog = (chunk: Buffer) => {
    const text = chunk.toString('utf-8').trim()
    if (text) {
      logs.push(text)
    }
  }

  processToRead.stdout?.on('data', addLog)
  processToRead.stderr?.on('data', addLog)

  return () => logs.slice(-10).join('\n')
}

const waitForHttp = async (params: {
  url: string
  processToCheck: ChildProcess
  processLog: () => string
  timeoutMs: number
}) => {
  const deadline = Date.now() + params.timeoutMs
  let lastError: unknown = null

  while (Date.now() < deadline) {
    if (params.processToCheck.exitCode !== null) {
      throw new Error(
        [
          `Preview process exited before ${params.url} became reachable`,
          params.processLog(),
        ]
          .filter(Boolean)
          .join('\n'),
      )
    }

    try {
      const response = await fetch(params.url)
      if (response.ok) {
        return
      }
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await wait(150)
  }

  throw new Error(
    [
      `Timed out waiting for preview at ${params.url}: ${String(lastError)}`,
      params.processLog(),
    ]
      .filter(Boolean)
      .join('\n'),
  )
}

const fetchRuntimeDatasetHash = async (datasetMetaUrl: string) => {
  let response: Response
  try {
    response = await fetch(datasetMetaUrl)
  } catch (error) {
    throw new Error(
      `Runtime dataset meta ${datasetMetaUrl} is not reachable. Start the app or rerun with --start-preview. Cause: ${formatTransportError(error)}`,
    )
  }
  if (!response.ok) {
    throw new Error(
      `Failed to load runtime dataset meta ${datasetMetaUrl}: HTTP ${response.status}`,
    )
  }
  return getDatasetHashFromMeta(await response.json())
}

export const launchPreview = async (params: {
  previewPort: number
  timeoutMs: number
}): Promise<LaunchedPreview> => {
  const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')
  await fs.access(viteBin)
  const appUrl = `http://127.0.0.1:${params.previewPort}`
  const preview = spawn(
    process.execPath,
    [
      viteBin,
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(params.previewPort),
      '--strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const processLog = collectProcessLog(preview)
  await waitForHttp({
    url: appUrl,
    processToCheck: preview,
    processLog,
    timeoutMs: params.timeoutMs,
  })
  return { preview, appUrl }
}

export const openCdpTab = async (
  port: number,
  timeoutMs = DEFAULT_CDP_TIMEOUT_MS,
) => {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,
    { method: 'PUT', signal: AbortSignal.timeout(timeoutMs) },
  )
  if (!response.ok) {
    throw new Error(`Failed to create Chrome tab: HTTP ${response.status}`)
  }
  const target = (await response.json()) as { webSocketDebuggerUrl?: string }
  if (!target.webSocketDebuggerUrl) {
    throw new Error('Chrome tab did not return a webSocketDebuggerUrl')
  }
  return target.webSocketDebuggerUrl
}

export const connectCdp = async (
  wsUrl: string,
  timeoutMs = DEFAULT_CDP_TIMEOUT_MS,
): Promise<CdpClient> => {
  const WebSocketConstructor = (
    globalThis as typeof globalThis & {
      WebSocket?: new (url: string) => WebSocketLike
    }
  ).WebSocket
  if (!WebSocketConstructor) {
    throw new Error('Node WebSocket is unavailable; run this script on Node 22+.')
  }

  const ws = new WebSocketConstructor(wsUrl)
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const settle = (callback: () => void) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timeout)
        callback()
      }
      const timeout = setTimeout(
        () =>
          settle(() =>
            reject(
              new Error(
                `Timed out opening Chrome CDP WebSocket after ${timeoutMs}ms`,
              ),
            ),
          ),
        timeoutMs,
      )
      ws.addEventListener('open', () => settle(resolve), { once: true })
      ws.addEventListener(
        'error',
        () =>
          settle(() => reject(new Error('Failed to open Chrome CDP WebSocket'))),
        { once: true },
      )
      ws.addEventListener(
        'close',
        () =>
          settle(() =>
            reject(new Error('Chrome CDP WebSocket closed before opening')),
          ),
        { once: true },
      )
    })
  } catch (error) {
    ws.close()
    throw error
  }

  let nextId = 1
  const pending = new Map<
    number,
    {
      resolve: (result: unknown) => void
      reject: (error: Error) => void
      timeout: ReturnType<typeof setTimeout>
    }
  >()

  const rejectPending = (error: Error) => {
    pending.forEach((callback) => {
      clearTimeout(callback.timeout)
      callback.reject(error)
    })
    pending.clear()
  }

  ws.addEventListener('message', (event) => {
    const payload =
      typeof event.data === 'string'
        ? event.data
        : Buffer.isBuffer(event.data)
          ? event.data.toString('utf-8')
          : String(event.data)
    const message = JSON.parse(payload) as CdpResponse
    if (typeof message.id !== 'number') {
      return
    }
    const callback = pending.get(message.id)
    if (!callback) {
      return
    }
    pending.delete(message.id)
    clearTimeout(callback.timeout)
    if (message.error) {
      callback.reject(new Error(message.error.message ?? 'CDP command failed'))
      return
    }
    callback.resolve(message.result)
  })
  ws.addEventListener('error', () => {
    rejectPending(new Error('Chrome CDP WebSocket failed'))
  })
  ws.addEventListener('close', () => {
    rejectPending(new Error('Chrome CDP WebSocket closed'))
  })

  return {
    send: async <T>(method: string, params: Record<string, unknown> = {}) => {
      const id = nextId
      nextId += 1
      const result = new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id)
          reject(
            new Error(
              `Timed out waiting for Chrome CDP command ${method} after ${timeoutMs}ms`,
            ),
          )
        }, timeoutMs)
        pending.set(id, {
          resolve: (value) => resolve(value as T),
          reject,
          timeout,
        })
      })
      try {
        ws.send(JSON.stringify({ id, method, params }))
      } catch (error) {
        const callback = pending.get(id)
        if (callback) {
          pending.delete(id)
          clearTimeout(callback.timeout)
          callback.reject(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      }
      return await result
    },
    close: () => {
      rejectPending(new Error('Chrome CDP client closed'))
      ws.close()
    },
  }
}

export const readBodyText = async (client: CdpClient) => {
  const result = await client.send<RuntimeEvaluateResult>('Runtime.evaluate', {
    expression: 'document.body ? document.body.innerText : ""',
    returnByValue: true,
  })
  const value = result.result?.value
  return typeof value === 'string' ? value : ''
}

export const detectSmokeUiLoadingIndicators = (
  bodyText: string,
): SmokeUiLoadingIndicator[] => {
  const normalizedBody = normalizeText(bodyText)
  const indicators: SmokeUiLoadingIndicator[] = []

  if (
    normalizedBody.includes('loading parking data...') ||
    normalizedBody.includes('status: loading')
  ) {
    indicators.push('parking data loading')
  }
  if (normalizedBody.includes('loading map...')) {
    indicators.push('map loading')
  }
  if (normalizedBody.includes('map failed to load')) {
    indicators.push('map failed')
  }

  return indicators
}

export const waitForRequiredText = async (params: {
  client: CdpClient
  requiredText: string[]
  timeoutMs: number
}) => {
  const deadline = Date.now() + params.timeoutMs
  let bodyText = ''
  let missingText = params.requiredText

  while (Date.now() < deadline) {
    bodyText = await readBodyText(params.client)
    const normalizedBody = normalizeText(bodyText)
    missingText = params.requiredText.filter(
      (text) => !normalizedBody.includes(normalizeText(text)),
    )
    if (missingText.length === 0) {
      return { pass: true, missingText, loadingIndicators: [] }
    }
    await wait(250)
  }

  return {
    pass: false,
    missingText,
    loadingIndicators: detectSmokeUiLoadingIndicators(bodyText),
  }
}

export const resolveSmokeUiSuiteTimeoutMs = (
  timeoutMs: number,
  suiteTimeoutMs?: number,
) => suiteTimeoutMs ?? timeoutMs * 2

export const shouldRetrySmokeUiCase = (params: {
  attempt: number
  requiredText: string[]
  missingText: string[]
  loadingIndicators?: SmokeUiLoadingIndicator[]
}) =>
  params.attempt === 0 &&
  params.requiredText.length > 0 &&
  (params.missingText.length === params.requiredText.length ||
    (params.loadingIndicators?.length ?? 0) > 0 ||
    params.missingText.some(
      (text) => normalizeText(text) === normalizeText(MAP_MOUNT_MARKER),
    ))

export const isSafeSmokeProfileDir = (profileDir: string) => {
  const resolvedProfile = path.resolve(profileDir)
  const resolvedTemp = path.resolve(os.tmpdir())
  return (
    resolvedProfile.startsWith(`${resolvedTemp}${path.sep}`) &&
    path.basename(resolvedProfile).startsWith('parkking-ui-smoke-')
  )
}

const getErrorCode = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof error.code === 'string'
    ? error.code
    : null

export const isRetryableSmokeProfileCleanupError = (error: unknown) => {
  const code = getErrorCode(error)
  return code !== null && PROFILE_CLEANUP_RETRYABLE_ERROR_CODES.has(code)
}

export const getSmokeProfileCleanupDelayMs = (params: {
  attempt: number
  initialDelayMs: number
}) => params.initialDelayMs * 2 ** params.attempt

export const removeSmokeProfileDir = async (
  profileDir: string,
  options: SmokeProfileCleanupOptions = {},
) => {
  if (!isSafeSmokeProfileDir(profileDir)) {
    throw new Error(`Refusing to remove unexpected Chrome profile: ${profileDir}`)
  }

  const attempts = Math.max(
    1,
    options.attempts ?? DEFAULT_PROFILE_CLEANUP_ATTEMPTS,
  )
  const initialDelayMs =
    options.initialDelayMs ?? DEFAULT_PROFILE_CLEANUP_INITIAL_DELAY_MS
  const removeDir = options.rm ?? fs.rm
  const waitForDelay = options.waitMs ?? wait
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await removeDir(profileDir, { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      if (
        attempt === attempts - 1 ||
        !isRetryableSmokeProfileCleanupError(error)
      ) {
        throw error
      }
      await waitForDelay(
        getSmokeProfileCleanupDelayMs({ attempt, initialDelayMs }),
      )
    }
  }

  throw lastError
}

const waitForProcessExit = async (processToWaitFor: ChildProcess) => {
  if (processToWaitFor.exitCode !== null) {
    return
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 2_000)
    processToWaitFor.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

export const buildChromeLaunchArgs = (params: {
  cdpPort: number
  profileDir: string
}) => [
  '--headless=new',
  `--remote-debugging-port=${params.cdpPort}`,
  `--user-data-dir=${params.profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-extensions',
  '--disable-dev-shm-usage',
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  'about:blank',
]

export const launchChrome = async (params: {
  chromePath: string
  cdpPort: number
}): Promise<LaunchedChrome> => {
  const profileDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'parkking-ui-smoke-'),
  )
  const chrome = spawn(
    params.chromePath,
    buildChromeLaunchArgs({ cdpPort: params.cdpPort, profileDir }),
    { stdio: 'ignore' },
  )

  return { chrome, profileDir }
}

export const stopChrome = async (params: {
  client: CdpClient | null
  chrome: ChildProcess
  profileDir: string
}) => {
  try {
    await params.client?.send('Browser.close').catch(() => undefined)
    params.client?.close()
    if (params.chrome.exitCode === null) {
      params.chrome.kill()
    }
    await waitForProcessExit(params.chrome)
  } finally {
    await removeSmokeProfileDir(params.profileDir)
  }
}

export const stopPreview = async (launchedPreview: LaunchedPreview | null) => {
  if (!launchedPreview) {
    return
  }
  if (launchedPreview.preview.exitCode === null) {
    launchedPreview.preview.kill()
  }
  await waitForProcessExit(launchedPreview.preview)
}

export const validateSmokeUiParkingAnswersSummary = (
  summary: SmokeUiParkingAnswersSummary,
) => [
  ...(summary.results.length < summary.caseCount
    ? [
        `UI parking answer smoke stopped after ${summary.results.length}/${summary.caseCount} cases because the suite timeout or page-load retry budget was exhausted.`,
      ]
    : []),
  ...summary.results
    .filter((result) => !result.pass)
    .map((result) => {
      const loadingContext = result.loadingIndicators?.length
        ? `; page still reported: ${result.loadingIndicators.join(', ')}`
        : ''
      return `answer case ${result.id} missing UI text: ${result.missingText.join('; ')}${loadingContext}`
    }),
]

export const renderSmokeUiParkingAnswersSummary = (
  summary: SmokeUiParkingAnswersSummary,
) =>
  [
    `UI parking answer smoke: ${summary.appUrl}`,
    `District: ${summary.district}`,
    `View: ${summary.view}`,
    `Dataset hash: ${summary.runtimeDatasetHash ?? 'not checked'}`,
    `Answer-case hash: ${summary.caseDatasetHash ?? 'none'}`,
    `Answer cases: ${summary.passCount}/${summary.caseCount} passed from ${summary.casesPath}`,
    ...summary.results.map((result) => {
      const retryContext =
        (result.attemptCount ?? 1) > 1
          ? `; attempts ${result.attemptCount}`
          : ''
      const loadingContext = result.loadingIndicators?.length
        ? `; page still reported ${result.loadingIndicators.join(', ')}`
        : ''
      const status = result.pass
        ? 'PASS'
        : `FAIL missing "${result.missingText.join('" | "')}"`
      return `CASE ${result.id}: ${status}; expected ${result.expectedKind}; evidence ${result.expectedEvidenceKind ?? '-'}${retryContext}${loadingContext}`
    }),
  ].join('\n')

export const runSmokeUiParkingAnswers = async (
  options: SmokeUiParkingAnswersOptions = {},
) => {
  let appUrl = options.appUrl ?? DEFAULT_APP_URL
  const casesPath = options.casesPath ?? DEFAULT_CASES_PATH
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const suiteTimeoutMs = resolveSmokeUiSuiteTimeoutMs(
    timeoutMs,
    options.suiteTimeoutMs,
  )
  const filter = options.filter === undefined ? DEFAULT_FILTER : options.filter
  const view = options.view ?? DEFAULT_VIEW
  const caseFile = await loadSmokeExactParkingAnswerCases(casesPath)
  const allowMismatchedCaseHash =
    resolveReviewedCaseHashMismatchAllowance(options.allowMismatchedCaseHash)
  const district = options.district ?? caseFile.districtId ?? DEFAULT_DISTRICT
  const selectedCases =
    options.limit === undefined
      ? caseFile.cases
      : caseFile.cases.slice(0, options.limit)
  const chromePath = await resolveChromePath(options.chromePath)
  const cdpPort = await chooseAvailablePort(options.cdpPort)
  let launchedPreview: LaunchedPreview | null = null
  let launchedChrome: LaunchedChrome | null = null
  let client: CdpClient | null = null

  try {
    if (options.startPreview) {
      const previewPort = await chooseAvailablePort(options.previewPort)
      launchedPreview = await launchPreview({ previewPort, timeoutMs })
      appUrl = launchedPreview.appUrl
    }

    await assertSmokeUiAppReachable(appUrl)

    const caseDatasetHash = caseFile.datasetHash ?? null
    const runtimeDatasetHash =
      options.datasetMetaUrl === null
        ? null
        : await fetchRuntimeDatasetHash(
            options.datasetMetaUrl ??
              buildSmokeUiDatasetMetaUrl({ appUrl, district }),
          )
    const hashError = resolveSmokeUiDatasetHashError({
      datasetMetaUrl: options.datasetMetaUrl,
      caseDatasetHash,
      runtimeDatasetHash,
      allowUnpinnedCases: options.allowUnpinnedCases,
      allowMismatchedCaseHash,
    })
    if (hashError) {
      throw new Error(hashError)
    }

    const expectations = selectedCases.map((answerCase) =>
      buildSmokeUiParkingAnswerExpectations({
        appUrl,
        district,
        answerCase,
        view,
        filter,
      }),
    )

    launchedChrome = await launchChrome({ chromePath, cdpPort })
    await waitForCdp(cdpPort, timeoutMs)
    client = await connectCdp(await openCdpTab(cdpPort))
    await client.send('Page.enable')
    await client.send('Runtime.enable')

    const results: SmokeUiParkingAnswerCaseResult[] = []
    const suiteDeadline = Date.now() + suiteTimeoutMs
    for (const expectation of expectations) {
      let outcome: Awaited<ReturnType<typeof waitForRequiredText>> | null = null
      let attemptCount = 0
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const remainingSuiteMs = suiteDeadline - Date.now()
        if (remainingSuiteMs <= 0) {
          break
        }
        attemptCount = attempt + 1
        await client.send('Page.navigate', { url: expectation.url })
        outcome = await waitForRequiredText({
          client,
          requiredText: expectation.requiredText,
          timeoutMs: Math.min(timeoutMs, remainingSuiteMs),
        })
        if (
          outcome.pass ||
          !shouldRetrySmokeUiCase({
            attempt,
            requiredText: expectation.requiredText,
            missingText: outcome.missingText,
            loadingIndicators: outcome.loadingIndicators,
          })
        ) {
          break
        }
      }
      if (!outcome) {
        break
      }
      results.push({ ...expectation, ...outcome, attemptCount })
      if (
        !outcome.pass &&
        outcome.missingText.length === expectation.requiredText.length
      ) {
        break
      }
    }

    const summary: SmokeUiParkingAnswersSummary = {
      appUrl,
      casesPath,
      district,
      view,
      caseDatasetHash,
      runtimeDatasetHash,
      caseCount: expectations.length,
      passCount: results.filter((result) => result.pass).length,
      results,
    }
    const errors = validateSmokeUiParkingAnswersSummary(summary)
    if (errors.length > 0) {
      throw new Error(
        [
          'UI parking answer smoke failed:',
          ...errors,
          '',
          renderSmokeUiParkingAnswersSummary(summary),
        ].join('\n'),
      )
    }

    return summary
  } finally {
    try {
      if (launchedChrome) {
        await stopChrome({
          client,
          chrome: launchedChrome.chrome,
          profileDir: launchedChrome.profileDir,
        })
      }
    } finally {
      await stopPreview(launchedPreview)
    }
  }
}

const run = async () => {
  const summary = await runSmokeUiParkingAnswers(
    parseSmokeUiParkingAnswersArgs(process.argv),
  )
  console.log('UI parking answer smoke ok')
  console.log(renderSmokeUiParkingAnswersSummary(summary))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
