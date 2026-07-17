import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import AdmZip from 'adm-zip'
import { describe, expect, it } from 'vitest'
import {
  parsePackageHumanReviewsArgs,
  renderPackageHumanReviews,
  runPackageHumanReviews,
} from './packageHumanReviews'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'package-human-reviews-'))

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
      `${districtId},s2,marked_space_park,,,`,
      `${districtId},s3,no_stop,,,`,
      `${districtId},s4,no_stop,,,`,
      '',
    ].join('\n'),
  )
  await writeText(path.join(bundleDir, `${districtId}-review.csv`), 'copied source\n')
  await writeText(
    path.join(bundleDir, `${districtId}-next-review.csv`),
    [
      'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
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
    dataset: { datasetHash: `${districtId}-hash` },
    rows: { total: 4 },
  })
  return { bundleDir, sourcePath }
}

const pendingRows = (districtId: string) => [
  `2,${districtId},s1,marked_space_park,,,`,
  `3,${districtId},s2,marked_space_park,,,`,
  `4,${districtId},s3,no_stop,,,`,
  `5,${districtId},s4,no_stop,,,`,
]

const readyRows = (districtId: string) => [
  `2,${districtId},s1,marked_space_park,LEGAL,observed legal curb sign,2026-05-10T00:00:00.000Z`,
  `3,${districtId},s2,marked_space_park,ILLEGAL,observed no parking sign,2026-05-10T00:00:00.000Z`,
  `4,${districtId},s3,no_stop,LEGAL,observed legal curb sign,2026-05-10T00:00:00.000Z`,
  `5,${districtId},s4,no_stop,ILLEGAL,observed no stopping sign,2026-05-10T00:00:00.000Z`,
]

