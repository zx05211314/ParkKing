import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  RuntimeCoverageCatalog,
  RuntimeCoverageDistrict,
} from '../data/coverageCatalog'
import { resolveDistrictForLocation } from './addressSearchDistrict'

const makeDistrict = (params: {
  districtId: string
  publishStage: RuntimeCoverageDistrict['publishStage']
  bounds: [number, number, number, number]
}): RuntimeCoverageDistrict => {
  const [west, south, east, north] = params.bounds
  return {
    regionId: params.publishStage === 'source-only' ? 'taoyuan' : 'taipei',
    regionName:
      params.publishStage === 'source-only' ? 'Taoyuan City' : 'Taipei City',
    districtId: params.districtId,
    districtName: params.districtId,
    boundaryFeatureId: params.districtId,
    publishStage: params.publishStage,
    answerCapability:
      params.publishStage === 'source-only'
        ? 'paid-curb-reference-only'
        : 'full-rule-pipeline',
    requiresHumanReview: params.publishStage !== 'production',
    aliases: [],
    boundaryBBox: params.bounds,
    boundaryGeometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  }
}

const coverageCatalog: RuntimeCoverageCatalog = {
  schemaVersion: 1,
  districts: [
    makeDistrict({
      districtId: 'xinyi',
      publishStage: 'production',
      bounds: [0, 0, 1, 1],
    }),
    makeDistrict({
      districtId: 'daan',
      publishStage: 'production',
      bounds: [1, 0, 2, 1],
    }),
    makeDistrict({
      districtId: 'beitou',
      publishStage: 'candidate',
      bounds: [0, 1, 1, 2],
    }),
    makeDistrict({
      districtId: 'taoyuan-district',
      publishStage: 'source-only',
      bounds: [10, 10, 11, 11],
    }),
  ],
}

describe('resolveDistrictForLocation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('selects an exact production polygon present in dataset options', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveDistrictForLocation({
        datasetMetaFile: 'dataset_meta.json',
        datasetOptions: [
          { id: 'xinyi', label: 'Xinyi' },
          { id: 'daan', label: 'Daan' },
        ],
        coverageCatalog,
        location: [1.5, 0.5],
      }),
    ).resolves.toBe('daan')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not switch candidate or source-only areas into a published dataset', async () => {
    const options = [
      { id: 'xinyi', label: 'Xinyi' },
      { id: 'daan', label: 'Daan' },
      { id: 'beitou', label: 'Beitou should not be published' },
      { id: 'taoyuan-district', label: 'Taoyuan should not be published' },
    ]

    await expect(
      resolveDistrictForLocation({
        datasetMetaFile: 'dataset_meta.json',
        datasetOptions: options,
        coverageCatalog,
        location: [0.5, 1.5],
      }),
    ).resolves.toBeNull()
    await expect(
      resolveDistrictForLocation({
        datasetMetaFile: 'dataset_meta.json',
        datasetOptions: options,
        coverageCatalog,
        location: [10.5, 10.5],
      }),
    ).resolves.toBeNull()
  })

  it('only falls back to the first dataset when explicitly requested', async () => {
    await expect(
      resolveDistrictForLocation({
        datasetMetaFile: 'dataset_meta.json',
        datasetOptions: [
          { id: 'xinyi', label: 'Xinyi' },
          { id: 'daan', label: 'Daan' },
        ],
        coverageCatalog,
        location: [10.5, 10.5],
        fallbackToFirst: true,
      }),
    ).resolves.toBe('xinyi')
  })

  it('does not guess a nearby dataset while coverage metadata is loading', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveDistrictForLocation({
        datasetMetaFile: 'dataset_meta.json',
        datasetOptions: [
          { id: 'xinyi', label: 'Xinyi' },
          { id: 'daan', label: 'Daan' },
        ],
        coverageCatalog: null,
        coverageCatalogStatus: 'loading',
        location: [10.5, 10.5],
      }),
    ).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retains metadata fallback when the runtime catalog is unavailable', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('/daan/')
          ? {
              boundaryBBox: { minX: 1, minY: 0, maxX: 2, maxY: 1 },
              boundaryCenter: [1.5, 0.5],
            }
          : {
              boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
              boundaryCenter: [0.5, 0.5],
            },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveDistrictForLocation({
        datasetMetaFile: 'dataset_meta.json',
        datasetOptions: [
          { id: 'xinyi', label: 'Xinyi' },
          { id: 'daan', label: 'Daan' },
        ],
        coverageCatalog: null,
        coverageCatalogStatus: 'error',
        location: [1.5, 0.5],
      }),
    ).resolves.toBe('daan')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(
      resolveDistrictForLocation({
        datasetMetaFile: 'dataset_meta.json',
        datasetOptions: [
          { id: 'xinyi', label: 'Xinyi' },
          { id: 'daan', label: 'Daan' },
        ],
        coverageCatalog: null,
        coverageCatalogStatus: 'error',
        location: [10.5, 10.5],
      }),
    ).resolves.toBeNull()
  })
})
