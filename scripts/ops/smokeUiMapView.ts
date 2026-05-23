import { fileURLToPath } from 'node:url'
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
  type CdpClient,
  type LaunchedChrome,
  type LaunchedPreview,
  type RuntimeEvaluateResult,
} from './smokeUiParkingAnswers'

export interface SmokeUiMapViewOptions {
  appUrl?: string
  district?: string
  chromePath?: string
  cdpPort?: number
  timeoutMs?: number
  startPreview?: boolean
  previewPort?: number
  datasetMetaUrl?: string | null
}

export interface SmokeUiMapViewSummary {
  appUrl: string
  url: string
  district: string
  pass: boolean
  requiredText: string[]
  missingText: string[]
  hasMapRoot: boolean
  rootWidth: number
  rootHeight: number
  hasCanvas: boolean
  canvasWidth: number
  canvasHeight: number
  expectedSegmentsCount: number | null
  expectedParkingSpacesCount: number | null
  datasetStatusReady: boolean
  reportedSegmentsCount: number | null
  reportedParkingSpacesCount: number | null
  mapSegmentCount: number
  mapParkingSpaceCount: number
  hasFallback: boolean
  hasSkeleton: boolean
  bodySnippet: string
}

interface SmokeUiMapViewDomState {
  bodyText: string
  hasMapRoot: boolean
  rootWidth: number
  rootHeight: number
  hasCanvas: boolean
  canvasWidth: number
  canvasHeight: number
  datasetStatusReady: boolean
  reportedSegmentsCount: number | null
  reportedParkingSpacesCount: number | null
  mapSegmentCount: number
  mapParkingSpaceCount: number
  hasFallback: boolean
  hasSkeleton: boolean
}

interface SmokeUiMapViewDatasetCounts {
  expectedSegmentsCount: number | null
  expectedParkingSpacesCount: number | null
}

const DEFAULT_APP_URL = 'http://127.0.0.1:4173'
const DEFAULT_DISTRICT = 'xinyi'
const DEFAULT_TIMEOUT_MS = 25_000

export const SMOKE_UI_MAP_VIEW_REQUIRED_TEXT = [
  'Mode: Map + list',
  'Green: park ok',
  'Yellow: caution',
  'Red: no stop',
  'Click map to check parking here',
  'My location',
] as const

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

export const parseSmokeUiMapViewArgs = (
  argv: string[],
): SmokeUiMapViewOptions => ({
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
  datasetMetaUrl: hasFlag(argv, '--no-dataset-meta-check')
    ? null
    : getArgValue(argv, '--dataset-meta-url', '--datasetMetaUrl') ?? undefined,
})

export const buildSmokeUiMapViewUrl = (params: {
  appUrl: string
  district: string
}) => {
  const url = new URL(params.appUrl)
  url.searchParams.set('dataset', params.district)
  url.searchParams.set('view', 'MAP')
  return url.toString()
}

export const buildSmokeUiMapViewDatasetMetaUrl = (params: {
  appUrl: string
  district: string
}) =>
  new URL(
    `/data/generated/${params.district}/dataset_meta.json`,
    params.appUrl,
  ).toString()

const getNumberField = (record: unknown, field: string) =>
  record &&
  typeof record === 'object' &&
  typeof (record as Record<string, unknown>)[field] === 'number'
    ? ((record as Record<string, unknown>)[field] as number)
    : null

export const getSmokeUiMapViewDatasetCounts = (
  meta: unknown,
): SmokeUiMapViewDatasetCounts => ({
  expectedSegmentsCount: getNumberField(meta, 'segmentsCount'),
  expectedParkingSpacesCount: getNumberField(meta, 'parkingSpacesCount'),
})

