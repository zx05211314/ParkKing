import { describe, expect, it, vi } from 'vitest'
import {
  applyLoadedDatasetState,
  shouldVerifyDatasetHashes,
} from './datasetLoadWorkflow'

describe('datasetLoadWorkflow', () => {
  it('detects whether hash verification is enabled', () => {
    expect(shouldVerifyDatasetHashes({ VITE_VERIFY_HASHES: '1' })).toBe(true)
    expect(shouldVerifyDatasetHashes({ VITE_VERIFY_HASHES: '0' })).toBe(false)
    expect(shouldVerifyDatasetHashes()).toBe(false)
  })

  it('applies supplemental info and the dataset load result', () => {
    const setLatestInfo = vi.fn()
    const setManifestInfo = vi.fn()
    const setIngestReport = vi.fn()
    const setMetricsHistory = vi.fn()
    const setSegments = vi.fn()
    const setParkingSpaces = vi.fn()
    const setZones = vi.fn()
    const setParkingSpaceCount = vi.fn()
    const setIntersectionCount = vi.fn()
    const setCrosswalkCount = vi.fn()
    const setOverrideCount = vi.fn()
    const setInferredCount = vi.fn()
    const setDatasetMeta = vi.fn()
    const setDatasetStatus = vi.fn()

    applyLoadedDatasetState(
      {
        setLatestInfo,
        setManifestInfo,
        setIngestReport,
        setMetricsHistory,
        setSegments,
        setParkingSpaces,
        setZones,
        setParkingSpaceCount,
        setIntersectionCount,
        setCrosswalkCount,
        setOverrideCount,
        setInferredCount,
        setDatasetMeta,
        setDatasetStatus,
      },
      {
        supplementalInfo: {
          latest: { datasetHash: 'hash-1', publishedAt: '2026-03-20T00:00:00Z' },
          manifest: {
            districtId: 'xinyi',
            districtName: 'Xinyi',
            schemaVersion: 1,
            datasetHash: 'hash-1',
            configHash: 'config-1',
            generatedAt: '2026-03-19T00:00:00Z',
            publishedAt: '2026-03-20T00:00:00Z',
            metaSha256: 'meta-1',
            packSha256: 'pack-1',
            totalBytes: 123,
            gateResult: 'PASS',
          },
          report: null,
          history: 'history',
        },
        datasetLoadResult: {
          segments: [],
          parkingSpaces: { type: 'FeatureCollection', features: [] },
          zones: [],
          parkingSpaceCount: 0,
          intersectionCount: 0,
          crosswalkCount: 0,
          overrideCount: 0,
          inferredCount: 0,
          datasetMeta: {
            districtId: 'xinyi',
            districtName: 'Xinyi',
            schemaVersion: 1,
            datasetHash: 'hash-1',
          },
        },
      },
    )

    expect(setLatestInfo).toHaveBeenCalledWith({
      datasetHash: 'hash-1',
      publishedAt: '2026-03-20T00:00:00Z',
    })
    expect(setManifestInfo).toHaveBeenCalled()
    expect(setMetricsHistory).toHaveBeenCalledWith('history')
    expect(setSegments).toHaveBeenCalledWith([])
    expect(setParkingSpaces).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    })
    expect(setDatasetMeta).toHaveBeenCalledWith({
      districtId: 'xinyi',
      districtName: 'Xinyi',
      schemaVersion: 1,
      datasetHash: 'hash-1',
    })
    expect(setDatasetStatus).toHaveBeenCalledWith('ready')
  })
})
