import * as fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  buildSmokeUiPaidCurbReferenceSummary,
  buildSmokeUiPaidCurbReferenceUrl,
  parseSmokeUiPaidCurbReferenceArgs,
  renderSmokeUiPaidCurbReferenceSummary,
  validateSmokeUiPaidCurbReferenceSummary,
} from './smokeUiPaidCurbReference'

const buildPassingSummary = () =>
  buildSmokeUiPaidCurbReferenceSummary({
    appUrl: 'http://127.0.0.1:4173',
    url: 'http://127.0.0.1:4173/?dataset=xinyi',
    district: 'xinyi',
    list: {
      bodyText: 'Mode: List only',
      listMode: true,
      sourceRecordCount: 270,
      referencePointCount: 264,
      excludedPointCount: 6,
      availableRowFound: true,
      availableActionFound: true,
      queryValue: '縣府路',
    },
    map: {
      bodyText: 'Mode: Map + list NOT EVALUATED',
      mapMode: true,
      coverageDistrict: 'taoyuan-district',
      coverageStage: 'source-only',
      referencePointCount: 264,
      selectedReferenceId: '169',
      selectedActionPressed: true,
      addressValue: '桃園市桃園區縣府路1號',
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
      queryValue: '民族路',
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
      chromePath: 'C:\\Chrome\\chrome.exe',
      cdpPort: 9333,
      timeoutMs: 30000,
      startPreview: true,
      previewPort: 4180,
    })
  })

  it('builds the fixed Taoyuan shared-link scenario', () => {
    const url = new URL(
      buildSmokeUiPaidCurbReferenceUrl({
        appUrl: 'http://127.0.0.1:4173/app?existing=1',
        district: 'xinyi',
      }),
    )

    expect(url.pathname).toBe('/app')
    expect(url.searchParams.get('existing')).toBe('1')
    expect(url.searchParams.get('dataset')).toBe('xinyi')
    expect(url.searchParams.get('address')).toBe('桃園市桃園區縣府路1號')
    expect(url.searchParams.get('lat')).toBe('24.99493')
    expect(url.searchParams.get('lng')).toBe('121.30074')
    expect(url.searchParams.get('view')).toBe('LIST')
  })

  it('runs the CI smoke only after fixture data is built into the app', async () => {
    const workflow = await fs.readFile('.github/workflows/ci.yml', 'utf-8')
    const ingestPosition = workflow.indexOf('name: Ingest CI fixtures')
    const fixtureBuildPosition = workflow.indexOf('name: Build UI with CI fixtures')
    const smokePosition = workflow.indexOf(
      'name: Smoke Taoyuan paid-curb reference UI',
    )

    expect(ingestPosition).toBeGreaterThanOrEqual(0)
    expect(fixtureBuildPosition).toBeGreaterThan(ingestPosition)
    expect(smokePosition).toBeGreaterThan(fixtureBuildPosition)
  })

  it('accepts the complete source-to-map and excluded-row contract', () => {
    const summary = buildPassingSummary()

    expect(summary.pass).toBe(true)
    expect(summary.errors).toEqual([])
    expect(renderSmokeUiPaidCurbReferenceSummary(summary)).toContain(
      'UI paid-curb reference smoke: PASS',
    )
    expect(renderSmokeUiPaidCurbReferenceSummary(summary)).toContain(
      'Excluded source 177: text only',
    )
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
      'Taoyuan pinned location was presented as a parking recommendation',
      'excluded source row 177 exposed 1 map actions',
      'excluded source row 177 is missing its boundary-review note',
      'closing the reference detail did not clear the map selection',
    ])
  })
})
