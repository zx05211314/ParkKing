import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DatasetInfoSheet } from './DatasetInfoSheet'
import { buildDatasetInfoModel } from './datasetInfo/model'

describe('DatasetInfoSheet health panel', () => {
  it('renders health metrics', () => {
    const info = buildDatasetInfoModel({
      dataSource: 'Local',
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
        provenanceFetchedAt: '2026-02-03T12:00:00Z',
        segmentsCount: 12,
        signOverridesCount: 2,
        signOverrideMatchedSegmentCount: 1,
        signOverrideSpatialMatchCount: 1,
        overridesAppliedCount: 1,
        signOverrideUnmatchedNamedCount: 1,
        curbMarkingKnownRate: 0.5,
        restrictionTriggeredRate: 0.2,
      },
      manifest: null,
      report: null,
      metricsHistory: [
        JSON.stringify({
          schemaVersion: 1,
          publishedAt: '2026-02-01T00:00:00Z',
          packId: 'prev-pack',
          districtId: 'xinyi',
          segmentsCount: 20,
          overridesAppliedCount: 0,
          signOverridesCount: 1,
          curbMarkingKnownRate: 0.65,
          restrictionTriggeredRate: 0.25,
          provenanceFetchedAt: null,
        }),
      ].join('\n'),
    })

    const html = renderToStaticMarkup(
      <DatasetInfoSheet open info={info} onClose={() => {}} />,
    )

    expect(html).toContain('Dataset health')
    expect(html).toContain('Segments')
    expect(html).toContain('Unmatched named overrides')
    expect(html).toContain('Sign overrides matched by segment id')
    expect(html).toContain('Sign overrides matched by spatial fallback')
    expect(html).toContain('Curb marking known')
    expect(html).toContain('Restrictions triggered')
    expect(html).toContain('Since last publish')
    expect(html).toContain('Segments Δ')
    expect(html).toContain('health-badge-warn')
  })
})
