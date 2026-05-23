import { describe, expect, it } from 'vitest'
import { buildAppDerivedDatasetState } from './appDerivedDatasetState'

describe('appDerivedDatasetState', () => {
  it('builds dataset display values from metadata and options', () => {
    const result = buildAppDerivedDatasetState({
      datasetId: 'xinyi',
      datasetMeta: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        datasetHash: 'hash-1',
        schemaVersion: 3,
        boundaryCenter: [121.565, 25.033],
        boundaryBBox: {
          minX: 121.56,
          minY: 25.03,
          maxX: 121.57,
          maxY: 25.04,
        },
      },
      datasetOptions: [
        { id: 'xinyi', label: 'Xinyi' },
        { id: 'daan', label: 'Daan' },
      ],
    })

    expect(result.datasetHash).toBe('hash-1')
    expect(result.districtName).toBe('Xinyi')
    expect(result.schemaVersion).toBe(3)
    expect(result.mapCenter).toEqual([121.565, 25.033])
    expect(result.districtBounds).toEqual([
      [121.56, 25.03],
      [121.57, 25.04],
    ])
    expect(result.districtBoundsKey).toBe('xinyi:hash-1')
    expect(result.datasetLabelById.get('daan')).toBe('Daan')
  })

  it('falls back cleanly when dataset metadata is missing', () => {
    const result = buildAppDerivedDatasetState({
      datasetId: null,
      datasetMeta: null,
      datasetOptions: [],
    })

    expect(result.datasetHash).toBe('local')
    expect(result.districtName).toBe('Unknown')
    expect(result.schemaVersion).toBe('-')
    expect(result.districtBounds).toBeNull()
    expect(result.districtBoundsKey).toBeNull()
  })
})
