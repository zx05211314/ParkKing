import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildIngestDistrictSummary,
} from './ingestAllSummaryState'
import { buildReasonDistribution } from './ingestAllBaselineState'
import {
  buildIngestAllReport,
  logIngestBatchSummary,
  logWarnSummaries,
} from './ingestAllReportState'
import type { IngestDistrictSummary } from './ingestAllTypes'

const createBenchmarkResult = (hhmm: string) => ({
  datasetHash: 'hash-1',
  hhmm,
  counts: {
    segments: 12,
    zones: 3,
    evaluatedFirst: 12,
    evaluatedSecond: 12,
  },
  distribution: {
    'GREEN|ALLOWED': 8,
    'YELLOW|ALLOWED': 4,
  },
  reasonCodes: {
    coveragePct: 50,
    counts: {
      BUS_STOP: 4,
      HYDRANT: 2,
    },
    byTier: {
      GREEN: { BUS_STOP: 2 },
      YELLOW: { BUS_STOP: 2, HYDRANT: 2 },
      RED: {},
    },
  },
  timingsMs: {
    load: 1,
    buildSegments: 2,
    buildZones: 3,
    zoneIndex: 4,
    evalFirst: 5,
    evalSecond: 6,
  },
  cache: {
    hits: 1,
    misses: 0,
    size: 1,
    maxEntries: 10,
    secondPassHitRate: 1,
  },
})

describe('ingestAllSummaryState', () => {
  it('builds reason distributions with top and other buckets', () => {
    expect(buildReasonDistribution({ B: 1, A: 3, C: 2 }, 6, 80, 2)).toEqual({
      top: { A: 3, C: 2 },
      other: 1,
      total: 6,
      coveragePct: 80,
    })
  })

  it('builds district summaries and report entries when no baseline exists', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-summary-'))
    const config = {
      districtId: 'xinyi',
      districtName: 'Xinyi',
      outputs: {
        generatedDir: path.join(cwd, 'data', 'generated', 'xinyi'),
        publicDir: path.join(cwd, 'public', 'data', 'generated', 'xinyi'),
      },
      ops: {
        thresholds: {
          counts: {
            segments: 100,
            intersections: 100,
            inferredCandidates: 100,
            signOverrides: 100,
          },
          tierDistributionMaxDeltaPct: 20,
          perfRegressionMaxDeltaPct: 20,
          maxReasonCodeDeltaPct: 20,
          maxNewReasonCodePct: 20,
        },
        retention: {
          maxBackupsPerDistrict: 5,
          maxBackupAgeDays: 30,
        },
      },
    } as const

    const summary = await buildIngestDistrictSummary({
      config: config as never,
      label: 'xinyi.json',
      meta: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        datasetHash: 'hash-1',
        schemaVersion: 3,
        generatedAt: '2026-03-21T00:00:00.000Z',
        counts: {
          segments: 12,
          intersections: 4,
          inferredCandidates: 2,
          signOverrides: 1,
          signOverrideUnmatchedNamedCount: 2,
          zones: 3,
        },
      },
      bbox: {
        minX: 121.5,
        minY: 25,
        maxX: 121.6,
        maxY: 25.1,
      },
      dayEval: createBenchmarkResult('13:00'),
      nightEval: createBenchmarkResult('21:00'),
      cwd,
    })

    expect(summary.baselineStatus).toBe('missing')
    expect(summary.baselineCandidate?.counts.segments).toBe(12)
    expect(summary.warnings.map((warning) => warning.code)).toContain('BASELINE_MISSING')

    const report = buildIngestAllReport([summary], '2026-03-21T01:00:00.000Z')
    expect(report).toEqual({
      generatedAt: '2026-03-21T01:00:00.000Z',
      districts: [
        expect.objectContaining({
          districtId: 'xinyi',
          districtName: 'Xinyi',
          datasetHash: 'hash-1',
          baselineStatus: 'missing',
        }),
      ],
    })
  })

  it('logs batch and warning summaries', () => {
    const messages: string[] = []
    const summary: IngestDistrictSummary = {
      districtId: 'xinyi',
      label: 'xinyi.json',
      datasetHash: 'hash-1',
      counts: {
        segments: 12,
        zones: 3,
        inferredCandidates: 2,
      },
      bbox: {
        minX: 121.5,
        minY: 25,
        maxX: 121.6,
        maxY: 25.1,
      },
      dayEval: createBenchmarkResult('13:00'),
      nightEval: createBenchmarkResult('21:00'),
      intersectionsReport: null,
      riskTagCounts: null,
      districtName: 'Xinyi',
      schemaVersion: 3,
      generatedAt: '2026-03-21T00:00:00.000Z',
      warnings: [
        {
          severity: 'WARN',
          code: 'BASELINE_MISSING',
          message: 'missing',
        },
      ],
      baselineStatus: 'missing',
      baselineCandidate: null,
      thresholds: {
        counts: {
          segments: 100,
          intersections: 100,
          inferredCandidates: 100,
          signOverrides: 100,
        },
        tierDistributionMaxDeltaPct: 20,
        perfRegressionMaxDeltaPct: 20,
        maxReasonCodeDeltaPct: 20,
        maxNewReasonCodePct: 20,
      },
      retention: {
        maxBackupsPerDistrict: 5,
        maxBackupAgeDays: 30,
      },
      config: {} as never,
    }

    logIngestBatchSummary([summary], (message) => messages.push(message))
    logWarnSummaries([summary], (message) => messages.push(message))

    expect(messages[0]).toBe('Batch ingest summary:')
    expect(messages.some((message) => message.includes('warnings 1'))).toBe(true)
    expect(messages).toContain('WARN summary:')
    expect(messages).toContain('xinyi: 1 issue(s) [BASELINE_MISSING]')
  })
})
