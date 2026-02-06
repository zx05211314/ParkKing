import { describe, expect, it } from 'vitest'
import { validateMeta, validateRegistryEntry, PACK_SCHEMA_VERSION } from './districtPack'

describe('district pack validation', () => {
  it('fails when required fields are missing', () => {
    const result = validateMeta({
      schemaVersion: PACK_SCHEMA_VERSION,
      datasetHash: 'hash',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('districtId is required')
    expect(result.errors).toContain('generatedAt is required')
    expect(result.errors).toContain('counts is required')
  })

  it('fails on schemaVersion mismatch', () => {
    const files = {
      'red_yellow.geojson': { sha256: 'a', bytes: 10 },
      'bus_stops.geojson': { sha256: 'b', bytes: 10 },
      'hydrants.geojson': { sha256: 'c', bytes: 10 },
      'intersections.geojson': { sha256: 'd', bytes: 10 },
      'intersections_report.json': { sha256: 'e', bytes: 10 },
      'crosswalks.geojson': { sha256: 'f', bytes: 10 },
      'sign_overrides.geojson': { sha256: 'g', bytes: 10 },
      'candidates_inferred.geojson': { sha256: 'h', bytes: 10 },
      'overrides_applied.geojson': { sha256: 'i', bytes: 10 },
    }
    const result = validateMeta({
      schemaVersion: PACK_SCHEMA_VERSION + 1,
      districtId: 'xinyi',
      datasetHash: 'hash',
      generatedAt: '2026-02-02T00:00:00Z',
      districtName: 'Xinyi',
      publishMode: 'atomic',
      publishedAt: '2026-02-02T00:00:00Z',
      files,
      totalBytes: 80,
      counts: {
        segments: 1,
        zones: 1,
        intersections: 1,
        signOverrides: 0,
        inferredCandidates: 0,
        overridesApplied: 0,
      },
    })
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) => error.includes('schemaVersion mismatch')),
    ).toBe(true)
  })

  it('filters registry entries missing integrity fields', () => {
    const result = validateRegistryEntry({
      districtId: 'xinyi',
      districtName: 'Xinyi',
      generatedAt: '2026-02-02T00:00:00Z',
      publishedAt: '',
      datasetHash: 'hash',
      schemaVersion: PACK_SCHEMA_VERSION,
      totalBytes: 0,
      fileCount: 0,
      metaSha256: '',
      packSha256: '',
      latest: {
        datasetHash: '',
        publishedAt: '',
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('publishedAt is required')
    expect(result.errors).toContain('metaSha256 is required')
    expect(result.errors).toContain('packSha256 is required')
    expect(result.errors).toContain('latest.datasetHash is required')
    expect(result.errors).toContain('latest.publishedAt is required')
  })
})
