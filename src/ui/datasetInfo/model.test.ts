import { describe, expect, it } from 'vitest'
import { buildDatasetInfoModel } from './model'

describe('buildDatasetInfoModel', () => {
  it('maps latest, meta, and manifest into display model', () => {
    const model = buildDatasetInfoModel({
      dataSource: 'Remote (https://example.com)',
      latest: {
        datasetHash: 'hash-a',
        publishedAt: '2026-02-04T00:00:00Z',
      },
      meta: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        schemaVersion: 1,
        metricsSchemaVersion: 1,
        datasetHash: 'hash-a',
        configHash: 'config-hash',
        generatedAt: '2026-02-03T00:00:00Z',
        publishedAt: '2026-02-04T00:00:00Z',
        segmentsCount: 10,
        signOverridesCount: 2,
        overridesAppliedCount: 1,
        curbMarkingKnownRate: 0.5,
        restrictionTriggeredRate: 0.2,
      },
      manifest: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        schemaVersion: 1,
        datasetHash: 'hash-a',
        configHash: 'config-hash',
        generatedAt: '2026-02-03T00:00:00Z',
        publishedAt: '2026-02-04T00:00:00Z',
        metaSha256: 'meta-sha',
        packSha256: 'pack-sha',
        totalBytes: 1234,
        gateResult: 'PASS',
      },
      report: {
        districts: [
          { districtId: 'xinyi', warnings: [{ severity: 'WARN', message: 'warning' }] },
        ],
      },
      metricsHistory: [
        JSON.stringify({
          schemaVersion: 1,
          publishedAt: '2026-02-01T00:00:00Z',
          packId: 'prev-pack',
          districtId: 'xinyi',
          segmentsCount: 8,
          overridesAppliedCount: 0,
          signOverridesCount: 1,
          curbMarkingKnownRate: 0.4,
          restrictionTriggeredRate: 0.15,
          provenanceFetchedAt: null,
        }),
      ].join('\n'),
    })

    expect(model.districtId).toBe('xinyi')
    expect(model.datasetHash).toBe('hash-a')
    expect(model.metaSha256).toBe('meta-sha')
    expect(model.dataSource).toBe('Remote (https://example.com)')
    expect(model.anomalies[0]).toBe('warning')
    expect(model.health.segmentsCount).toBe('10')
    expect(model.health.curbMarkingKnownRate).toBe('50.0%')
    const segmentsDelta = model.health.deltas.find((delta) => delta.key === 'segments')
    expect(segmentsDelta?.value).toContain('+2')
  })
})
