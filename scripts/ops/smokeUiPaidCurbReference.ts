import { fileURLToPath } from 'node:url'
import {
  assertSmokeUiAppReachable,
  chooseAvailablePort,
  connectCdp,
  launchChrome,
  launchPreview,
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

export interface SmokeUiPaidCurbReferenceOptions {
  appUrl?: string
  district?: string
  chromePath?: string
  cdpPort?: number
  timeoutMs?: number
  startPreview?: boolean
  previewPort?: number
}

export interface SmokeUiPaidCurbReferenceSummary {
  appUrl: string
  url: string
  district: string
  pass: boolean
  sourceRecordCount: number | null
  referencePointCount: number | null
  excludedPointCount: number | null
  initialListMode: boolean
  availableRowFound: boolean
  availableActionFound: boolean
  mapMode: boolean
  coverageDistrict: string | null
  coverageStage: string | null
  selectedReferenceId: string | null
  selectedActionPressed: boolean
  addressPreserved: boolean
  mapDetailFound: boolean
  mapDetailHasSafetyBoundary: boolean
  mapDetailHasExpectedRecord: boolean
  outsideCoverageNotEvaluated: boolean
  excludedRowFound: boolean
  excludedActionCount: number
  excludedBoundaryNoteFound: boolean
  selectionCleared: boolean
  errors: string[]
  bodySnippet: string
}

interface PaidCurbReferenceListState {
  bodyText: string
  listMode: boolean
  sourceRecordCount: number | null
  referencePointCount: number | null
  excludedPointCount: number | null
  availableRowFound: boolean
  availableActionFound: boolean
  queryValue: string
}

interface PaidCurbReferenceMapState {
  bodyText: string
  mapMode: boolean
  coverageDistrict: string | null
  coverageStage: string | null
  referencePointCount: number | null
  selectedReferenceId: string | null
  selectedActionPressed: boolean
  addressValue: string
  mapDetailFound: boolean
  mapDetailHasSafetyBoundary: boolean
  mapDetailHasExpectedRecord: boolean
  outsideCoverageNotEvaluated: boolean
}

interface PaidCurbReferenceExcludedState {
  bodyText: string
  excludedRowFound: boolean
  excludedActionCount: number
  excludedBoundaryNoteFound: boolean
  queryValue: string
  selectionCleared: boolean
}

const DEFAULT_APP_URL = 'http://127.0.0.1:4173'
const DEFAULT_DISTRICT = 'xinyi'
const DEFAULT_TIMEOUT_MS = 25_000
const TAOYUAN_ADDRESS = '桃園市桃園區縣府路1號'
const TAOYUAN_LATITUDE = 24.99493
const TAOYUAN_LONGITUDE = 121.30074
const AVAILABLE_SOURCE_ID = '169'
const AVAILABLE_SOURCE_DESCRIPTION =
  '縣府路園區(桃園區公所-民安路含調查局周邊)'
const EXCLUDED_SOURCE_ID = '177'
const EXPECTED_SOURCE_RECORD_COUNT = 270
const EXPECTED_REFERENCE_POINT_COUNT = 264
const EXPECTED_EXCLUDED_POINT_COUNT = 6
const EXPECTED_COVERAGE_DISTRICT = 'taoyuan-district'
const EXPECTED_COVERAGE_STAGE = 'source-only'
const EXPECTED_COORDINATES = '24.994930, 121.300740'

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

export const parseSmokeUiPaidCurbReferenceArgs = (
  argv: string[],
): SmokeUiPaidCurbReferenceOptions => ({
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
})

export const buildSmokeUiPaidCurbReferenceUrl = (params: {
  appUrl: string
  district: string
}) => {
  const url = new URL(params.appUrl)
  url.searchParams.set('dataset', params.district)
  url.searchParams.set('address', TAOYUAN_ADDRESS)
  url.searchParams.set('lat', String(TAOYUAN_LATITUDE))
  url.searchParams.set('lng', String(TAOYUAN_LONGITUDE))
  url.searchParams.set('view', 'LIST')
  return url.toString()
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getStringField = (record: unknown, field: string) =>
  isRecord(record) && typeof record[field] === 'string'
    ? record[field]
    : null

const getBooleanField = (record: unknown, field: string) =>
  isRecord(record) && record[field] === true

const getNumberField = (record: unknown, field: string) =>
  isRecord(record) &&
  typeof record[field] === 'number' &&
  Number.isFinite(record[field])
    ? record[field]
    : null

const bodySnippet = (bodyText: string) =>
  bodyText.replace(/\s+/g, ' ').trim().slice(0, 280)

const evaluateByValue = async (
  client: CdpClient,
  expression: string,
): Promise<Record<string, unknown>> => {
  const result = await client.send<RuntimeEvaluateResult>('Runtime.evaluate', {
    expression,
    returnByValue: true,
  })
  return isRecord(result.result?.value) ? result.result.value : {}
}

const readListState = async (
  client: CdpClient,
): Promise<PaidCurbReferenceListState> => {
  const value = await evaluateByValue(
    client,
    `(() => {
      const bodyText = document.body ? document.body.innerText : '';
      const panel = document.querySelector('.paid-curb-reference-panel');
      const panelText = panel?.innerText ?? '';
      const sourceCount = panelText.match(/([0-9,]+)\\s+district records?/i);
      const pointCounts = panelText.match(
        /map shows\\s+([0-9,]+)\\s+reviewed TDX representative points;\\s+([0-9,]+)\\s+out-of-boundary points are excluded/i
      );
      const row = Array.from(document.querySelectorAll('.paid-curb-reference-row')).find(
        (candidate) =>
          candidate.querySelector('.paid-curb-reference-row-meta')?.textContent?.trim() ===
          ${JSON.stringify(`Source ID ${AVAILABLE_SOURCE_ID}`)}
      );
      const query = panel?.querySelector('.paid-curb-reference-search input');
      return {
        bodyText,
        listMode: bodyText.includes('Mode: List only'),
        sourceRecordCount: sourceCount
          ? Number(sourceCount[1].replace(/,/g, ''))
          : null,
        referencePointCount: pointCounts
          ? Number(pointCounts[1].replace(/,/g, ''))
          : null,
        excludedPointCount: pointCounts
          ? Number(pointCounts[2].replace(/,/g, ''))
          : null,
        availableRowFound: Boolean(row),
        availableActionFound: Boolean(
          row?.querySelector('.paid-curb-reference-map-action')
        ),
        queryValue: query instanceof HTMLInputElement ? query.value : '',
      };
    })()`,
  )
  return {
    bodyText: getStringField(value, 'bodyText') ?? '',
    listMode: getBooleanField(value, 'listMode'),
    sourceRecordCount: getNumberField(value, 'sourceRecordCount'),
    referencePointCount: getNumberField(value, 'referencePointCount'),
    excludedPointCount: getNumberField(value, 'excludedPointCount'),
    availableRowFound: getBooleanField(value, 'availableRowFound'),
    availableActionFound: getBooleanField(value, 'availableActionFound'),
    queryValue: getStringField(value, 'queryValue') ?? '',
  }
}

const clickAvailableReference = async (client: CdpClient) => {
  const value = await evaluateByValue(
    client,
    `(() => {
      const row = Array.from(document.querySelectorAll('.paid-curb-reference-row')).find(
        (candidate) =>
          candidate.querySelector('.paid-curb-reference-row-meta')?.textContent?.trim() ===
          ${JSON.stringify(`Source ID ${AVAILABLE_SOURCE_ID}`)}
      );
      const button = row?.querySelector('.paid-curb-reference-map-action');
      if (!(button instanceof HTMLButtonElement)) {
        return { clicked: false };
      }
      button.click();
      return { clicked: true };
    })()`,
  )
  if (!getBooleanField(value, 'clicked')) {
    throw new Error(
      `Paid-curb source ${AVAILABLE_SOURCE_ID} did not expose a clickable map action.`,
    )
  }
}

const readMapState = async (
  client: CdpClient,
): Promise<PaidCurbReferenceMapState> => {
  const value = await evaluateByValue(
    client,
    `(() => {
      const bodyText = document.body ? document.body.innerText : '';
      const root = document.querySelector('.map-root-shell');
      const detail = document.querySelector('.map-paid-curb-detail');
      const detailText = detail?.innerText ?? '';
      const normalizedDetailText = detailText.replace(/\\s+/g, ' ').trim();
      const row = Array.from(document.querySelectorAll('.paid-curb-reference-row')).find(
        (candidate) =>
          candidate.querySelector('.paid-curb-reference-row-meta')?.textContent?.trim() ===
          ${JSON.stringify(`Source ID ${AVAILABLE_SOURCE_ID}`)}
      );
      const action = row?.querySelector('.paid-curb-reference-map-action');
      const address = document.querySelector('input[placeholder="Address or place"]');
      const referenceCount = Number(
        root?.getAttribute('data-paid-curb-reference-count')
      );
      return {
        bodyText,
        mapMode: bodyText.includes('Mode: Map + list'),
        coverageDistrict: root?.getAttribute('data-coverage-district') ?? null,
        coverageStage: root?.getAttribute('data-coverage-stage') ?? null,
        referencePointCount: Number.isFinite(referenceCount)
          ? referenceCount
          : null,
        selectedReferenceId:
          root?.getAttribute('data-paid-curb-reference-selected') ?? null,
        selectedActionPressed: action?.getAttribute('aria-pressed') === 'true',
        addressValue: address instanceof HTMLInputElement ? address.value : '',
        mapDetailFound: Boolean(detail),
        mapDetailHasSafetyBoundary:
          normalizedDetailText.includes('Reference point only') &&
          normalizedDetailText.includes('not exact curb geometry') &&
          normalizedDetailText.includes('parking legality answer'),
        mapDetailHasExpectedRecord:
          normalizedDetailText.includes(${JSON.stringify(AVAILABLE_SOURCE_DESCRIPTION)}) &&
          normalizedDetailText.includes(${JSON.stringify(`Segment ID ${AVAILABLE_SOURCE_ID}`)}) &&
          normalizedDetailText.includes(${JSON.stringify(EXPECTED_COORDINATES)}),
        outsideCoverageNotEvaluated:
          bodyText.includes('NOT EVALUATED') &&
          bodyText.includes(
            "No parking recommendation was calculated from another district's data."
          ),
      };
    })()`,
  )
  return {
    bodyText: getStringField(value, 'bodyText') ?? '',
    mapMode: getBooleanField(value, 'mapMode'),
    coverageDistrict: getStringField(value, 'coverageDistrict'),
    coverageStage: getStringField(value, 'coverageStage'),
    referencePointCount: getNumberField(value, 'referencePointCount'),
    selectedReferenceId: getStringField(value, 'selectedReferenceId'),
    selectedActionPressed: getBooleanField(value, 'selectedActionPressed'),
    addressValue: getStringField(value, 'addressValue') ?? '',
    mapDetailFound: getBooleanField(value, 'mapDetailFound'),
    mapDetailHasSafetyBoundary: getBooleanField(
      value,
      'mapDetailHasSafetyBoundary',
    ),
    mapDetailHasExpectedRecord: getBooleanField(
      value,
      'mapDetailHasExpectedRecord',
    ),
    outsideCoverageNotEvaluated: getBooleanField(
      value,
      'outsideCoverageNotEvaluated',
    ),
  }
}

const closeDetailAndFilterExcludedReference = async (client: CdpClient) => {
  const value = await evaluateByValue(
    client,
    `(() => {
      const close = document.querySelector('.map-paid-curb-detail-close');
      const input = document.querySelector('.paid-curb-reference-search input');
      if (!(close instanceof HTMLButtonElement) || !(input instanceof HTMLInputElement)) {
        return { changed: false };
      }
      close.click();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, '民族路');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { changed: true };
    })()`,
  )
  if (!getBooleanField(value, 'changed')) {
    throw new Error(
      'Paid-curb reference detail could not be closed or its source filter was unavailable.',
    )
  }
}

const readExcludedState = async (
  client: CdpClient,
): Promise<PaidCurbReferenceExcludedState> => {
  const value = await evaluateByValue(
    client,
    `(() => {
      const bodyText = document.body ? document.body.innerText : '';
      const root = document.querySelector('.map-root-shell');
      const row = Array.from(document.querySelectorAll('.paid-curb-reference-row')).find(
        (candidate) =>
          candidate.querySelector('.paid-curb-reference-row-meta')?.textContent?.trim() ===
          ${JSON.stringify(`Source ID ${EXCLUDED_SOURCE_ID}`)}
      );
      const note = row?.querySelector('.paid-curb-reference-point-note');
      const input = document.querySelector('.paid-curb-reference-search input');
      return {
        bodyText,
        excludedRowFound: Boolean(row),
        excludedActionCount:
          row?.querySelectorAll('.paid-curb-reference-map-action').length ?? 0,
        excludedBoundaryNoteFound:
          note?.textContent?.includes(
            'representative point was excluded by the official district-boundary review'
          ) ?? false,
        queryValue: input instanceof HTMLInputElement ? input.value : '',
        selectionCleared:
          !root?.hasAttribute('data-paid-curb-reference-selected') &&
          !document.querySelector('.map-paid-curb-detail'),
      };
    })()`,
  )
  return {
    bodyText: getStringField(value, 'bodyText') ?? '',
    excludedRowFound: getBooleanField(value, 'excludedRowFound'),
    excludedActionCount: getNumberField(value, 'excludedActionCount') ?? 0,
    excludedBoundaryNoteFound: getBooleanField(
      value,
      'excludedBoundaryNoteFound',
    ),
    queryValue: getStringField(value, 'queryValue') ?? '',
    selectionCleared: getBooleanField(value, 'selectionCleared'),
  }
}

const waitForState = async <T>(params: {
  read: () => Promise<T>
  isReady: (state: T) => boolean
  timeoutMs: number
}) => {
  const deadline = Date.now() + params.timeoutMs
  let state = await params.read()
  while (Date.now() < deadline) {
    if (params.isReady(state)) {
      return state
    }
    await wait(250)
    state = await params.read()
  }
  return state
}

const isPaidCurbReferenceMapReady = (
  state: PaidCurbReferenceMapState,
) =>
  state.mapMode &&
  state.selectedReferenceId === AVAILABLE_SOURCE_ID &&
  state.mapDetailFound &&
  state.mapDetailHasExpectedRecord

const buildUnavailableExcludedState = (
  bodyText: string,
): PaidCurbReferenceExcludedState => ({
  bodyText,
  excludedRowFound: false,
  excludedActionCount: 0,
  excludedBoundaryNoteFound: false,
  queryValue: '',
  selectionCleared: false,
})

export const validateSmokeUiPaidCurbReferenceSummary = (
  summary: SmokeUiPaidCurbReferenceSummary,
) => {
  const errors: string[] = []
  if (summary.sourceRecordCount !== EXPECTED_SOURCE_RECORD_COUNT) {
    errors.push(
      `source record count ${summary.sourceRecordCount ?? 'missing'} does not match ${EXPECTED_SOURCE_RECORD_COUNT}`,
    )
  }
  if (summary.referencePointCount !== EXPECTED_REFERENCE_POINT_COUNT) {
    errors.push(
      `reference point count ${summary.referencePointCount ?? 'missing'} does not match ${EXPECTED_REFERENCE_POINT_COUNT}`,
    )
  }
  if (summary.excludedPointCount !== EXPECTED_EXCLUDED_POINT_COUNT) {
    errors.push(
      `excluded point count ${summary.excludedPointCount ?? 'missing'} does not match ${EXPECTED_EXCLUDED_POINT_COUNT}`,
    )
  }
  if (!summary.initialListMode) {
    errors.push('initial shared link did not render LIST mode')
  }
  if (!summary.availableRowFound) {
    errors.push(`source row ${AVAILABLE_SOURCE_ID} was not rendered`)
  }
  if (!summary.availableActionFound) {
    errors.push(`source row ${AVAILABLE_SOURCE_ID} has no map action`)
  }
  if (!summary.mapMode) {
    errors.push('source map action did not switch to MAP mode')
  }
  if (summary.coverageDistrict !== EXPECTED_COVERAGE_DISTRICT) {
    errors.push(
      `coverage district ${summary.coverageDistrict ?? 'missing'} does not match ${EXPECTED_COVERAGE_DISTRICT}`,
    )
  }
  if (summary.coverageStage !== EXPECTED_COVERAGE_STAGE) {
    errors.push(
      `coverage stage ${summary.coverageStage ?? 'missing'} does not match ${EXPECTED_COVERAGE_STAGE}`,
    )
  }
  if (summary.selectedReferenceId !== AVAILABLE_SOURCE_ID) {
    errors.push(
      `selected reference ${summary.selectedReferenceId ?? 'missing'} does not match ${AVAILABLE_SOURCE_ID}`,
    )
  }
  if (!summary.selectedActionPressed) {
    errors.push('selected source-row map action is not aria-pressed')
  }
  if (!summary.addressPreserved) {
    errors.push('source-row map action changed the pinned address')
  }
  if (!summary.mapDetailFound) {
    errors.push('selected paid-curb map detail was not rendered')
  }
  if (!summary.mapDetailHasSafetyBoundary) {
    errors.push('selected map detail is missing the non-legality safety boundary')
  }
  if (!summary.mapDetailHasExpectedRecord) {
    errors.push('selected map detail does not identify source 169 and its coordinates')
  }
  if (!summary.outsideCoverageNotEvaluated) {
    errors.push('Taoyuan pinned location was presented as a parking recommendation')
  }
  if (!summary.excludedRowFound) {
    errors.push(`excluded source row ${EXCLUDED_SOURCE_ID} was not rendered`)
  }
  if (summary.excludedActionCount !== 0) {
    errors.push(
      `excluded source row ${EXCLUDED_SOURCE_ID} exposed ${summary.excludedActionCount} map actions`,
    )
  }
  if (!summary.excludedBoundaryNoteFound) {
    errors.push(
      `excluded source row ${EXCLUDED_SOURCE_ID} is missing its boundary-review note`,
    )
  }
  if (!summary.selectionCleared) {
    errors.push('closing the reference detail did not clear the map selection')
  }
  return errors
}

export const buildSmokeUiPaidCurbReferenceSummary = (params: {
  appUrl: string
  url: string
  district: string
  list: PaidCurbReferenceListState
  map: PaidCurbReferenceMapState
  excluded: PaidCurbReferenceExcludedState
}): SmokeUiPaidCurbReferenceSummary => {
  const summary: SmokeUiPaidCurbReferenceSummary = {
    appUrl: params.appUrl,
    url: params.url,
    district: params.district,
    pass: false,
    sourceRecordCount: params.list.sourceRecordCount,
    referencePointCount:
      params.map.referencePointCount ?? params.list.referencePointCount,
    excludedPointCount: params.list.excludedPointCount,
    initialListMode: params.list.listMode,
    availableRowFound: params.list.availableRowFound,
    availableActionFound: params.list.availableActionFound,
    mapMode: params.map.mapMode,
    coverageDistrict: params.map.coverageDistrict,
    coverageStage: params.map.coverageStage,
    selectedReferenceId: params.map.selectedReferenceId,
    selectedActionPressed: params.map.selectedActionPressed,
    addressPreserved: params.map.addressValue === TAOYUAN_ADDRESS,
    mapDetailFound: params.map.mapDetailFound,
    mapDetailHasSafetyBoundary: params.map.mapDetailHasSafetyBoundary,
    mapDetailHasExpectedRecord: params.map.mapDetailHasExpectedRecord,
    outsideCoverageNotEvaluated: params.map.outsideCoverageNotEvaluated,
    excludedRowFound: params.excluded.excludedRowFound,
    excludedActionCount: params.excluded.excludedActionCount,
    excludedBoundaryNoteFound: params.excluded.excludedBoundaryNoteFound,
    selectionCleared: params.excluded.selectionCleared,
    errors: [],
    bodySnippet: bodySnippet(params.excluded.bodyText || params.map.bodyText),
  }
  summary.errors = validateSmokeUiPaidCurbReferenceSummary(summary)
  summary.pass = summary.errors.length === 0
  return summary
}

export const renderSmokeUiPaidCurbReferenceSummary = (
  summary: SmokeUiPaidCurbReferenceSummary,
) =>
  [
    `UI paid-curb reference smoke: ${summary.pass ? 'PASS' : 'FAIL'}`,
    `Active dataset: ${summary.district}`,
    `App: ${summary.appUrl}`,
    `URL: ${summary.url}`,
    `Taoyuan source records: ${summary.sourceRecordCount ?? 'missing'}`,
    `Reviewed points: ${summary.referencePointCount ?? 'missing'}`,
    `Boundary exclusions: ${summary.excludedPointCount ?? 'missing'}`,
    `Available source ${AVAILABLE_SOURCE_ID}: ${summary.availableRowFound && summary.availableActionFound ? 'map action available' : 'missing'}`,
    `Selected map reference: ${summary.selectedReferenceId ?? 'missing'}`,
    `Coverage boundary: ${summary.coverageDistrict ?? 'missing'} / ${summary.coverageStage ?? 'missing'}`,
    `Address preserved: ${summary.addressPreserved ? 'yes' : 'no'}`,
    `Safety boundary: ${summary.mapDetailHasSafetyBoundary && summary.outsideCoverageNotEvaluated ? 'preserved' : 'missing'}`,
    `Excluded source ${EXCLUDED_SOURCE_ID}: ${summary.excludedRowFound && summary.excludedActionCount === 0 && summary.excludedBoundaryNoteFound ? 'text only' : 'invalid'}`,
    summary.errors.length > 0
      ? `Errors: ${summary.errors.join('; ')}`
      : 'Errors: none',
    summary.bodySnippet ? `Body snippet: ${summary.bodySnippet}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

const assertSmokeUiPaidCurbReferenceSummary = (
  summary: SmokeUiPaidCurbReferenceSummary,
) => {
  if (summary.pass) {
    return
  }
  throw new Error(
    [
      'UI paid-curb reference smoke failed:',
      ...summary.errors,
      '',
      renderSmokeUiPaidCurbReferenceSummary(summary),
    ].join('\n'),
  )
}

export const runSmokeUiPaidCurbReference = async (
  options: SmokeUiPaidCurbReferenceOptions = {},
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
    const url = buildSmokeUiPaidCurbReferenceUrl({ appUrl, district })
    launchedChrome = await launchChrome({ chromePath, cdpPort })
    await waitForCdp(cdpPort, timeoutMs)
    client = await connectCdp(await openCdpTab(cdpPort))
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Page.navigate', { url })

    const list = await waitForState({
      read: () => readListState(client as CdpClient),
      isReady: (state) =>
        state.listMode &&
        state.queryValue === '縣府路' &&
        state.availableRowFound &&
        state.availableActionFound,
      timeoutMs,
    })
    await clickAvailableReference(client)

    const map = await waitForState({
      read: () => readMapState(client as CdpClient),
      isReady: isPaidCurbReferenceMapReady,
      timeoutMs,
    })
    if (!isPaidCurbReferenceMapReady(map)) {
      const summary = buildSmokeUiPaidCurbReferenceSummary({
        appUrl,
        url,
        district,
        list,
        map,
        excluded: buildUnavailableExcludedState(map.bodyText),
      })
      assertSmokeUiPaidCurbReferenceSummary(summary)
    }
    await closeDetailAndFilterExcludedReference(client)

    const excluded = await waitForState({
      read: () => readExcludedState(client as CdpClient),
      isReady: (state) =>
        state.queryValue === '民族路' &&
        state.excludedRowFound &&
        state.excludedBoundaryNoteFound &&
        state.selectionCleared,
      timeoutMs,
    })
    const summary = buildSmokeUiPaidCurbReferenceSummary({
      appUrl,
      url,
      district,
      list,
      map,
      excluded,
    })
    assertSmokeUiPaidCurbReferenceSummary(summary)
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
  const summary = await runSmokeUiPaidCurbReference(
    parseSmokeUiPaidCurbReferenceArgs(process.argv),
  )
  console.log('UI paid-curb reference smoke ok')
  console.log(renderSmokeUiPaidCurbReferenceSummary(summary))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
