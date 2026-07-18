import * as fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  buildSmokeUiPaidCurbReferenceSummary,
  buildSmokeUiPaidCurbReferenceUrl,
  loadSmokeUiPaidCurbReferenceFixture,
  parseSmokeUiPaidCurbReferenceArgs,
  renderSmokeUiPaidCurbReferenceSummary,
  validateSmokeUiPaidCurbReferenceSummary,
  type PaidCurbReferenceSmokeFixture,
} from './smokeUiPaidCurbReference'

const fixture: PaidCurbReferenceSmokeFixture = {
  referenceDistrict: 'taoyuan-district',
  coverageStage: 'source-only',
  address: 'Taoyuan paid-curb smoke address',
  latitude: 24.99493,
  longitude: 121.30074,
  availableSourceId: '169',
  availableSourceDescription: 'Available road',
  availableQuery: 'Available road',
  expectedCoordinates: '24.994930, 121.300740',
  excludedSourceId: '177',
  excludedQuery: 'Excluded road',
  expectedSourceRecordCount: 270,
  expectedReferencePointCount: 264,
  expectedExcludedPointCount: 6,
}

const buildPassingSummary = () =>
  buildSmokeUiPaidCurbReferenceSummary({
    appUrl: 'http://127.0.0.1:4173',
    url: 'http://127.0.0.1:4173/?dataset=xinyi',
    district: 'xinyi',
    fixture,
    list: {
      bodyText: 'Mode: List only',
      listMode: true,
      sourceRecordCount: 270,
      referencePointCount: 264,
      excludedPointCount: 6,
      availableRowFound: true,
      availableActionFound: true,
      queryValue: fixture.availableQuery,
    },
    map: {
      bodyText: 'Mode: Map + list NOT EVALUATED',
      mapMode: true,
      coverageDistrict: 'taoyuan-district',
      coverageStage: 'source-only',
      referencePointCount: 264,
      selectedReferenceId: '169',
      selectedActionPressed: true,
      addressValue: fixture.address,
      mapDetailFound: true,
      mapDetailHasSafetyBoundary: true,
      mapDetailHasExpectedRecord: true,
      outsideCoverageNotEvaluated: true,
    },
    excluded: {
      bodyText: 'Source ID 177',
      excludedRowFound: true,
      excludedActionCount: 0,
      excludedBoundaryNoteFound: true,
      queryValue: fixture.excludedQuery,
      selectionCleared: true,
    },
  })

describe('smokeUiPaidCurbReference', () => {
  it('parses preview smoke options', () => {
    expect(
      parseSmokeUiPaidCurbReferenceArgs([
        'node',
        'smokeUiPaidCurbReference',
        '--app-url',
        'http://127.0.0.1:4174',
        '--district',
        'xinyi',
        '--reference-district',
        'guishan',
        '--chrome-path',
        'C:\\Chrome\\chrome.exe',
        '--cdp-port',
        '9333',
        '--timeout-ms',
        '30000',
        '--start-preview',
        '--preview-port',
        '4180',
      ]),
    ).toEqual({
      appUrl: 'http://127.0.0.1:4174',
      district: 'xinyi',
      referenceDistrict: 'guishan',
      chromePath: 'C:\\Chrome\\chrome.exe',
      cdpPort: 9333,
      timeoutMs: 30000,
      startPreview: true,
      previewPort: 4180,
    })
  })

  it('loads a deterministic Guishan fixture from reviewed runtime packs', async () => {
    const guishan = await loadSmokeUiPaidCurbReferenceFixture('guishan')

    expect(guishan).toMatchObject({
      referenceDistrict: 'guishan',
      coverageStage: 'source-only',
      availableSourceId: '336',
      excludedSourceId: '340',
      expectedSourceRecordCount: 141,
      expectedReferencePointCount: 90,
      expectedExcludedPointCount: 51,
      latitude: 25.05945,
      longitude: 121.36794,
      expectedCoordinates: '25.059450, 121.367940',
    })
  })

  it('builds a district-driven shared-link scenario', () => {
    const url = new URL(
      buildSmokeUiPaidCurbReferenceUrl({
        appUrl: 'http://127.0.0.1:4173/app?existing=1',
        district: 'xinyi',
        fixture,
      }),
    )

    expect(url.pathname).toBe('/app')
    expect(url.searchParams.get('existing')).toBe('1')
    expect(url.searchParams.get('dataset')).toBe('xinyi')
    expect(url.searchParams.get('address')).toBe(fixture.address)
    expect(url.searchParams.get('lat')).toBe('24.99493')
    expect(url.searchParams.get('lng')).toBe('121.30074')
    expect(url.searchParams.get('view')).toBe('LIST')
  })

  it('runs both district smokes only after fixture data is built', async () => {
    const workflow = await fs.readFile('.github/workflows/ci.yml', 'utf-8')
    const ingestPosition = workflow.indexOf('name: Ingest CI fixtures')
    const fixtureBuildPosition = workflow.indexOf('name: Build UI with CI fixtures')
    const taoyuanSmokePosition = workflow.indexOf(
      'name: Smoke Taoyuan District paid-curb reference UI',
    )
    const guishanSmokePosition = workflow.indexOf(
      'name: Smoke Guishan paid-curb reference UI',
    )

    expect(ingestPosition).toBeGreaterThanOrEqual(0)
    expect(fixtureBuildPosition).toBeGreaterThan(ingestPosition)
    expect(taoyuanSmokePosition).toBeGreaterThan(fixtureBuildPosition)
    expect(guishanSmokePosition).toBeGreaterThan(taoyuanSmokePosition)
  })

  it('accepts the complete source-to-map and excluded-row contract', () => {
    const summary = buildPassingSummary()
    const rendered = renderSmokeUiPaidCurbReferenceSummary(summary)

    expect(summary.pass).toBe(true)
    expect(summary.errors).toEqual([])
    expect(rendered).toContain('UI paid-curb reference smoke: PASS')
    expect(rendered).toContain('Reference district: taoyuan-district')
    expect(rendered).toContain('Excluded source 177: text only')
  })

  it('reports safety, selection, and boundary regressions', () => {
    const summary = {
      ...buildPassingSummary(),
      pass: false,
      selectedReferenceId: null,
      addressPreserved: false,
      mapDetailHasSafetyBoundary: false,
      outsideCoverageNotEvaluated: false,
      excludedActionCount: 1,
      excludedBoundaryNoteFound: false,
      selectionCleared: false,
    }

    expect(validateSmokeUiPaidCurbReferenceSummary(summary)).toEqual([
      'selected reference missing does not match 169',
      'source-row map action changed the pinned address',
      'selected map detail is missing the non-legality safety boundary',
      'taoyuan-district pinned location was presented as a parking recommendation',
      'excluded source row 177 exposed 1 map actions',
      'excluded source row 177 is missing its boundary-review note',
      'closing the reference detail did not clear the map selection',
    ])
  })
})