describe('packageHumanReviews', () => {
  it('parses options', () => {
    expect(
      parsePackageHumanReviewsArgs([
        'node',
        'packageHumanReviews',
        '--review-root',
        '.tmp',
        '--config-root',
        'configs/expansion',
        '--district',
        'daan,zhongshan',
        '--out-dir',
        '.tmp/reviews',
        '--publish-gate-summary',
        '.tmp/publish_gate_summary.json',
        '--summary',
        '.tmp/summary.md',
        '--json',
      ]),
    ).toEqual({
      reviewRoot: '.tmp',
      configRoot: 'configs/expansion',
      districtIds: ['daan', 'zhongshan'],
      all: false,
      outDir: '.tmp/reviews',
      publishGateSummaryPath: '.tmp/publish_gate_summary.json',
      summaryPath: '.tmp/summary.md',
      includeAudit: true,
      json: true,
    })
  })

  it('packages only bundles that still need human review', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    await writeBundle(root, 'daan', pendingRows('daan'))
    await writeBundle(root, 'zhongshan', readyRows('zhongshan'))

    const result = await runPackageHumanReviews({
      reviewRoot: root,
      configRoot: 'configs/expansion',
      outDir,
      districtIds: ['daan', 'zhongshan'],
      publishGateSummaryPath: null,
      now: new Date('2026-05-10T00:00:00.000Z'),
    })

    expect(result.pass).toBe(true)
    expect(result.packages.map((entry) => entry.districtId)).toEqual(['daan'])
    expect(result.packages.map((entry) => entry.bundleId)).toEqual(['daan'])
    expect(result.skipped).toEqual([
      {
        bundleId: 'zhongshan',
        districtId: 'zhongshan',
        status: 'ready-to-finalize',
        reason: 'human review is already sufficient; use ops:p0-finalize-ready-reviews',
      },
    ])

    const packageEntry = result.packages[0]
    expect(packageEntry).toBeDefined()
    if (!packageEntry) {
      throw new Error('expected packaged daan entry')
    }
    const zip = new AdmZip(packageEntry.zipPath)
    const entries = zip.getEntries().map((entry) => entry.entryName).sort()
    expect(entries).toContain('daan/README.md')
    expect(entries).toContain('daan/human-review-index.md')
    expect(entries).toContain('daan/manifest.json')
    expect(entries).toContain('daan/review/handoff-audit.md')
    expect(entries).toContain('daan/review/handoff-audit.json')
    expect(entries).toContain('daan/review/priority-review.md')
    expect(entries).toContain('daan/review/priority-review.csv')
    expect(entries).toContain('daan/review/priority-review.json')
    expect(entries).toContain('daan/review/daan-next-review.csv')
    expect(entries).toContain('daan/review/daan-next-review.geojson')
    const auditEntry = zip.getEntry('daan/review/handoff-audit.md')
    expect(auditEntry?.getData().toString('utf-8')).toContain(
      'Review handoff audit: PASS',
    )
    const readmeEntry = zip.getEntry('daan/README.md')
    const readme = readmeEntry?.getData().toString('utf-8')
    expect(readme).toContain('Minimum remaining new reviews: 4')
    expect(readme).toContain('## Review Options')
    expect(readme).toContain(
      'Do not run the full handoff finalize command unless the full handoff CSV has been filled.',
    )
    const priorityCsvEntry = zip.getEntry('daan/review/priority-review.csv')
    expect(priorityCsvEntry?.getData().toString('utf-8')).toContain(
      'bundleId,districtId,status,minimumNewReviews,rank,handoffRowNumber',
    )
    if (!packageEntry.priorityValidationCommand) {
      throw new Error('expected priority validation command for canonical district')
    }
    expect(packageEntry.priorityValidationCommand).toContain(
      'npm run ops:p0-validate-priority-review -- --district daan',
    )
    expect(packageEntry.priorityValidationCommand.replace(/\\/g, '/')).toContain(
      '--config "configs/expansion/daan.json"',
    )
    expect(packageEntry.priorityValidationCommand.replace(/\\/g, '/')).toContain(
      '--answer-cases "configs/expansion/daan.answer-cases.json"',
    )
    expect(renderPackageHumanReviews(result)).toContain('Human review package: PASS')
    expect(renderPackageHumanReviews(result)).toContain(
      'Validate priority review: npm run ops:p0-validate-priority-review',
    )
  })

  it('keeps district and area-scoped handoff packages isolated', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    const { bundleDir } = await writeBundle(root, 'beitou', pendingRows('beitou'))
    const shipaiBundleDir = path.join(root, 'shipai-human-review')
    await fs.cp(bundleDir, shipaiBundleDir, { recursive: true })

    const result = await runPackageHumanReviews({
      reviewRoot: root,
      configRoot: 'configs/expansion',
      outDir,
      districtIds: ['beitou', 'shipai'],
      publishGateSummaryPath: null,
      now: new Date('2026-05-10T00:00:00.000Z'),
    })

    expect(result.pass).toBe(true)
    expect(result.packages.map((entry) => entry.bundleId).sort()).toEqual([
      'beitou',
      'shipai',
    ])
    expect(new Set(result.packages.map((entry) => entry.zipPath)).size).toBe(2)

    const shipaiPackage = result.packages.find(
      (entry) => entry.bundleId === 'shipai',
    )
    if (!shipaiPackage) {
      throw new Error('expected Shipai review package')
    }
    expect(shipaiPackage).toMatchObject({
      districtId: 'beitou',
      status: 'ready-for-review',
    })
    expect(path.basename(shipaiPackage.zipPath)).toBe(
      'shipai-human-review-20260510000000.zip',
    )
    const zip = new AdmZip(shipaiPackage.zipPath)
    const entries = zip.getEntries().map((entry) => entry.entryName)
    expect(entries).toContain('shipai/README.md')
    expect(entries).toContain('shipai/manifest.json')
    expect(entries).toContain('shipai/review/beitou-next-review.csv')
    const audit = zip
      .getEntry('shipai/review/handoff-audit.json')
      ?.getData()
      .toString('utf-8')
    expect(audit).toContain('shipai-human-review')
    expect(audit).not.toContain('beitou-human-review')
    const manifest = JSON.parse(
      zip.getEntry('shipai/manifest.json')?.getData().toString('utf-8') ?? '{}',
    ) as Record<string, unknown>
    expect(manifest).toMatchObject({
      bundleId: 'shipai',
      districtId: 'beitou',
      priorityValidationCommand: null,
      finalizeCommand: null,
    })
    expect(shipaiPackage.priorityValidationCommand).toBeNull()
    const readme = zip
      .getEntry('shipai/README.md')
      ?.getData()
      .toString('utf-8')
    expect(readme).toContain(
      'Do not finalize beitou from this area-alias bundle alone.',
    )
    expect(readme).toContain('Supplemental area review only')
    expect(readme).not.toContain('ops:p0-validate-priority-review')
    expect(readme).not.toContain('ops:p0-finalize-review')
    expect(renderPackageHumanReviews(result)).toContain(
      'Supplemental area review only; no independent validation/finalize command.',
    )
    expect(result.warnings).toEqual([
      '[beitou] area alias shipai is supplemental review evidence for beitou and cannot finalize the parent district independently',
    ])
  })

  it('blocks when no district filter or all flag is supplied', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', pendingRows('daan'))

    const result = await runPackageHumanReviews({
      reviewRoot: root,
      publishGateSummaryPath: null,
    })

    expect(result.pass).toBe(false)
    expect(result.packages).toEqual([])
    expect(result.errors).toContain('Pass at least one --district value or --all.')
  })
})