const fetchSmokeUiMapViewDatasetCounts = async (
  datasetMetaUrl: string,
): Promise<SmokeUiMapViewDatasetCounts> => {
  let response: Response
  try {
    response = await fetch(datasetMetaUrl)
  } catch (error) {
    throw new Error(
      `Runtime dataset meta ${datasetMetaUrl} is not reachable. Start the app or rerun with --start-preview. Cause: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!response.ok) {
    throw new Error(
      `Failed to load runtime dataset meta ${datasetMetaUrl}: HTTP ${response.status}`,
    )
  }
  return getSmokeUiMapViewDatasetCounts(await response.json())
}

const getMapViewDomState = async (
  client: CdpClient,
): Promise<SmokeUiMapViewDomState> => {
  const result = await client.send<RuntimeEvaluateResult>('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body ? document.body.innerText : '';
      const parseCount = (label) => {
        const match = bodyText.match(new RegExp(label + ':\\\\s*([0-9,]+)', 'i'));
        return match ? Number(match[1].replace(/,/g, '')) : null;
      };
      const parseDataCount = (name) => {
        const value = document.querySelector('.map-root-shell')?.getAttribute(name);
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const root = document.querySelector('.map-root');
      const rootRect = root ? root.getBoundingClientRect() : null;
      const canvas = document.querySelector('.maplibregl-canvas');
      const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
      return {
        bodyText,
        hasMapRoot: Boolean(root),
        rootWidth: Math.round(rootRect ? rootRect.width : 0),
        rootHeight: Math.round(rootRect ? rootRect.height : 0),
        hasCanvas: Boolean(canvas),
        canvasWidth: Math.round(canvasRect ? canvasRect.width : 0),
        canvasHeight: Math.round(canvasRect ? canvasRect.height : 0),
        datasetStatusReady: /Status:\\s*ready/i.test(bodyText),
        reportedSegmentsCount: parseCount('Segments'),
        reportedParkingSpacesCount: parseCount('Parking spaces'),
        mapSegmentCount: parseDataCount('data-segment-count'),
        mapParkingSpaceCount: parseDataCount('data-parking-space-count'),
        hasFallback: Boolean(document.querySelector('.map-fallback')) || bodyText.includes('Map failed to load'),
        hasSkeleton: bodyText.includes('Loading map?')
      };
    })()`,
    returnByValue: true,
  })

  const value = result.result?.value
  if (!value || typeof value !== 'object') {
    return {
      bodyText: '',
      hasMapRoot: false,
      rootWidth: 0,
      rootHeight: 0,
      hasCanvas: false,
      canvasWidth: 0,
      canvasHeight: 0,
      datasetStatusReady: false,
      reportedSegmentsCount: null,
      reportedParkingSpacesCount: null,
      mapSegmentCount: 0,
      mapParkingSpaceCount: 0,
      hasFallback: false,
      hasSkeleton: false,
    }
  }
  return value as SmokeUiMapViewDomState
}

const bodySnippet = (bodyText: string) =>
  bodyText.replace(/\s+/g, ' ').trim().slice(0, 240)

const isCountReady = (actual: number | null, expected: number | null) =>
  expected === null ? actual !== null && actual > 0 : actual === expected

const isPositiveCount = (actual: number | null) => actual !== null && actual > 0

const buildSummary = (params: {
  appUrl: string
  url: string
  district: string
  requiredText: string[]
  missingText: string[]
  expectedCounts: SmokeUiMapViewDatasetCounts
  state: SmokeUiMapViewDomState
}): SmokeUiMapViewSummary => ({
  appUrl: params.appUrl,
  url: params.url,
  district: params.district,
  pass:
    params.missingText.length === 0 &&
    params.state.hasMapRoot &&
    params.state.rootWidth > 0 &&
    params.state.rootHeight > 0 &&
    params.state.hasCanvas &&
    params.state.canvasWidth > 0 &&
    params.state.canvasHeight > 0 &&
    params.state.datasetStatusReady &&
    isPositiveCount(params.state.reportedSegmentsCount) &&
    isCountReady(
      params.state.reportedParkingSpacesCount,
      params.expectedCounts.expectedParkingSpacesCount,
    ) &&
    isCountReady(
      params.state.mapSegmentCount,
      params.expectedCounts.expectedSegmentsCount,
    ) &&
    isCountReady(
      params.state.mapParkingSpaceCount,
      params.expectedCounts.expectedParkingSpacesCount,
    ) &&
    !params.state.hasFallback,
  requiredText: params.requiredText,
  missingText: params.missingText,
  hasMapRoot: params.state.hasMapRoot,
  rootWidth: params.state.rootWidth,
  rootHeight: params.state.rootHeight,
  hasCanvas: params.state.hasCanvas,
  canvasWidth: params.state.canvasWidth,
  canvasHeight: params.state.canvasHeight,
  expectedSegmentsCount: params.expectedCounts.expectedSegmentsCount,
  expectedParkingSpacesCount: params.expectedCounts.expectedParkingSpacesCount,
  datasetStatusReady: params.state.datasetStatusReady,
  reportedSegmentsCount: params.state.reportedSegmentsCount,
  reportedParkingSpacesCount: params.state.reportedParkingSpacesCount,
  mapSegmentCount: params.state.mapSegmentCount,
  mapParkingSpaceCount: params.state.mapParkingSpaceCount,
  hasFallback: params.state.hasFallback,
  hasSkeleton: params.state.hasSkeleton,
  bodySnippet: bodySnippet(params.state.bodyText),
})

