import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildReviewHandoffPriorityRows,
  parseReviewHandoffAuditArgs,
  renderReviewHandoffAudit,
  renderReviewHandoffPriorityCsv,
  renderReviewHandoffPriorityGuide,
  runReviewHandoffAudit,
} from './reviewHandoffAudit'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'review-handoff-audit-'))

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const writeJson = async (targetPath: string, payload: unknown) =>
  writeText(targetPath, `${JSON.stringify(payload, null, 2)}\n`)

const writeBundle = async (
  root: string,
  districtId: string,
  handoffRows: string[],
) => {
  const bundleDir = path.join(root, `${districtId}-human-review`)
  const sourcePath = path.join(root, `${districtId}-review.csv`)
  await writeText(
    sourcePath,
    [
      'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
      `${districtId},s1,marked_space_park,,,`,
      `${districtId},s2,no_stop,,,`,
      '',
    ].join('\n'),
  )
  await writeText(path.join(bundleDir, `${districtId}-review.csv`), 'copied source\n')
  await writeText(
    path.join(bundleDir, `${districtId}-next-review.csv`),
    [
      'sourceRowNumber,districtId,segmentId,reviewBucket,reviewPlanRank,reviewPlanReason,mapsUrl,streetViewUrl,reviewStatus,reviewNote,createdAt',
      ...handoffRows,
      '',
    ].join('\n'),
  )
  await writeText(path.join(bundleDir, `${districtId}-next-review.md`), '# review\n')
  await writeText(path.join(bundleDir, `${districtId}-next-review.geojson`), '{}\n')
  await writeText(path.join(bundleDir, `${districtId}-review.review.md`), '# source\n')
  await writeJson(path.join(bundleDir, `${districtId}-review.manifest.json`), {
    districtId,
    csvPath: sourcePath,
    rows: { total: 2 },
  })
  return { bundleDir, sourcePath }
}

