import { describe, expect, it } from 'vitest'
import {
  buildSmokeUiMapViewDatasetMetaUrl,
  buildSmokeUiMapViewUrl,
  getSmokeUiMapViewDatasetCounts,
  parseSmokeUiMapViewArgs,
  renderSmokeUiMapViewSummary,
  validateSmokeUiMapViewSummary,
  type SmokeUiMapViewSummary,
} from './smokeUiMapView'

const passingSummary: SmokeUiMapViewSummary = {
  appUrl: 'http://127.0.0.1:4173',
  url: 'http://127.0.0.1:4173/?dataset=xinyi&view=MAP',
  district: 'xinyi',
  pass: true,
  requiredText: ['Mode: Map + list', 'Green: park ok'],
  missingText: [],
  hasMapRoot: true,
  rootWidth: 1000,
  rootHeight: 640,
  hasCanvas: true,
  canvasWidth: 1000,
  canvasHeight: 640,
  expectedSegmentsCount: 11248,
  expectedParkingSpacesCount: 23091,
  datasetStatusReady: true,
  evaluationStatusReady: true,
  reportedSegmentsCount: 11248,
  reportedParkingSpacesCount: 23091,
  mapSegmentCount: 11248,
  mapParkingSpaceCount: 23091,
  hasFallback: false,
  hasSkeleton: false,
  bodySnippet: 'Mode: Map + list Green: park ok',
}

describe('smokeUiMapView', () => {
  it('parses map UI smoke options', () => {
    expect(
      parseSmokeUiMapViewArgs([
        'node',
        'smokeUiMapView',
        '--app-url',
        'http://127.0.0.1:4174',
        '--district',
        'xinyi',
        '--chrome-path',
        'C:\\Chrome\\chrome.exe',
        '--cdp-port',
        '9333',
        '--timeout-ms',
        '5000',
        '--start-preview',
        '--preview-port',
        '4180',
      ]),
    ).toEqual({
      appUrl: 'http://127.0.0.1:4174',
      district: 'xinyi',
      chromePath: 'C:\\Chrome\\chrome.exe',
      cdpPort: 9333,
      timeoutMs: 5000,
      startPreview: true,
      previewPort: 4180,
      datasetMetaUrl: undefined,
    })
  })

  it('builds a direct MAP-mode URL for the selected district', () => {
    const url = new URL(
      buildSmokeUiMapViewUrl({
        appUrl: 'http://127.0.0.1:4173/app',
        district: 'xinyi',
      }),
    )

    expect(url.origin).toBe('http://127.0.0.1:4173')
    expect(url.pathname).toBe('/app')
    expect(url.searchParams.get('dataset')).toBe('xinyi')
    expect(url.searchParams.get('view')).toBe('MAP')
  })

  it('builds and parses dataset metadata expectations', () => {
    expect(
      buildSmokeUiMapViewDatasetMetaUrl({
        appUrl: 'http://127.0.0.1:4173/app',
        district: 'xinyi',
      }),
    ).toBe('http://127.0.0.1:4173/data/generated/xinyi/dataset_meta.json')
    expect(
      getSmokeUiMapViewDatasetCounts({
        segmentsCount: 11248,
        parkingSpacesCount: 23091,
      }),
    ).toEqual({
      expectedSegmentsCount: 11248,
      expectedParkingSpacesCount: 23091,
    })
  })

  it('validates missing map UI, canvas, and fallback failures', () => {
    expect(
      validateSmokeUiMapViewSummary({
        ...passingSummary,
        pass: false,
        missingText: ['Green: park ok'],
        hasMapRoot: false,
        rootWidth: 0,
        rootHeight: 0,
        hasCanvas: false,
        canvasWidth: 0,
        canvasHeight: 0,
        datasetStatusReady: false,
        evaluationStatusReady: false,
        reportedSegmentsCount: null,
        reportedParkingSpacesCount: null,
        mapSegmentCount: 0,
        mapParkingSpaceCount: 0,
        hasFallback: true,
      }),
    ).toEqual([
      'missing UI text: Green: park ok',
      'map root was not rendered',
      'MapLibre canvas was not mounted',
      'dataset status did not reach ready',
      'segment evaluation did not reach ready',
      'reported segment count missing is not positive',
      'reported parking-space count missing does not match expected 23091',
      'map segment count 0 is below expected source count 11248',
      'map parking-space count 0 does not match expected 23091',
      'map fallback is visible',
    ])
  })

  it('accepts zone-aware map segment counts above the source count', () => {
    expect(
      validateSmokeUiMapViewSummary({
        ...passingSummary,
        mapSegmentCount: 15_553,
      }),
    ).toEqual([])
  })

  it('renders a concise map smoke summary', () => {
    expect(renderSmokeUiMapViewSummary(passingSummary)).toContain(
      'UI map smoke: PASS',
    )
    expect(renderSmokeUiMapViewSummary(passingSummary)).toContain(
      'MapLibre canvas: 1000x640',
    )
    expect(renderSmokeUiMapViewSummary(passingSummary)).toContain(
      'Segments: reported 11248, evaluated/map 11248, source minimum 11248',
    )
  })
})