export const waitForSmokeUiMapView = async (params: {
  client: CdpClient
  appUrl: string
  url: string
  district: string
  requiredText?: readonly string[]
  expectedCounts?: SmokeUiMapViewDatasetCounts
  timeoutMs: number
}) => {
  const requiredText = [
    ...(params.requiredText ?? SMOKE_UI_MAP_VIEW_REQUIRED_TEXT),
  ]
  const expectedCounts = params.expectedCounts ?? {
    expectedSegmentsCount: null,
    expectedParkingSpacesCount: null,
  }
  const deadline = Date.now() + params.timeoutMs
  let state: SmokeUiMapViewDomState = {
    bodyText: '',
    hasMapRoot: false,
    rootWidth: 0,
    rootHeight: 0,
    hasCanvas: false,
    canvasWidth: 0,
    canvasHeight: 0,
    datasetStatusReady: false,
    reportedSegmentsCount: null,
    reportedParkingSpacesCount: null,
    mapSegmentCount: 0,
    mapParkingSpaceCount: 0,
    hasFallback: false,
    hasSkeleton: false,
  }
  let missingText = requiredText

  while (Date.now() < deadline) {
    state = await getMapViewDomState(params.client)
    const normalizedBody = normalizeText(state.bodyText)
    missingText = requiredText.filter(
      (text) => !normalizedBody.includes(normalizeText(text)),
    )
    const summary = buildSummary({
      appUrl: params.appUrl,
      url: params.url,
      district: params.district,
      requiredText,
      missingText,
      expectedCounts,
      state,
    })
    if (summary.pass) {
      return summary
    }
    await wait(250)
  }

  return buildSummary({
    appUrl: params.appUrl,
    url: params.url,
    district: params.district,
    requiredText,
    missingText,
    expectedCounts,
    state,
  })
}

export const validateSmokeUiMapViewSummary = (
  summary: SmokeUiMapViewSummary,
) => {
  const errors: string[] = []
  if (summary.missingText.length > 0) {
    errors.push(`missing UI text: ${summary.missingText.join('; ')}`)
  }
  if (!summary.hasMapRoot) {
    errors.push('map root was not rendered')
  } else if (summary.rootWidth <= 0 || summary.rootHeight <= 0) {
    errors.push(
      `map root has no layout size: ${summary.rootWidth}x${summary.rootHeight}`,
    )
  }
  if (!summary.hasCanvas) {
    errors.push('MapLibre canvas was not mounted')
  } else if (summary.canvasWidth <= 0 || summary.canvasHeight <= 0) {
    errors.push(
      `MapLibre canvas has no layout size: ${summary.canvasWidth}x${summary.canvasHeight}`,
    )
  }
  if (!summary.datasetStatusReady) {
    errors.push('dataset status did not reach ready')
  }
  if (!isPositiveCount(summary.reportedSegmentsCount)) {
    errors.push(
      `reported segment count ${summary.reportedSegmentsCount ?? 'missing'} is not positive`,
    )
  }
  if (
    !isCountReady(
      summary.reportedParkingSpacesCount,
      summary.expectedParkingSpacesCount,
    )
  ) {
    errors.push(
      `reported parking-space count ${summary.reportedParkingSpacesCount ?? 'missing'} does not match expected ${summary.expectedParkingSpacesCount ?? '>0'}`,
    )
  }
  if (!isCountReady(summary.mapSegmentCount, summary.expectedSegmentsCount)) {
    errors.push(
      `map segment count ${summary.mapSegmentCount} does not match expected ${summary.expectedSegmentsCount ?? '>0'}`,
    )
  }
  if (
    !isCountReady(
      summary.mapParkingSpaceCount,
      summary.expectedParkingSpacesCount,
    )
  ) {
    errors.push(
      `map parking-space count ${summary.mapParkingSpaceCount} does not match expected ${summary.expectedParkingSpacesCount ?? '>0'}`,
    )
  }
  if (summary.hasFallback) {
    errors.push('map fallback is visible')
  }
  return errors
}

