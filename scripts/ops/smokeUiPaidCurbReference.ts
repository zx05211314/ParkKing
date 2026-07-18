import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRuntimeCoverageCatalog } from '../../src/data/coverageCatalog'
import {
  parsePaidCurbReferencePack,
  type PaidCurbReferenceRecord,
} from '../../src/data/paidCurbReference'
import { parsePaidCurbSpatialReferencePack } from '../../src/data/paidCurbSpatialReference'
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
  referenceDistrict?: string
  chromePath?: string
  cdpPort?: number
  timeoutMs?: number
  startPreview?: boolean
  previewPort?: number
}

export interface PaidCurbReferenceSmokeFixture {
  referenceDistrict: string
  coverageStage: string
  address: string
  latitude: number
  longitude: number
  availableSourceId: string
  availableSourceDescription: string
  availableQuery: string
  expectedCoordinates: string
  excludedSourceId: string
  excludedQuery: string
  expectedSourceRecordCount: number
  expectedReferencePointCount: number
  expectedExcludedPointCount: number
}

export interface SmokeUiPaidCurbReferenceSummary {
  appUrl: string
  url: string
  district: string
  referenceDistrict: string
  availableSourceId: string
  excludedSourceId: string
  expectedSourceRecordCount: number
  expectedReferencePointCount: number
  expectedExcludedPointCount: number
  expectedCoverageStage: string
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
const DEFAULT_REFERENCE_DISTRICT = 'taoyuan-district'
const DEFAULT_TIMEOUT_MS = 25_000

const readJson = async (filePath: string): Promise<unknown> =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown

const resolvePublicDataPath = (publicRoot: string, url: string) =>
  path.join(publicRoot, ...url.replace(/^\/+/, '').split('/'))

const compareSourceIds = (
  left: { parkingSegmentId: string },
  right: { parkingSegmentId: string },
) => left.parkingSegmentId.localeCompare(right.parkingSegmentId, 'en')

const requireRecord = (
  records: PaidCurbReferenceRecord[],
  parkingSegmentId: string,
  context: string,
) => {
  const record = records.find(
    (candidate) => candidate.parkingSegmentId === parkingSegmentId,
  )
  if (!record) {
    throw new Error(
      `${context} source ${parkingSegmentId} is missing from the text pack`,
    )
  }
  return record
}

export const loadSmokeUiPaidCurbReferenceFixture = async (
  referenceDistrict: string,
  publicRoot = path.join(process.cwd(), 'public'),
): Promise<PaidCurbReferenceSmokeFixture> => {
  const coverage = parseRuntimeCoverageCatalog(
    await readJson(path.join(publicRoot, 'data', 'coverage.json')),
  )
  const coverageDistrict = coverage.districts.find(
    (candidate) => candidate.districtId === referenceDistrict,
  )
  const referenceData = coverageDistrict?.referenceData
  const spatialReference = referenceData?.spatialReference
  if (!coverageDistrict || !referenceData || !spatialReference) {
    throw new Error(
      `Reference district ${referenceDistrict} has no runtime paid-curb spatial pack`,
    )
  }

  const textPack = parsePaidCurbReferencePack(
    await readJson(resolvePublicDataPath(publicRoot, referenceData.url)),
  )
  const spatialPack = parsePaidCurbSpatialReferencePack(
    await readJson(resolvePublicDataPath(publicRoot, spatialReference.url)),
  )
  const textDistrict = textPack.districts.find(
    (candidate) => candidate.districtId === referenceDistrict,
  )
  if (!textDistrict) {
    throw new Error(
      `Reference district ${referenceDistrict} is missing from the text pack`,
    )
  }
  if (
    spatialPack.metadata.districtId !== referenceDistrict ||
    referenceData.recordCount !== textDistrict.recordCount ||
    spatialReference.featureCount !== spatialPack.metadata.featureCount ||
    spatialReference.excludedFeatureCount !==
      spatialPack.metadata.excludedFeatureCount
  ) {
    throw new Error(
      `Reference district ${referenceDistrict} runtime metadata does not match its packs`,
    )
  }

  const availableFeature = [...spatialPack.features].sort((left, right) =>
    compareSourceIds(left.properties, right.properties),
  )[0]
  const excluded = [...spatialPack.metadata.excluded].sort(compareSourceIds)[0]
  if (!availableFeature || !excluded) {
    throw new Error(
      `Reference district ${referenceDistrict} needs at least one mapped and one excluded source`,
    )
  }

  const availableRecord = requireRecord(
    textDistrict.records,
    availableFeature.properties.parkingSegmentId,
    referenceDistrict,
  )
  const excludedRecord = requireRecord(
    textDistrict.records,
    excluded.parkingSegmentId,
    referenceDistrict,
  )
  if (availableFeature.properties.description !== availableRecord.description) {
    throw new Error(
      `Reference district ${referenceDistrict} mapped source text does not match the text pack`,
    )
  }
  const [longitude, latitude] = availableFeature.geometry.coordinates
  return {
    referenceDistrict,
    coverageStage: coverageDistrict.publishStage,
    address: `${availableRecord.sourceTownName}${availableRecord.description}`,
    latitude,
    longitude,
    availableSourceId: availableRecord.parkingSegmentId,
    availableSourceDescription: availableRecord.description,
    availableQuery: availableRecord.description,
    expectedCoordinates: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    excludedSourceId: excludedRecord.parkingSegmentId,
    excludedQuery: excludedRecord.description,
    expectedSourceRecordCount: textDistrict.recordCount,
    expectedReferencePointCount: spatialPack.metadata.featureCount,
    expectedExcludedPointCount: spatialPack.metadata.excludedFeatureCount,
  }
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
  referenceDistrict:
    getArgValue(argv, '--reference-district', '--referenceDistrict') ??
    DEFAULT_REFERENCE_DISTRICT,
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
  fixture: PaidCurbReferenceSmokeFixture
}) => {
  const url = new URL(params.appUrl)
  url.searchParams.set('dataset', params.district)
  url.searchParams.set('address', params.fixture.address)
  url.searchParams.set('lat', String(params.fixture.latitude))
  url.searchParams.set('lng', String(params.fixture.longitude))
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
  fixture: PaidCurbReferenceSmokeFixture,
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
          ${JSON.stringify(`Source ID ${fixture.availableSourceId}`)}
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

const setPaidCurbReferenceQuery = async (
  client: CdpClient,
  query: string,
) => {
  const value = await evaluateByValue(
    client,
    `(() => {
      const input = document.querySelector('.paid-curb-reference-search input');
      if (!(input instanceof HTMLInputElement)) {
        return { changed: false };
      }
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, ${JSON.stringify(query)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { changed: true };
    })()`,
  )
  if (!getBooleanField(value, 'changed')) {
    throw new Error('Paid-curb source filter is unavailable.')
  }
}

const clickAvailableReference = async (
  client: CdpClient,
  fixture: PaidCurbReferenceSmokeFixture,
) => {
  const value = await evaluateByValue(
    client,
    `(() => {
      const row = Array.from(document.querySelectorAll('.paid-curb-reference-row')).find(
        (candidate) =>
          candidate.querySelector('.paid-curb-reference-row-meta')?.textContent?.trim() ===
          ${JSON.stringify(`Source ID ${fixture.availableSourceId}`)}
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
      `Paid-curb source ${fixture.availableSourceId} did not expose a clickable map action.`,
    )
  }
}

const readMapState = async (
  client: CdpClient,
  fixture: PaidCurbReferenceSmokeFixture,
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
          ${JSON.stringify(`Source ID ${fixture.availableSourceId}`)}
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
          normalizedDetailText.includes(${JSON.stringify(fixture.availableSourceDescription)}) &&
          normalizedDetailText.includes(${JSON.stringify(`Segment ID ${fixture.availableSourceId}`)}) &&
          normalizedDetailText.includes(${JSON.stringify(fixture.expectedCoordinates)}),
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

const closeDetailAndFilterExcludedReference = async (
  client: CdpClient,
  fixture: PaidCurbReferenceSmokeFixture,
) => {
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
      setter?.call(input, ${JSON.stringify(fixture.excludedQuery)});
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
  fixture: PaidCurbReferenceSmokeFixture,
): Promise<PaidCurbReferenceExcludedState> => {
  const value = await evaluateByValue(
    client,
    `(() => {
      const bodyText = document.body ? document.body.innerText : '';
      const root = document.querySelector('.map-root-shell');
      const row = Array.from(document.querySelectorAll('.paid-curb-reference-row')).find(
        (candidate) =>
          candidate.querySelector('.paid-curb-reference-row-meta')?.textContent?.trim() ===
          ${JSON.stringify(`Source ID ${fixture.excludedSourceId}`)}
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
  fixture: PaidCurbReferenceSmokeFixture,
) =>
  state.mapMode &&
  state.selectedReferenceId === fixture.availableSourceId &&
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
  if (summary.sourceRecordCount !== summary.expectedSourceRecordCount) {
    errors.push(
      `source record count ${summary.sourceRecordCount ?? 'missing'} does not match ${summary.expectedSourceRecordCount}`,
    )
  }
  if (summary.referencePointCount !== summary.expectedReferencePointCount) {
    errors.push(
      `reference point count ${summary.referencePointCount ?? 'missing'} does not match ${summary.expectedReferencePointCount}`,
    )
  }
  if (summary.excludedPointCount !== summary.expectedExcludedPointCount) {
    errors.push(
      `excluded point count ${summary.excludedPointCount ?? 'missing'} does not match ${summary.expectedExcludedPointCount}`,
    )
  }
  if (!summary.initialListMode) {
    errors.push('initial shared link did not render LIST mode')
  }
  if (!summary.availableRowFound) {
    errors.push(`source row ${summary.availableSourceId} was not rendered`)
  }
  if (!summary.availableActionFound) {
    errors.push(`source row ${summary.availableSourceId} has no map action`)
  }
  if (!summary.mapMode) {
    errors.push('source map action did not switch to MAP mode')
  }
  if (summary.coverageDistrict !== summary.referenceDistrict) {
    errors.push(
      `coverage district ${summary.coverageDistrict ?? 'missing'} does not match ${summary.referenceDistrict}`,
    )
  }
  if (summary.coverageStage !== summary.expectedCoverageStage) {
    errors.push(
      `coverage stage ${summary.coverageStage ?? 'missing'} does not match ${summary.expectedCoverageStage}`,
    )
  }
  if (summary.selectedReferenceId !== summary.availableSourceId) {
    errors.push(
      `selected reference ${summary.selectedReferenceId ?? 'missing'} does not match ${summary.availableSourceId}`,
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
    errors.push(
      `selected map detail does not identify source ${summary.availableSourceId} and its coordinates`,
    )
  }
  if (!summary.outsideCoverageNotEvaluated) {
    errors.push(
      `${summary.referenceDistrict} pinned location was presented as a parking recommendation`,
    )
  }
  if (!summary.excludedRowFound) {
    errors.push(
      `excluded source row ${summary.excludedSourceId} was not rendered`,
    )
  }
  if (summary.excludedActionCount !== 0) {
    errors.push(
      `excluded source row ${summary.excludedSourceId} exposed ${summary.excludedActionCount} map actions`,
    )
  }
  if (!summary.excludedBoundaryNoteFound) {
    errors.push(
      `excluded source row ${summary.excludedSourceId} is missing its boundary-review note`,
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
  fixture: PaidCurbReferenceSmokeFixture
  list: PaidCurbReferenceListState
  map: PaidCurbReferenceMapState
  excluded: PaidCurbReferenceExcludedState
}): SmokeUiPaidCurbReferenceSummary => {
  const summary: SmokeUiPaidCurbReferenceSummary = {
    appUrl: params.appUrl,
    url: params.url,
    district: params.district,
    referenceDistrict: params.fixture.referenceDistrict,
    availableSourceId: params.fixture.availableSourceId,
    excludedSourceId: params.fixture.excludedSourceId,
    expectedSourceRecordCount: params.fixture.expectedSourceRecordCount,
    expectedReferencePointCount: params.fixture.expectedReferencePointCount,
    expectedExcludedPointCount: params.fixture.expectedExcludedPointCount,
    expectedCoverageStage: params.fixture.coverageStage,
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
    addressPreserved: params.map.addressValue === params.fixture.address,
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
    `Reference district: ${summary.referenceDistrict}`,
    `App: ${summary.appUrl}`,
    `URL: ${summary.url}`,
    `District source records: ${summary.sourceRecordCount ?? 'missing'}`,
    `Reviewed points: ${summary.referencePointCount ?? 'missing'}`,
    `Boundary exclusions: ${summary.excludedPointCount ?? 'missing'}`,
    `Available source ${summary.availableSourceId}: ${summary.availableRowFound && summary.availableActionFound ? 'map action available' : 'missing'}`,
    `Selected map reference: ${summary.selectedReferenceId ?? 'missing'}`,
    `Coverage boundary: ${summary.coverageDistrict ?? 'missing'} / ${summary.coverageStage ?? 'missing'}`,
    `Address preserved: ${summary.addressPreserved ? 'yes' : 'no'}`,
    `Safety boundary: ${summary.mapDetailHasSafetyBoundary && summary.outsideCoverageNotEvaluated ? 'preserved' : 'missing'}`,
    `Excluded source ${summary.excludedSourceId}: ${summary.excludedRowFound && summary.excludedActionCount === 0 && summary.excludedBoundaryNoteFound ? 'text only' : 'invalid'}`,
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
  const referenceDistrict =
    options.referenceDistrict?.trim() || DEFAULT_REFERENCE_DISTRICT
  const fixture =
    await loadSmokeUiPaidCurbReferenceFixture(referenceDistrict)
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
    const url = buildSmokeUiPaidCurbReferenceUrl({
      appUrl,
      district,
      fixture,
    })
    launchedChrome = await launchChrome({ chromePath, cdpPort })
    await waitForCdp(cdpPort, timeoutMs)
    client = await connectCdp(await openCdpTab(cdpPort))
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Page.navigate', { url })

    const initial = await waitForState({
      read: () => readListState(client as CdpClient, fixture),
      isReady: (state) =>
        state.listMode &&
        state.sourceRecordCount === fixture.expectedSourceRecordCount,
      timeoutMs,
    })
    if (initial.sourceRecordCount !== fixture.expectedSourceRecordCount) {
      throw new Error(
        `Paid-curb reference panel for ${referenceDistrict} did not load: ${bodySnippet(initial.bodyText)}`,
      )
    }
    await setPaidCurbReferenceQuery(client, fixture.availableQuery)
    const list = await waitForState({
      read: () => readListState(client as CdpClient, fixture),
      isReady: (state) =>
        state.listMode &&
        state.queryValue === fixture.availableQuery &&
        state.availableRowFound &&
        state.availableActionFound,
      timeoutMs,
    })
    await clickAvailableReference(client, fixture)

    const map = await waitForState({
      read: () => readMapState(client as CdpClient, fixture),
      isReady: (state) => isPaidCurbReferenceMapReady(state, fixture),
      timeoutMs,
    })
    if (!isPaidCurbReferenceMapReady(map, fixture)) {
      const summary = buildSmokeUiPaidCurbReferenceSummary({
        appUrl,
        url,
        district,
        fixture,
        list,
        map,
        excluded: buildUnavailableExcludedState(map.bodyText),
      })
      assertSmokeUiPaidCurbReferenceSummary(summary)
    }
    await closeDetailAndFilterExcludedReference(client, fixture)

    const excluded = await waitForState({
      read: () => readExcludedState(client as CdpClient, fixture),
      isReady: (state) =>
        state.queryValue === fixture.excludedQuery &&
        state.excludedRowFound &&
        state.excludedBoundaryNoteFound &&
        state.selectionCleared,
      timeoutMs,
    })
    const summary = buildSmokeUiPaidCurbReferenceSummary({
      appUrl,
      url,
      district,
      fixture,
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
