import { describe, expect, it } from 'vitest'
import {
  buildDatasetInfoDeltaBadges,
  findPreviousMetricsHistoryEntry,
  parseMetricsHistory,
} from './metricsHistory'

describe('datasetInfo metricsHistory', () => {
  it('parses only valid metrics-history entries', () => {
    expect(
      parseMetricsHistory(
        [
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
      ),
    ).toEqual([
      {
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
      },
    ])
  })

  it('finds the previous entry when the latest matches the current publishedAt', () => {
    expect(
      findPreviousMetricsHistoryEntry(
        [
          {
            schemaVersion: 1,
            publishedAt: '2026-02-01T00:00:00Z',
            packId: 'older-pack',
            districtId: 'daan',
            segmentsCount: 14,
            overridesAppliedCount: 2,
            signOverridesCount: 1,
            signOverrideUnmatchedNamedCount: 1,
            curbMarkingKnownRate: 0.25,
            restrictionTriggeredRate: 0.04,
            provenanceFetchedAt: null,
          },
          {
            schemaVersion: 1,
            publishedAt: '2026-02-04T00:00:00Z',
            packId: 'current-pack',
            districtId: 'daan',
            segmentsCount: 12,
            overridesAppliedCount: 1,
            signOverridesCount: 1,
            signOverrideUnmatchedNamedCount: 0,
            curbMarkingKnownRate: 0.2,
            restrictionTriggeredRate: 0.03,
            provenanceFetchedAt: null,
          },
        ],
        '2026-02-04T00:00:00Z',
      ),
    ).toEqual({
      schemaVersion: 1,
      publishedAt: '2026-02-01T00:00:00Z',
      packId: 'older-pack',
      districtId: 'daan',
      segmentsCount: 14,
      overridesAppliedCount: 2,
      signOverridesCount: 1,
      signOverrideUnmatchedNamedCount: 1,
      curbMarkingKnownRate: 0.25,
      restrictionTriggeredRate: 0.04,
      provenanceFetchedAt: null,
    })
  })

  it('builds warnable delta badges from the previous entry', () => {
    expect(
      buildDatasetInfoDeltaBadges({
        segmentsCount: 10,
        overridesAppliedCount: 3,
        signOverrideUnmatchedNamedCount: 2,
        curbMarkingKnownRate: 0.05,
        restrictionTriggeredRate: 0.005,
        previousEntry: {
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
        },
      }).find((delta) => delta.key === 'segments'),
    ).toEqual({
      key: 'segments',
      label: 'Segments Δ',
      value: '-2 (-16.7%)',
      warn: true,
    })

    expect(
      buildDatasetInfoDeltaBadges({
        segmentsCount: 10,
        overridesAppliedCount: 3,
        signOverrideUnmatchedNamedCount: 2,
        curbMarkingKnownRate: 0.05,
        restrictionTriggeredRate: 0.005,
        previousEntry: {
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
        },
      }).find((delta) => delta.key === 'namedOverrideMismatch'),
    ).toEqual({
      key: 'namedOverrideMismatch',
      label: 'Named overrides Δ',
      value: '+2',
      warn: true,
    })
  })

  it('treats older history rows without named-override counts as unknown instead of NaN', () => {
    expect(
      buildDatasetInfoDeltaBadges({
        segmentsCount: 10,
        overridesAppliedCount: 3,
        signOverrideUnmatchedNamedCount: 2,
        curbMarkingKnownRate: 0.05,
        restrictionTriggeredRate: 0.005,
        previousEntry: {
          schemaVersion: 1,
          publishedAt: '2026-02-01T00:00:00Z',
          packId: 'prev-pack',
          districtId: 'daan',
          segmentsCount: 12,
          overridesAppliedCount: 1,
          signOverridesCount: 1,
          signOverrideUnmatchedNamedCount: undefined as unknown as number,
          curbMarkingKnownRate: 0.2,
          restrictionTriggeredRate: 0.03,
          provenanceFetchedAt: null,
        },
      }).find((delta) => delta.key === 'namedOverrideMismatch'),
    ).toEqual({
      key: 'namedOverrideMismatch',
      label: 'Named overrides Δ',
      value: '-',
      warn: false,
    })
  })
})
