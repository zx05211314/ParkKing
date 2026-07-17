import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatasetMeta } from '../data/segmentBuilder'
import { DATASET_FILES, loadDatasetArtifacts } from './datasetLoadArtifacts'

const { loadGeoJsonMock } = vi.hoisted(() => ({
  loadGeoJsonMock: vi.fn(),
}))

vi.mock('../data/loaders/loadGeoJson', () => ({
  loadGeoJson: loadGeoJsonMock,
}))

const emptyFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
} as const

describe('loadDatasetArtifacts', () => {
  beforeEach(() => {
    loadGeoJsonMock.mockReset()
  })

  it('propagates failures for optional layers declared by dataset meta', async () => {
    const meta: DatasetMeta = {
      files: {
        [DATASET_FILES.parkingSpaces]: { sha256: 'parking-hash', bytes: 10 },
      },
    }
    loadGeoJsonMock.mockImplementation((fileName: string) => {
      if (fileName === DATASET_FILES.meta) {
        return Promise.resolve(meta)
      }
      if (fileName === DATASET_FILES.parkingSpaces) {
        return Promise.reject(new Error('temporary parking-space failure'))
      }
      return Promise.resolve(emptyFeatureCollection)
    })

    await expect(loadDatasetArtifacts('/data/xinyi')).rejects.toThrow(
      'temporary parking-space failure',
    )
  })

  it('uses empty collections only for optional layers absent from dataset meta', async () => {
    const meta: DatasetMeta = { files: {} }
    loadGeoJsonMock.mockImplementation((fileName: string) =>
      Promise.resolve(
        fileName === DATASET_FILES.meta ? meta : emptyFeatureCollection,
      ),
    )

    const result = await loadDatasetArtifacts('/data/xinyi')

    expect(result.parkingSpaces.features).toEqual([])
    expect(result.crosswalks.features).toEqual([])
    expect(result.signOverrides.features).toEqual([])
    expect(result.inferredCandidates.features).toEqual([])
    expect(loadGeoJsonMock).not.toHaveBeenCalledWith(
      DATASET_FILES.parkingSpaces,
      expect.anything(),
    )
  })
})
