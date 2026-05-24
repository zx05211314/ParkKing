import type { Server } from 'node:http'
import { pathToFileURL } from 'node:url'
import {
  resolveParkKingAppServerConfig,
  startParkKingAppServer,
  type ParkKingAppMiddleware,
  type ParkKingAppServerConfig,
} from './appServer'

export interface SmokeAppServerOptions {
  timeoutMs?: number | null
  skipParkingAnswer?: boolean | null
}

export interface SmokeAppServerProbe {
  path: string
  status: number | null
  pass: boolean
  summary: string
  error: string | null
}

export interface SmokeAppServerResult {
  pass: boolean
  baseUrl: string
  probes: SmokeAppServerProbe[]
}

export interface SmokeAppServerRuntimeOptions {
  config?: ParkKingAppServerConfig
  middlewares?: ParkKingAppMiddleware[]
}

const DEFAULT_TIMEOUT_MS = 15_000

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const parsePositiveInteger = (value: string | null, label: string) => {
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

export const parseSmokeAppServerArgs = (
  argv: string[],
): SmokeAppServerOptions => ({
  timeoutMs: parsePositiveInteger(
    getArgValue(argv, '--timeout-ms', '--timeoutMs'),
    'timeout-ms',
  ),
  skipParkingAnswer: hasFlag(argv, '--skip-parking-answer', '--skipParkingAnswer'),
})

const closeServer = async (server: Server) =>
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const probeJson = async (
  baseUrl: string,
  path: string,
  timeoutMs: number,
  expectedStatus: number,
  expectedStatusText: string,
): Promise<SmokeAppServerProbe> => {
  try {
    const response = await fetchWithTimeout(`${baseUrl}${path}`, timeoutMs)
    const payload = await response.json() as { status?: unknown; error?: unknown }
    const statusText =
      typeof payload.status === 'string'
        ? payload.status
        : typeof payload.error === 'string'
          ? payload.error
          : 'missing status'
    const pass =
      response.status === expectedStatus && statusText.includes(expectedStatusText)
    return {
      path,
      status: response.status,
      pass,
      summary: statusText,
      error: pass
        ? null
        : `expected ${expectedStatus} containing "${expectedStatusText}"`,
    }
  } catch (error) {
    return {
      path,
      status: null,
      pass: false,
      summary: 'request failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const probeStaticRoot = async (
  baseUrl: string,
  timeoutMs: number,
): Promise<SmokeAppServerProbe> => {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/`, timeoutMs)
    const contentType = response.headers.get('content-type') ?? ''
    const body = await response.text()
    const pass =
      response.status === 200 &&
      contentType.includes('text/html') &&
      body.includes('<div id="root">')
    return {
      path: '/',
      status: response.status,
      pass,
      summary: contentType || 'missing content-type',
      error: pass ? null : 'expected built index.html response',
    }
  } catch (error) {
    return {
      path: '/',
      status: null,
      pass: false,
      summary: 'request failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export const runSmokeAppServer = async (
  options: SmokeAppServerOptions = {},
  runtimeOptions: SmokeAppServerRuntimeOptions = {},
): Promise<SmokeAppServerResult> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const resolvedConfig = runtimeOptions.config ?? resolveParkKingAppServerConfig()
  const config = {
    ...resolvedConfig,
    api: { ...resolvedConfig.api },
    host: '127.0.0.1',
    port: 0,
  }
  const server = startParkKingAppServer({
    config,
    middlewares: runtimeOptions.middlewares,
  })

  try {
    await new Promise<void>((resolve) => server.on('listening', () => resolve()))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('App server did not bind to a TCP address')
    }
    const baseUrl = `http://127.0.0.1:${address.port}`
    const probes = [
      await probeJson(baseUrl, config.readyPath, timeoutMs, 200, 'ok'),
      ...(options.skipParkingAnswer
        ? []
        : [
            await probeJson(
              baseUrl,
              '/api/parking-answer/ready',
              timeoutMs,
              200,
              'ok',
            ),
          ]),
      await probeJson(baseUrl, '/api/not-found', timeoutMs, 404, 'API route not found'),
      await probeStaticRoot(baseUrl, timeoutMs),
    ]
    return {
      pass: probes.every((probe) => probe.pass),
      baseUrl,
      probes,
    }
  } finally {
    await closeServer(server)
  }
}

export const renderSmokeAppServer = (result: SmokeAppServerResult) => {
  const lines = [
    `# App Server Smoke: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Base URL: ${result.baseUrl}`,
    '',
    '| Status | Path | HTTP | Summary | Error |',
    '| --- | --- | --- | --- | --- |',
    ...result.probes.map(
      (probe) =>
        `| ${probe.pass ? 'PASS' : 'FAIL'} | ${probe.path} | ${probe.status ?? '-'} | ${probe.summary} | ${probe.error ?? ''} |`,
    ),
  ]
  return `${lines.join('\n')}\n`
}

const isMainModule = () => {
  const entry = process.argv[1]
  return entry ? pathToFileURL(entry).href === import.meta.url : false
}

if (isMainModule()) {
  runSmokeAppServer(parseSmokeAppServerArgs(process.argv.slice(2)))
    .then((result) => {
      console.log(renderSmokeAppServer(result))
      if (!result.pass) {
        process.exitCode = 1
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
