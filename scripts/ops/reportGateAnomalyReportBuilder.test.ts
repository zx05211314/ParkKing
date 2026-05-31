import { describe, expect, it } from 'vitest'
import { createGateAnomalyReport } from './reportGateAnomalyReportBuilder'
import type { GateAnomalyReportState } from './reportGateAnomalyReportState'

describe('reportGateAnomalyReportBuilder', () => {
  it('builds the final anomaly report from precomputed state', () => {
    const state: GateAnomalyReportState = {
      context: {
        districtId: 'xinyi',
        packPath: '/pack',
        outPath: '/out.json',
        meta: {},
        diffReportPath: '/pack/diff_report.json',
        districtDiff: null,
        prevPackPath: '/prev',
        nextPackPath: '/pack',
        prevPublishedAt: '2026-03-01T00:00:00.000Z',
        nextPublishedAt: '2026-03-02T00:00:00.000Z',
        prevDistrictIds: ['xinyi'],
        nextDistrictIds: ['xinyi'],
        parsingFallbacks: {
          big5Fallback: { used: false, evidence: [] },
          tabDelimiter: { used: false, evidence: [] },
          headerMatchFallback: { used: false, evidence: [] },
          missingPrjHeuristic: { used: false, evidence: [] },
        },
      },
      invalidGeometry: {
        layers: [],
        totalInvalid: 0,
      },
      thresholdSummary: {
        issues: [],
        deltas: [],
        topOffenders: {
          biggestCountDelta: null,
          metricTrigger: null,
        },
      },
      bboxCenterAnomalies: [],
    }

    expect(
      createGateAnomalyReport({
        state,
        generatedAt: '2026-03-03T00:00:00.000Z',
      }),
    ).toMatchObject({
      schemaVersion: 1,
      generatedAt: '2026-03-03T00:00:00.000Z',
      districtId: 'xinyi',
      packPath: '/pack',
      outPath: '/out.json',
      diffReportPath: '/pack/diff_report.json',
    })
  })
})