describe('reviewHandoffAudit', () => {
  it('parses options', () => {
    expect(
      parseReviewHandoffAuditArgs([
        'node',
        'reviewHandoffAudit',
        '--review-root',
        '.tmp',
        '--district',
        'daan,zhongshan',
        '--publish-gate-summary',
        '.tmp/publish_gate_summary.json',
        '--strict',
        '--out',
        '.tmp/audit.md',
        '--json-out',
        '.tmp/audit.json',
        '--priority-out',
        '.tmp/priority.md',
        '--priority-csv-out',
        '.tmp/priority.csv',
        '--priority-json-out',
        '.tmp/priority.json',
        '--summary',
        '.tmp/summary.md',
        '--json',
      ]),
    ).toEqual({
      reviewRoot: '.tmp',
      districtIds: ['daan', 'zhongshan'],
      all: false,
      publishGateSummaryPath: '.tmp/publish_gate_summary.json',
      strict: true,
      outPath: '.tmp/audit.md',
      jsonOutPath: '.tmp/audit.json',
      priorityOutPath: '.tmp/priority.md',
      priorityCsvOutPath: '.tmp/priority.csv',
      priorityJsonOutPath: '.tmp/priority.json',
      summaryPath: '.tmp/summary.md',
      json: true,
    })
  })

  it('reports row-level pending and invalid reviewed handoff issues', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', [
      '2,daan,s1,marked_space_park,1,bucket:marked_space_park,https://maps.test,https://street.test,,,',
      '3,daan,s2,no_stop,2,bucket:no_stop,,,LEGAL,,2026-05-10T00:00:00.000Z',
      '4,daan,s3,no_stop,,,,,MAYBE,observed,2026-05-10T00:00:00.000Z',
      '5,daan,s4,no_stop,,,,,ILLEGAL,observed,2026-05-10T00:00:00.000Z',
    ])

    const result = await runReviewHandoffAudit({
      reviewRoot: root,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
    })
    const entry = result.entries[0]

    expect(result.pass).toBe(true)
    expect(entry).toMatchObject({
      rows: 4,
      estimatedMinimumNewReviews: 2,
      remainingMinimumNewReviews: 3,
      reviewedRows: 3,
      validReviewedRows: 1,
      pendingRows: 1,
      invalidRows: 2,
      statusCounts: {
        LEGAL: 1,
        MAYBE: 1,
        ILLEGAL: 1,
      },
      reviewedBucketCounts: {
        no_stop: 3,
      },
    })
    expect(entry?.priorityRows).toMatchObject([
      {
        rowNumber: 2,
        sourceRowNumber: '2',
        rank: 1,
        reviewState: 'pending',
        reasons: ['bucket:marked_space_park'],
        streetViewUrl: 'https://street.test',
      },
      {
        rowNumber: 3,
        sourceRowNumber: '3',
        rank: 2,
        reviewState: 'invalid',
        reasons: ['bucket:no_stop'],
      },
    ])
    expect(entry?.issues).toMatchObject([
      {
        rowNumber: 2,
        sourceRowNumber: '2',
        severity: 'pending',
        fields: ['reviewStatus', 'reviewNote', 'createdAt'],
      },
      {
        rowNumber: 3,
        sourceRowNumber: '3',
        severity: 'error',
        fields: ['reviewNote'],
      },
      {
        rowNumber: 4,
        sourceRowNumber: '4',
        severity: 'error',
        fields: ['valid reviewStatus'],
      },
    ])
    expect(renderReviewHandoffAudit(result)).toContain(
      'rank 1: row 2 (source row 2)',
    )
    expect(renderReviewHandoffAudit(result)).toContain(
      'row 2 (source row 2): pending',
    )
    expect(buildReviewHandoffPriorityRows(result)).toMatchObject([
      {
        districtId: 'daan',
        rank: 1,
        rowNumber: 2,
        sourceRowNumber: '2',
        segmentId: 's1',
        reviewBucket: 'marked_space_park',
        streetViewUrl: 'https://street.test',
      },
      {
        districtId: 'daan',
        rank: 2,
        rowNumber: 3,
        sourceRowNumber: '3',
        segmentId: 's2',
        reviewBucket: 'no_stop',
      },
    ])
    expect(renderReviewHandoffPriorityGuide(result)).toContain(
      '| Rank | Handoff row | Source row | Bucket | Segment | Reasons | Street View |',
    )
    expect(renderReviewHandoffPriorityCsv(result)).toContain(
      'districtId,status,minimumNewReviews,rank,handoffRowNumber',
    )
    expect(renderReviewHandoffPriorityCsv(result)).toContain(
      'daan,incomplete,3,1,2,2,s1,marked_space_park',
    )
  })

  it('reduces remaining priority rows after valid partial handoff review', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', [
      '2,daan,s1,marked_space_park,1,bucket:marked_space_park,https://maps.test,https://street-1.test,LEGAL,observed sign,2026-05-10T00:00:00.000Z',
      '3,daan,s2,marked_space_park,2,bucket:marked_space_park,https://maps.test,https://street-2.test,,,',
      '4,daan,s3,no_stop,3,bucket:no_stop,https://maps.test,https://street-3.test,ILLEGAL,observed sign,2026-05-10T00:00:00.000Z',
      '5,daan,s4,no_stop,4,bucket:no_stop,https://maps.test,https://street-4.test,,,',
      '6,daan,s5,no_stop,5,bucket:no_stop,https://maps.test,https://street-5.test,,,',
    ])

    const result = await runReviewHandoffAudit({
      reviewRoot: root,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
    })
    const entry = result.entries[0]

    expect(entry).toMatchObject({
      rows: 5,
      reviewedRows: 2,
      validReviewedRows: 2,
      pendingRows: 3,
      invalidRows: 0,
      remainingMinimumNewReviews: 2,
    })
    expect(buildReviewHandoffPriorityRows(result)).toMatchObject([
      {
        districtId: 'daan',
        minimumNewReviews: 2,
        rank: 2,
        rowNumber: 3,
        segmentId: 's2',
        reviewBucket: 'marked_space_park',
      },
      {
        districtId: 'daan',
        minimumNewReviews: 2,
        rank: 4,
        rowNumber: 5,
        segmentId: 's4',
        reviewBucket: 'no_stop',
      },
    ])
    expect(buildReviewHandoffPriorityRows(result).map((row) => row.rank)).not.toContain(1)
    expect(renderReviewHandoffAudit(result)).toContain(
      'Minimum remaining new reviews: 2',
    )
    expect(renderReviewHandoffAudit(result)).not.toContain(
      'rank 1: row 2 (source row 2)',
    )
    expect(renderReviewHandoffPriorityGuide(result)).toContain(
      '| 2 | 3 | 3 | marked_space_park | s2 | bucket:marked_space_park | https://street-2.test |',
    )
  })

  it('fails strict mode when handoff rows are pending or invalid', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', [
      '2,daan,s1,marked_space_park,,,,,,,',
      '3,daan,s2,no_stop,,,,,LEGAL,,2026-05-10T00:00:00.000Z',
    ])

    const result = await runReviewHandoffAudit({
      reviewRoot: root,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      strict: true,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'daan: 1 pending row(s), 1 invalid reviewed row(s)',
    )
  })

  it('marks reviewed handoff rows with invalid timestamps as invalid', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', [
      '2,daan,s1,marked_space_park,1,bucket:marked_space_park,,,LEGAL,observed,not-a-date',
    ])

    const result = await runReviewHandoffAudit({
      reviewRoot: root,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
    })
    const entry = result.entries[0]

    expect(result.pass).toBe(true)
    expect(entry).toMatchObject({
      reviewedRows: 1,
      validReviewedRows: 0,
      invalidRows: 1,
    })
    expect(entry?.issues).toMatchObject([
      {
        rowNumber: 2,
        severity: 'error',
        fields: ['valid createdAt'],
      },
    ])
  })

  it('blocks without district filter or all flag', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', [
      '2,daan,s1,marked_space_park,,,,,LEGAL,observed,2026-05-10T00:00:00.000Z',
    ])

    const result = await runReviewHandoffAudit({
      reviewRoot: root,
      publishGateSummaryPath: null,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain('Pass at least one --district value or --all.')
    expect(result.entries).toEqual([])
  })
})
