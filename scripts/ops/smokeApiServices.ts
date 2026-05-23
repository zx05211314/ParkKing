import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs/promises'
import type { Server } from 'node:http'
import { createServer, type AddressInfo } from 'node:net'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveGeocodeProxyConfig,
  startGeocodeProxyServer,
} from './geocodeProxy'
import {
  resolveParkingAnswerServiceConfig,
  startParkingAnswerServiceServer,
} from './parkingAnswerService'
import {
  resolveRoutingProxyConfig,
  startRoutingProxyServer,
} from './routingProxy'
import {
  resolveSyncServiceConfig,
  startSyncServiceServer,
} from './syncService'

export type SmokeApiServiceId =
  | 'geocode'
  | 'routing'
  | 'sync'
  | 'parking-answer'

export interface SmokeApiServicesOptions {
  services?: SmokeApiServiceId[]
  timeoutMs?: number
  baseUrl?: string
  startPreview?: boolean
  previewPort?: number
}

export interface SmokeApiServicesProbeResult {
  service: SmokeApiServiceId
  suffix: 'health' | 'ready'
  url: string
  status: number
  ok: boolean
  serviceStatus: string | null
}

export interface SmokeApiServicesSummary {
  passed: number
  failed: number
  results: SmokeApiServicesProbeResult[]
}

interface StartedService {
  id: SmokeApiServiceId
  server: Server
  baseUrl: string
}

interface LaunchedPreview {
  preview: ChildProcess
  baseUrl: string
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_SERVICES: SmokeApiServiceId[] = [
  'geocode',
  'routing',
  'sync',
  'parking-answer',
]

const SERVICE_PATHS: Record<SmokeApiServiceId, string> = {
  geocode: '/api/geocode',
  routing: '/api/route',
  sync: '/api/sync',
  'parking-answer': '/api/parking-answer',
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

const parsePositiveNumber = (value: string | null, fallback: number) => {
  if (value === null) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Expected a positive finite number')
  }
  return parsed
}

const parsePositiveInteger = (value: string | null) => {
  if (value === null) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Expected a positive integer')
  }
  return parsed
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const parseServices = (value: string | null): SmokeApiServiceId[] => {
  if (!value) {
    return DEFAULT_SERVICES
  }
  const services = value
    .split(',')
    .map((service) => service.trim())
    .filter(Boolean)
  const invalid = services.filter(
    (service) => !DEFAULT_SERVICES.includes(service as SmokeApiServiceId),
  )
  if (invalid.length > 0) {
    throw new Error(`Unknown services: ${invalid.join(', ')}`)
  }
  return services as SmokeApiServiceId[]
}

export const parseSmokeApiServicesArgs = (
  argv: string[],
): SmokeApiServicesOptions => {
  const baseUrl = getArgValue(argv, '--base-url', '--baseUrl') ?? undefined
  const startPreview = hasFlag(argv, '--start-preview', '--startPreview')
  if (baseUrl && startPreview) {
    throw new Error('--base-url and --start-preview cannot be combined')
  }
  return {
    services: parseServices(getArgValue(argv, '--services')),
    timeoutMs: parsePositiveNumber(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      DEFAULT_TIMEOUT_MS,
    ),
    baseUrl,
    startPreview,
    previewPort: parsePositiveInteger(
      getArgValue(argv, '--preview-port', '--previewPort'),
    ),
  }
}

const waitForListening = async (server: Server) =>
  await new Promise<void>((resolve, reject) => {
    if (server.listening) {
      resolve()
      return
    }
    server.once('listening', resolve)
    server.once('error', reject)
  })

const startService = async (id: SmokeApiServiceId): Promise<StartedService> => {
  if (id === 'geocode') {
    const config = resolveGeocodeProxyConfig()
    config.port = 0
    const server = startGeocodeProxyServer(config)
    await waitForListening(server)
    const { port } = server.address() as AddressInfo
    return { id, server, baseUrl: `http://127.0.0.1:${port}${config.path}` }
  }

  if (id === 'routing') {
    const config = resolveRoutingProxyConfig()
    config.port = 0
    const server = startRoutingProxyServer(config)
    await waitForListening(server)
    const { port } = server.address() as AddressInfo
    return { id, server, baseUrl: `http://127.0.0.1:${port}${config.path}` }
  }

  if (id === 'sync') {
    const config = resolveSyncServiceConfig()
    config.port = 0
    const server = startSyncServiceServer(config)
    await waitForListening(server)
    const { port } = server.address() as AddressInfo
    return { id, server, baseUrl: `http://127.0.0.1:${port}${config.path}` }
  }

  const config = resolveParkingAnswerServiceConfig({
    ...process.env,
    PARKKING_PARKING_ANSWER_DISTRICTS: 'xinyi',
    PARKKING_PARKING_ANSWER_DEFAULT_DISTRICT: 'xinyi',
  })
  config.port = 0
  const server = startParkingAnswerServiceServer(config)
  await waitForListening(server)
  const { port } = server.address() as AddressInfo
  return { id, server, baseUrl: `http://127.0.0.1:${port}${config.path}` }
}

const closeService = async (server: Server) =>
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })

