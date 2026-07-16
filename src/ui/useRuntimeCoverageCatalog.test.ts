import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRuntimeCoverageCatalog } from './useRuntimeCoverageCatalog'

const validCatalog = {
  schemaVersion: 1,
  districts: [
    {
      regionId: 'taipei',
      regionName: 'Taipei City',
      districtId: 'xinyi',
      districtName: 'Xinyi',
      boundaryFeatureId: '63002',
      publishStage: 'production',
      answerCapability: 'full-rule-pipeline',
      requiresHumanReview: false,
      aliases: [],
      boundaryBBox: [121.5, 25, 121.6, 25.1],
      boundaryGeometry: {
        type: 'Polygon',
        coordinates: [
          [
            [121.5, 25],
            [121.6, 25],
            [121.5, 25.1],
            [121.5, 25],
          ],
        ],
      },
    },
  ],
}

describe('loadRuntimeCoverageCatalog', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads and validates the runtime catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => validCatalog,
      }),
    )

    await expect(loadRuntimeCoverageCatalog('/data/coverage.json')).resolves.toEqual(
      validCatalog,
    )
  })

  it('fails closed for malformed responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ schemaVersion: 1, districts: [{}] }),
      }),
    )

    await expect(loadRuntimeCoverageCatalog('/data/coverage.json')).rejects.toThrow(
      'Invalid runtime coverage catalog',
    )
  })
})
