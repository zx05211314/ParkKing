import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ISSUE_REPORTS_STORAGE_KEY } from '../../src/feedback/issueReportStore'
import {
  assertSmokeUiAppReachable,
  chooseAvailablePort,
  connectCdp,
  launchChrome,
  launchPreview,
  normalizeText,
  openCdpTab,
  resolveChromePath,
  stopChrome,
  stopPreview,
  wait,
  waitForCdp,
  waitForRequiredText,
  type CdpClient,
  type LaunchedChrome,
  type LaunchedPreview,
  type RuntimeEvaluateResult,
} from './smokeUiParkingAnswers'

export interface SmokeUiIssueReportOptions {
  appUrl?: string
  district?: string
  chromePath?: string
  cdpPort?: number
  timeoutMs?: number
  startPreview?: boolean
  previewPort?: number
  syncIssuesUrl?: string | null
}

export interface SmokeUiIssueReportSummary {
  appUrl: string
  url: string
  district: string
  pass: boolean
  issueId: string
  issueSummary: string | null
  localIssueCount: number
  remoteIssueCount: number
  syncIssuesUrl: string
  downloadedFileName: string
  bodySnippet: string
}

interface UiIssueReportState {
  bodyText: string
  latestIssueId: string | null
  latestIssueSummary: string | null
  localIssueCount: number
}

interface RemoteIssueReportState {
  issueCount: number
  found: boolean
}

const DEFAULT_APP_URL = 'http://127.0.0.1:4173'
const DEFAULT_DISTRICT = 'xinyi'
const DEFAULT_TIMEOUT_MS = 25_000

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

export const parseSmokeUiIssueReportArgs = (
  argv: string[],
): SmokeUiIssueReportOptions => ({
  appUrl: getArgValue(argv, '--app-url', '--appUrl') ?? DEFAULT_APP_URL,
  district: getArgValue(argv, '--district') ?? DEFAULT_DISTRICT,
  chromePath:
    getArgValue(argv, '--chrome-path', '--chromePath') ??
    process.env.CHROME_PATH ??
    undefined,
  cdpPort: parsePositiveIntegerArg(argv, '--cdp-port', '--cdpPort', '--port'),
  timeoutMs:
    parsePositiveIntegerArg(argv, '--timeout-ms', '--timeoutMs') ??
    DEFAULT_TIMEOUT_MS,
  startPreview: hasFlag(argv, '--start-preview'),
  previewPort: parsePositiveIntegerArg(
    argv,
    '--preview-port',
    '--previewPort',
  ),
  syncIssuesUrl: getArgValue(
    argv,
    '--sync-issues-url',
    '--syncIssuesUrl',
  ),
})

export const buildSmokeUiIssueReportUrl = (params: {
  appUrl: string
  district: string
}) => {
  const url = new URL(params.appUrl)
  url.searchParams.set('dataset', params.district)
  return url.toString()
}

export const buildSmokeUiIssueReportsUrl = (params: {
  appUrl: string
  syncIssuesUrl?: string | null
}) =>
  new URL(params.syncIssuesUrl ?? '/api/sync/issues', params.appUrl).toString()

const bodySnippet = (bodyText: string) =>
  bodyText.replace(/\s+/g, ' ').trim().slice(0, 240)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getStringField = (record: unknown, field: string) =>
  isRecord(record) && typeof record[field] === 'string'
    ? record[field]
    : null

export const findSmokeUiIssueReportRemoteIssue = (
  payload: unknown,
  issueId: string,
): RemoteIssueReportState => {
  const issues = isRecord(payload) && Array.isArray(payload.issues)
    ? payload.issues
    : []
  return {
    issueCount: issues.length,
    found: issues.some((issue) => getStringField(issue, 'issueId') === issueId),
  }
}