const wait = async (ms: number) =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const chooseAvailablePort = async (preferredPort: number | undefined) => {
  if (preferredPort) {
    return preferredPort
  }

  return await new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate preview port')))
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

const launchPreview = async (
  port: number,
  timeoutMs: number,
): Promise<LaunchedPreview> => {
  const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')
  await fs.access(viteBin)
  const baseUrl = `http://127.0.0.1:${port}`
  const preview = spawn(
    process.execPath,
    [
      viteBin,
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const processLog = collectProcessLog(preview)
  await waitForHttp({
    url: baseUrl,
    processToCheck: preview,
    processLog,
    timeoutMs,
  })
  return { preview, baseUrl }
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

const stopPreview = async (launchedPreview: LaunchedPreview | null) => {
  if (!launchedPreview) {
    return
  }
  if (launchedPreview.preview.exitCode === null) {
    launchedPreview.preview.kill()
  }
  await waitForProcessExit(launchedPreview.preview)
}

const startServices = async (services: SmokeApiServiceId[]) => {
  const started: StartedService[] = []
  try {
    for (const service of services) {
      started.push(await startService(service))
    }
    return started
  } catch (error) {
    await Promise.all(started.map((entry) => closeService(entry.server)))
    throw error
  }
}

const buildProbeUrl = (
  service: SmokeApiServiceId,
  suffix: 'health' | 'ready',
  options: SmokeApiServicesOptions,
  started: StartedService[],
) => {
  if (options.baseUrl) {
    const url = new URL(SERVICE_PATHS[service], options.baseUrl)
    url.pathname = `${url.pathname.replace(/\/+$/g, '')}/${suffix}`
    return url
  }

  const serviceServer = started.find((entry) => entry.id === service)
  if (!serviceServer) {
    throw new Error(`Service ${service} was not started`)
  }
  return new URL(`${serviceServer.baseUrl.replace(/\/+$/g, '')}/${suffix}`)
}

const fetchJsonWithTimeout = async (url: URL, timeoutMs: number) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const payload = await response.json().catch(() => null)
    return { response, payload }
  } finally {
    clearTimeout(timeout)
  }
}

const readServiceStatus = (payload: unknown) =>
  payload &&
  typeof payload === 'object' &&
  !Array.isArray(payload) &&
  typeof (payload as { status?: unknown }).status === 'string'
    ? (payload as { status: string }).status
    : null

export const runSmokeApiServices = async (
  options: SmokeApiServicesOptions = {},
): Promise<SmokeApiServicesSummary> => {
  const services = options.services ?? DEFAULT_SERVICES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const launchedPreview = options.startPreview
    ? await launchPreview(
        await chooseAvailablePort(options.previewPort),
        timeoutMs,
      )
    : null
  const baseUrl = options.baseUrl ?? launchedPreview?.baseUrl
  const started = baseUrl ? [] : await startServices(services)

  try {
    const results: SmokeApiServicesProbeResult[] = []
    for (const service of services) {
      for (const suffix of ['health', 'ready'] as const) {
        const url = buildProbeUrl(
          service,
          suffix,
          { ...options, baseUrl },
          started,
        )
        const { response, payload } = await fetchJsonWithTimeout(url, timeoutMs)
        const serviceStatus = readServiceStatus(payload)
        results.push({
          service,
          suffix,
          url: url.toString(),
          status: response.status,
          ok: response.ok && serviceStatus === 'ok',
          serviceStatus,
        })
      }
    }

    return {
      passed: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    }
  } finally {
    try {
      await Promise.all(started.map((entry) => closeService(entry.server)))
    } finally {
      await stopPreview(launchedPreview)
    }
  }
}

export const renderSmokeApiServicesSummary = (
  summary: SmokeApiServicesSummary,
) =>
  [
    `API service probes: ${summary.passed}/${summary.results.length} passed`,
    ...summary.results.map((result) => {
      const status = result.ok
        ? 'PASS'
        : `FAIL http=${result.status} status=${result.serviceStatus ?? 'none'}`
      return `${result.service}/${result.suffix}: ${status} ${result.url}`
    }),
  ].join('\n')

const run = async () => {
  const summary = await runSmokeApiServices(
    parseSmokeApiServicesArgs(process.argv),
  )
  console.log(renderSmokeApiServicesSummary(summary))
  if (summary.failed > 0) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