export const renderSmokeUiMapViewSummary = (
  summary: SmokeUiMapViewSummary,
) =>
  [
    `UI map smoke: ${summary.pass ? 'PASS' : 'FAIL'}`,
    `District: ${summary.district}`,
    `App: ${summary.appUrl}`,
    `URL: ${summary.url}`,
    `Required text: ${summary.requiredText.length - summary.missingText.length}/${summary.requiredText.length}`,
    `Map root: ${summary.hasMapRoot ? `${summary.rootWidth}x${summary.rootHeight}` : 'missing'}`,
    `MapLibre canvas: ${summary.hasCanvas ? `${summary.canvasWidth}x${summary.canvasHeight}` : 'missing'}`,
    `Dataset ready: ${summary.datasetStatusReady ? 'yes' : 'no'}`,
    `Segments: reported ${summary.reportedSegmentsCount ?? 'missing'}, map ${summary.mapSegmentCount}, map expected ${summary.expectedSegmentsCount ?? '>0'}`,
    `Parking spaces: reported ${summary.reportedParkingSpacesCount ?? 'missing'}, map ${summary.mapParkingSpaceCount}, expected ${summary.expectedParkingSpacesCount ?? '>0'}`,
    `Fallback: ${summary.hasFallback ? 'visible' : 'not visible'}`,
    `Skeleton: ${summary.hasSkeleton ? 'visible' : 'not visible'}`,
    summary.missingText.length > 0
      ? `Missing text: ${summary.missingText.join('; ')}`
      : 'Missing text: none',
    summary.bodySnippet ? `Body snippet: ${summary.bodySnippet}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

export const runSmokeUiMapView = async (
  options: SmokeUiMapViewOptions = {},
) => {
  let appUrl = options.appUrl ?? DEFAULT_APP_URL
  const district = options.district?.trim() || DEFAULT_DISTRICT
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
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

    const url = buildSmokeUiMapViewUrl({ appUrl, district })
    const expectedCounts =
      options.datasetMetaUrl === null
        ? {
            expectedSegmentsCount: null,
            expectedParkingSpacesCount: null,
          }
        : await fetchSmokeUiMapViewDatasetCounts(
            options.datasetMetaUrl ??
              buildSmokeUiMapViewDatasetMetaUrl({ appUrl, district }),
          )
    launchedChrome = await launchChrome({ chromePath, cdpPort })
    await waitForCdp(cdpPort, timeoutMs)
    client = await connectCdp(await openCdpTab(cdpPort))
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Page.navigate', { url })

    const summary = await waitForSmokeUiMapView({
      client,
      appUrl,
      url,
      district,
      expectedCounts,
      timeoutMs,
    })
    const errors = validateSmokeUiMapViewSummary(summary)
    if (errors.length > 0) {
      throw new Error(
        [
          'UI map smoke failed:',
          ...errors,
          '',
          renderSmokeUiMapViewSummary(summary),
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
  const summary = await runSmokeUiMapView(
    parseSmokeUiMapViewArgs(process.argv),
  )
  console.log('UI map smoke ok')
  console.log(renderSmokeUiMapViewSummary(summary))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