const fetchJsonWithTimeout = async (url: string, timeoutMs: number) => {
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

const assertRemoteIssueReport = async (params: {
  syncIssuesUrl: string
  issueId: string
  timeoutMs: number
}) => {
  const { response, payload } = await fetchJsonWithTimeout(
    params.syncIssuesUrl,
    params.timeoutMs,
  )
  if (!response.ok) {
    throw new Error(
      `Issue report sync endpoint returned HTTP ${response.status}: ${params.syncIssuesUrl}`,
    )
  }
  const remoteState = findSmokeUiIssueReportRemoteIssue(payload, params.issueId)
  if (!remoteState.found) {
    throw new Error(
      `Synced issue ${params.issueId} was not found at ${params.syncIssuesUrl}`,
    )
  }
  return remoteState
}

const readIssueReportState = async (
  client: CdpClient,
): Promise<UiIssueReportState> => {
  const result = await client.send<RuntimeEvaluateResult>('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body ? document.body.innerText : '';
      let issues = [];
      try {
        const raw = window.localStorage.getItem(${JSON.stringify(ISSUE_REPORTS_STORAGE_KEY)});
        const parsed = raw ? JSON.parse(raw) : null;
        issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
      } catch {
        issues = [];
      }
      const latest = issues.length > 0 ? issues[issues.length - 1] : null;
      return {
        bodyText,
        latestIssueId: typeof latest?.issueId === 'string' ? latest.issueId : null,
        latestIssueSummary: typeof latest?.summary === 'string' ? latest.summary : null,
        localIssueCount: issues.length,
      };
    })()`,
    returnByValue: true,
  })
  const value = result.result?.value
  if (!isRecord(value)) {
    return {
      bodyText: '',
      latestIssueId: null,
      latestIssueSummary: null,
      localIssueCount: 0,
    }
  }
  return {
    bodyText: getStringField(value, 'bodyText') ?? '',
    latestIssueId: getStringField(value, 'latestIssueId'),
    latestIssueSummary: getStringField(value, 'latestIssueSummary'),
    localIssueCount:
      typeof value.localIssueCount === 'number' &&
      Number.isFinite(value.localIssueCount)
        ? value.localIssueCount
        : 0,
  }
}

const clickReportIssueButton = async (client: CdpClient) => {
  const result = await client.send<RuntimeEvaluateResult>('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body ? document.body.innerText : '';
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find((candidate) =>
        candidate.textContent && candidate.textContent.trim() === 'Report issue'
      );
      if (!button) {
        return { clicked: false, bodyText };
      }
      button.click();
      return { clicked: true, bodyText };
    })()`,
    returnByValue: true,
  })
  const value = result.result?.value
  if (!isRecord(value) || value.clicked !== true) {
    throw new Error(
      `Report issue button was not clickable. Body: ${bodySnippet(getStringField(value, 'bodyText') ?? '')}`,
    )
  }
}

const waitForIssueSubmission = async (params: {
  client: CdpClient
  timeoutMs: number
}) => {
  const deadline = Date.now() + params.timeoutMs
  let state: UiIssueReportState = {
    bodyText: '',
    latestIssueId: null,
    latestIssueSummary: null,
    localIssueCount: 0,
  }

  while (Date.now() < deadline) {
    state = await readIssueReportState(params.client)
    const normalizedBody = normalizeText(state.bodyText)
    if (
      state.latestIssueId &&
      normalizedBody.includes(normalizeText('Issue submitted to ParkKing Sync.'))
    ) {
      return state
    }
    await wait(250)
  }

  throw new Error(
    `Issue report submission did not finish. Body: ${bodySnippet(state.bodyText)}`,
  )
}

const configureDownloadDir = async (client: CdpClient, downloadDir: string) => {
  try {
    await client.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    })
  } catch {
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    })
  }
}

const readDownloadedDebugBundle = async (params: {
  downloadDir: string
  timeoutMs: number
}) => {
  const deadline = Date.now() + params.timeoutMs
  let lastFileNames: string[] = []

  while (Date.now() < deadline) {
    lastFileNames = await fs.readdir(params.downloadDir).catch(() => [])
    const candidates = lastFileNames.filter(
      (fileName) =>
        fileName.startsWith('parkking-debug-') &&
        fileName.endsWith('.json') &&
        !fileName.endsWith('.crdownload'),
    )
    for (const fileName of candidates) {
      const filePath = path.join(params.downloadDir, fileName)
      const raw = await fs.readFile(filePath, 'utf-8').catch(() => null)
      if (!raw) {
        continue
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(raw) as unknown
      } catch {
        continue
      }
      if (isRecord(parsed) && isRecord(parsed.pack) && isRecord(parsed.context)) {
        return { fileName, bundle: parsed }
      }
    }
    await wait(250)
  }

  throw new Error(
    `Debug bundle download was not captured in ${params.downloadDir}. Files: ${lastFileNames.join(', ') || 'none'}`,
  )
}

