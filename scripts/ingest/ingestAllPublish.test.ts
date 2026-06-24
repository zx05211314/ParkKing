import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  runIngestAllOutputWorkflow,
  writeIngestAllReport,
} from './ingestAllPublish'
import type { IngestAllReport, IngestDistrictSummary } from './ingestAllTypes'

const report: IngestAllReport = {
  generatedAt: '2026-03-21T00:00:00.000Z',
  districts: [
    {
      districtId: 'xinyi',
      districtName: 'Xinyi',
      datasetHash: 'hash-1',
      schemaVersion: 3,
      generatedAt: '2026-03-21T00:00:00.000Z',
      counts: null,
      bbox: null,
      intersectionsReport: null,
      riskTagCounts: null,
      evaluations: {
        day: null,
        night: null,
      },
      reasonCodes: null,
      thresholds: {
        counts: {
          segments: 1,
          intersections: 1,
          inferredCandidates: 1,
          signOverrides: 1,
        },
        tierDistributionMaxDeltaPct: 1,
        perfRegressionMaxDeltaPct: 1,
        maxReasonCodeDeltaPct: 1,
        maxNewReasonCodePct: 1,
      },
      baselineStatus: 'missing',
      baselineCandidate: null,
      warnings: [],
    },
  ],
}

describe('ingestAllPublish', () => {
  it('writes generated and public reports for non-dry runs', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-publish-'))
    const paths = await writeIngestAllReport({
      report,
      dryRun: false,
      cwd,
      logger: () => {},
    })

    await expect(fs.readFile(paths.reportPath, 'utf-8')).resolves.toContain('hash-1')
    await expect(fs.readFile(paths.publicReportPath, 'utf-8')).resolves.toContain(
      'hash-1',
    )
    expect(paths.publicReportPath).toMatch(/public[\\/]data[\\/]generated/)
  })

  it('skips registry writes when failures remain', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-failures-'))
    const messages: string[] = []
    const summaries: IngestDistrictSummary[] = [
      {
        districtId: 'xinyi',
        label: 'xinyi.json',
        datasetHash: 'hash-1',
        counts: null,
        bbox: null,
        dayEval: null,
        nightEval: null,
        intersectionsReport: null,
        riskTagCounts: null,
        districtName: 'Xinyi',
        schemaVersion: 3,
        generatedAt: '2026-03-21T00:00:00.000Z',
        warnings: [],
        baselineStatus: 'missing',
        baselineCandidate: null,
        thresholds: report.districts[0].thresholds,
        retention: {
          maxBackupsPerDistrict: 5,
          maxBackupAgeDays: 30,
        },
        config: {} as never,
      },
    ]

    await runIngestAllOutputWorkflow({
      summaries,
      report,
      failures: ['xinyi.json: failed'],
      args: {
        allowWarn: false,
        allowFail: false,
        overrideReason: null,
        dryRun: false,
        reportOnly: false,
      },
      cwd,
      logger: (message) => messages.push(message),
    })

    expect(messages).toContain('Skipped registry.json write due to ingest failures.')
    await expect(
      fs.access(path.resolve(cwd, 'public/data/generated/registry.json')),
    ).rejects.toThrow()
  })
})
