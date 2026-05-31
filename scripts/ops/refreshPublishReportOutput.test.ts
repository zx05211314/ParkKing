import { describe, expect, it } from 'vitest'
import { formatRefreshPublishReport } from './refreshPublishReportOutput'
import type { RefreshPublishReportResult } from './refreshPublishReportState'

describe('formatRefreshPublishReport', () => {
  it('formats the refreshed report summary', () => {
    const result: RefreshPublishReportResult = {
      configPath: 'configs/prod/xinyi.json',
      datasetDir: 'public/data/generated/xinyi',
      outPath: 'public/data/generated/ingest_all_report.json',
      dayHhmm: '13:00',
      nightHhmm: '21:00',
      summary: {
        districtId: 'xinyi',
        label: 'xinyi.json',
        datasetHash: 'dataset-hash',
        counts: {
          segments: 11232,
          inferredCandidates: 1420,
          signOverrides: 0,
        },
        bbox: null,
        dayEval: null,
        nightEval: null,
        intersectionsReport: null,
        riskTagCounts: null,
        districtName: 'Xinyi',
        schemaVersion: 1,
        generatedAt: '2026-05-08T00:00:00.000Z',
        warnings: [
          {
            severity: 'INFO',
            code: 'BASELINE_HASH_MATCH',
            message: 'Baseline datasetHash matches current.',
          },
        ],
        baselineStatus: 'loaded',
        baselineCandidate: null,
        thresholds: {
          counts: {
            segments: 20,
            intersections: 20,
            inferredCandidates: 30,
            signOverrides: 30,
            signOverrideUnmatchedNamedCount: 0,
          },
          tierDistributionMaxDeltaPct: 15,
          perfRegressionMaxDeltaPct: 30,
          maxReasonCodeDeltaPct: 20,
          maxNewReasonCodePct: 5,
        },
        retention: {
          maxBackupsPerDistrict: 5,
          maxBackupAgeDays: 30,
        },
        config: {} as never,
      },
      report: {
        generatedAt: '2026-05-08T00:00:00.000Z',
        districts: [],
      },
    }

    const output = formatRefreshPublishReport(result)

    expect(output).toContain('# Refresh Publish Report: PASS')
    expect(output).toContain('Dataset hash: dataset-hash')
    expect(output).toContain('Counts: segments 11232, inferred 1420, signOverrides 0')
    expect(output).toContain('Report warnings: info 1, warn 0, fail 0')
  })
})