const safeRemoveTempDir = async (dirPath: string | null) => {
  if (!dirPath) {
    return
  }
  const resolvedDir = path.resolve(dirPath)
  const resolvedTemp = path.resolve(os.tmpdir())
  if (
    !resolvedDir.startsWith(`${resolvedTemp}${path.sep}`) ||
    !path.basename(resolvedDir).startsWith('parkking-ui-issue-download-')
  ) {
    throw new Error(`Refusing to remove unexpected download directory: ${dirPath}`)
  }
  await fs.rm(resolvedDir, { recursive: true, force: true })
}

export const runSmokeUiIssueReport = async (
  options: SmokeUiIssueReportOptions = {},
): Promise<SmokeUiIssueReportSummary> => {
  let appUrl = options.appUrl ?? DEFAULT_APP_URL
  const district = options.district ?? DEFAULT_DISTRICT
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const chromePath = await resolveChromePath(options.chromePath)
  const cdpPort = await chooseAvailablePort(options.cdpPort)
  let launchedPreview: LaunchedPreview | null = null
  let launchedChrome: LaunchedChrome | null = null
  let client: CdpClient | null = null
  let downloadDir: string | null = null

  try {
    if (options.startPreview) {
      const previewPort = await chooseAvailablePort(options.previewPort)
      launchedPreview = await launchPreview({ previewPort, timeoutMs })
      appUrl = launchedPreview.appUrl
    }

    await assertSmokeUiAppReachable(appUrl)
    const url = buildSmokeUiIssueReportUrl({ appUrl, district })
    const syncIssuesUrl = buildSmokeUiIssueReportsUrl({
      appUrl,
      syncIssuesUrl: options.syncIssuesUrl,
    })

    downloadDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'parkking-ui-issue-download-'),
    )
    launchedChrome = await launchChrome({ chromePath, cdpPort })
    await waitForCdp(cdpPort, timeoutMs)
    client = await connectCdp(await openCdpTab(cdpPort))
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await configureDownloadDir(client, downloadDir)

    await client.send('Page.navigate', { url })
    const ready = await waitForRequiredText({
      client,
      requiredText: [
        'Status: ready',
        'Issue report sync: Upload-only',
        'Report issue',
      ],
      timeoutMs,
    })
    if (!ready.pass) {
      throw new Error(
        `UI issue report smoke missing ready text: ${ready.missingText.join('; ')}`,
      )
    }

    await clickReportIssueButton(client)
    const submitted = await waitForIssueSubmission({ client, timeoutMs })
    if (!submitted.latestIssueId) {
      throw new Error('Issue report was submitted without a local issue id.')
    }

    const download = await readDownloadedDebugBundle({ downloadDir, timeoutMs })
    const remoteState = await assertRemoteIssueReport({
      syncIssuesUrl,
      issueId: submitted.latestIssueId,
      timeoutMs,
    })

    return {
      appUrl,
      url,
      district,
      pass: true,
      issueId: submitted.latestIssueId,
      issueSummary: submitted.latestIssueSummary,
      localIssueCount: submitted.localIssueCount,
      remoteIssueCount: remoteState.issueCount,
      syncIssuesUrl,
      downloadedFileName: download.fileName,
      bodySnippet: bodySnippet(submitted.bodyText),
    }
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
      try {
        await stopPreview(launchedPreview)
      } finally {
        await safeRemoveTempDir(downloadDir)
      }
    }
  }
}

export const renderSmokeUiIssueReportSummary = (
  summary: SmokeUiIssueReportSummary,
) =>
  [
    `UI issue report smoke: ${summary.pass ? 'PASS' : 'FAIL'}`,
    `URL: ${summary.url}`,
    `Issue: ${summary.issueId} (${summary.issueSummary ?? '-'})`,
    `Local issues: ${summary.localIssueCount}`,
    `Remote issues: ${summary.remoteIssueCount} from ${summary.syncIssuesUrl}`,
    `Debug bundle: ${summary.downloadedFileName}`,
  ].join('\n')

const run = async () => {
  const summary = await runSmokeUiIssueReport(
    parseSmokeUiIssueReportArgs(process.argv),
  )
  console.log(renderSmokeUiIssueReportSummary(summary))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
