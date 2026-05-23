import { describe, expect, it } from 'vitest'
import { buildDatasetInfoHealth } from './health'

describe('buildDatasetInfoHealth', () => {
  it('ignores malformed history lines and computes warning badges', () => {
    const result = buildDatasetInfoHealth({
      districtId: 'daan',
      latest: {
        datasetHash: 'hash-b',
        publishedAt: '2026-02-04T00:00:00Z',
      },
      meta: {
        districtId: 'daan',
        districtName: 'Daan',
        schemaVersion: 1,
        datasetHash: 'hash-b',
        configHash: 'config-b',
        generatedAt: '2026-02-03T00:00:00Z',
        publishedAt: '2026-02-04T00:00:00Z',
        segmentsCount: 10,
        overridesAppliedCount: 3,
        signOverridesCount: 1,
        signOverrideMatchedSegmentCount: 1,
        signOverrideSpatialMatchCount: 0,
        signOverrideUnmatchedNamedCount: 2,
        curbMarkingKnownRate: 0.05,
        restrictionTriggeredRate: 0.005,
      },
      manifest: {
        districtId: 'daan',
        districtName: 'Daan',
        schemaVersion: 1,
        datasetHash: 'hash-b',
        configHash: 'config-b',
        generatedAt: '2026-02-03T00:00:00Z',
        publishedAt: '2026-02-04T00:00:00Z',
        metaSha256: 'meta-b',
        packSha256: 'pack-b',
        totalBytes: 300,
        gateResult: 'PASS',
      },
      report: {
        districts: [
          {
            districtId: 'daan',
            warnings: [
              { severity: 'INFO', message: 'ignore me' },
              { severity: 'WARN', code: 'LOW_SIGNAL' },
            ],
          },
        ],
      },
      metricsHistory: [
        'not-json',
        JSON.stringify({
          schemaVersion: 1,
          publishedAt: '2026-02-01T00:00:00Z',
          packId: 'prev-pack',
          districtId: 'daan',
          segmentsCount: 12,
          overridesAppliedCount: 1,
          signOverridesCount: 1,
          signOverrideUnmatchedNamedCount: 0,
          curbMarkingKnownRate: 0.2,
          restrictionTriggeredRate: 0.03,
          provenanceFetchedAt: null,
        }),
      ].join('\n'),
    })

    expect(result.anomalies).toEqual(['LOW_SIGNAL'])
    expect(result.health.warnings).toContain('Low curb marking coverage')
    expect(result.health.warnings).toContain('Low restriction trigger rate')
    expect(result.health.warnings).toContain('High override volume')
    expect(result.health.warnings).toContain('Named overrides did not match current segments')
    expect(result.health.signOverrideUnmatchedNamedCount).toBe('2')
    expect(result.health.signOverrideMatchedSegmentCount).toBe('1')
    expect(result.health.signOverrideSpatialMatchCount).toBe('0')
    expect(result.health.deltas.find((delta) => delta.key === 'segments')?.warn).toBe(
      true,
    )
    expect(
      result.health.deltas.find((delta) => delta.key === 'namedOverrideMismatch'),
    ).toEqual({
      key: 'namedOverrideMismatch',
      label: 'Named overrides Δ',
      value: '+2',
      warn: true,
    })
  })

  it('warns when no reviewed sign overrides are present', () => {
    const result = buildDatasetInfoHealth({
      districtId: 'xinyi',
      latest: null,
      meta: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        schemaVersion: 1,
        datasetHash: 'hash',
        configHash: 'config',
        generatedAt: '2026-02-03T00:00:00Z',
        segmentsCount: 10,
        overridesAppliedCount: 0,
        signOverridesCount: 0,
      },
      manifest: null,
      report: null,
    })

    expect(result.health.warnings).toContain('No reviewed sign overrides')
    expect(result.health.warnings).not.toContain('No sign overrides applied')
  })

  it('warns when reviewed sign overrides exist but none apply', () => {
    const result = buildDatasetInfoHealth({
      districtId: 'xinyi',
      latest: null,
      meta: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        schemaVersion: 1,
        datasetHash: 'hash',
        configHash: 'config',
        generatedAt: '2026-02-03T00:00:00Z',
        segmentsCount: 10,
        overridesAppliedCount: 0,
        signOverridesCount: 2,
      },
      manifest: null,
      report: null,
    })

    expect(result.health.warnings).toContain('No sign overrides applied')
  })
})
