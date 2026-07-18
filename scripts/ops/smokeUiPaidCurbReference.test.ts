import * as fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  buildSmokeUiPaidCurbReferenceSummary,
  buildSmokeUiPaidCurbReferenceUrl,
  loadSmokeUiPaidCurbReferenceDistrictIds,
  loadSmokeUiPaidCurbReferenceFixture,
  parseSmokeUiPaidCurbReferenceArgs,
  renderSmokeUiPaidCurbReferenceMatrixSummary,
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

const zeroExclusionFixture: PaidCurbReferenceSmokeFixture = {
  ...fixture,
  referenceDistrict: 'yangmei',
  address: 'Yangmei paid-curb smoke address',
  availableSourceId: 'fixture-available',
  excludedSourceId: null,
  excludedQuery: null,
  expectedSourceRecordCount: 43,
  expectedReferencePointCount: 43,
  expectedExcludedPointCount: 0,
}

const buildPassingSummary = (
  smokeFixture: PaidCurbReferenceSmokeFixture = fixture,
) =>
  buildSmokeUiPaidCurbReferenceSummary({
    appUrl: 'http://127.0.0.1:4173',
    url: 'http://127.0.0.1:4173/?dataset=xinyi',
    district: 'xinyi',
    fixture: smokeFixture,
    list: {
      bodyText: 'Mode: List only',
      listMode: true,
      sourceRecordCount: smokeFixture.expectedSourceRecordCount,
      referencePointCount: smokeFixture.expectedReferencePointCount,
      excludedPointCount: smokeFixture.expectedExcludedPointCount,
      availableRowFound: true,
      availableActionFound: true,
      queryValue: smokeFixture.availableQuery,
    },
    map: {
      bodyText: 'Mode: Map + list NOT EVALUATED',
      mapMode: true,
      coverageDistrict: smokeFixture.referenceDistrict,
      coverageStage: smokeFixture.coverageStage,
      referencePointCount: smokeFixture.expectedReferencePointCount,
      selectedReferenceId: smokeFixture.availableSourceId,
      selectedActionPressed: true,
      addressValue: smokeFixture.address,
      mapDetailFound: true,
      mapDetailHasSafetyBoundary: true,
      mapDetailHasExpectedRecord: true,
      outsideCoverageNotEvaluated: true,
    },
    excluded: {
      bodyText: smokeFixture.excludedSourceId
        ? `Source ID ${smokeFixture.excludedSourceId}`
        : 'No exclusions',
      excludedRowFound: Boolean(smokeFixture.excludedSourceId),
      excludedActionCount: 0,
      excludedBoundaryNoteFound: Boolean(smokeFixture.excludedSourceId),
      queryValue:
        smokeFixture.excludedQuery ?? smokeFixture.availableQuery,
      selectionCleared: true,
    },
  })

describe('smokeUiPaidCurbReference', () => {
  it('parses preview and full-matrix smoke options', () => {
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
        '--all-reference-districts',
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
      allReferenceDistricts: true,
      chromePath: 'C:\\Chrome\\chrome.exe',
      cdpPort: 9333,
      timeoutMs: 30000,
      startPreview: true,
      previewPort: 4180,
    })
  })

  it('discovers every published Taoyuan spatial-reference district', async () => {
    await expect(loadSmokeUiPaidCurbReferenceDistrictIds()).resolves.toEqual([
      'taoyuan-district',
      'zhongli',
      'daxi',
      'yangmei',
      'luzhu',
      'dayuan',
      'guishan',
      'bade',
      'longtan',
      'pingzhen',
      'guanyin',
    ])
  })

  it('loads deterministic Guishan and zero-exclusion fixtures', async () => {
    const guishan = await loadSmokeUiPaidCurbReferenceFixture('guishan')
    const yangmei = await loadSmokeUiPaidCurbReferenceFixture('yangmei')

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
    expect(yangmei).toMatchObject({
      referenceDistrict: 'yangmei',
      coverageStage: 'source-only',
      excludedSourceId: null,
      excludedQuery: null,
      expectedSourceRecordCount: 43,
      expectedReferencePointCount: 43,
      expectedExcludedPointCount: 0,
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

  it('runs the full matrix only after fixture data is built', async () => {
    const workflow = await fs.readFile('.github/workflows/ci.yml', 'utf-8')
    const ingestPosition = workflow.indexOf('name: Ingest CI fixtures')
    const fixtureBuildPosition = workflow.indexOf('name: Build UI with CI fixtures')
    const matrixSmokePosition = workflow.indexOf(
      'name: Smoke all Taoyuan paid-curb reference UIs',
    )

    expect(ingestPosition).toBeGreaterThanOrEqual(0)
    expect(fixtureBuildPosition).toBeGreaterThan(ingestPosition)
    expect(matrixSmokePosition).toBeGreaterThan(fixtureBuildPosition)
    expect(workflow).toContain('--all-reference-districts')
    expect(workflow.slice(matrixSmokePosition, matrixSmokePosition + 300)).toContain(
      'timeout-minutes: 5',
    )
  })

  it('accepts excluded-row and zero-exclusion safety contracts', () => {
    const summary = buildPassingSummary()
    const zeroExclusionSummary = buildPassingSummary(zeroExclusionFixture)

    expect(summary.pass).toBe(true)
    expect(summary.errors).toEqual([])
    expect(renderSmokeUiPaidCurbReferenceSummary(summary)).toContain(
      'Excluded source 177: text only',
    )
    expect(zeroExclusionSummary.pass).toBe(true)
    expect(zeroExclusionSummary.errors).toEqual([])
    expect(
      renderSmokeUiPaidCurbReferenceSummary(zeroExclusionSummary),
    ).toContain('Excluded source: not applicable (0 reviewed exclusions)')
    expect(
      renderSmokeUiPaidCurbReferenceMatrixSummary({
        appUrl: 'http://127.0.0.1:4173',
        district: 'xinyi',
        pass: true,
        districtCount: 2,
        passedDistrictCount: 2,
        summaries: [summary, zeroExclusionSummary],
      }),
    ).toContain('Districts: 2/2 passed')
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
