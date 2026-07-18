import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import AdmZip from 'adm-zip'
import { describe, expect, it } from 'vitest'
import { parsePaidCurbReferencePack } from '../../src/data/paidCurbReference'
import { writeTaoyuanPaidCurbReviewBundles } from './buildTaoyuanPaidCurbReference'
import {
  packageTaoyuanSourceReviews,
  parsePackageTaoyuanSourceReviewsArgs,
} from './packageTaoyuanSourceReviews'

const makeFixture = async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'taoyuan-source-review-package-'),
  )
  const referencePath = path.join(root, 'taoyuan-paid-curb.json')
  const reviewDir = path.join(root, 'taoyuan-human-review')
  const pack = parsePaidCurbReferencePack({
    schemaVersion: 1,
    regionId: 'taoyuan',
    evidenceKind: 'PAID_CURB_SEGMENT_TEXT',
    geometryAvailable: false,
    legalAnswerEligible: false,
    requiresHumanReview: true,
    source: {
      dataset: 'Taoyuan City curb parking segment list',
      relativePath: 'source.xml',
      sha256: 'a'.repeat(64),
      recordCount: 2,
    },
    districts: [
      {
        districtId: 'taoyuan-district',
        districtName: 'Taoyuan',
        boundaryFeatureId: '68000010',
        recordCount: 1,
        records: [
          {
            parkingSegmentId: 'segment-1',
            description: 'Road A',
            fareDescription: null,
            hasChargingPoint: false,
            sourceTownName: 'Taoyuan',
          },
        ],
      },
      {
        districtId: 'zhongli',
        districtName: 'Zhongli',
        boundaryFeatureId: '68000020',
        recordCount: 1,
        records: [
          {
            parkingSegmentId: 'segment-2',
            description: 'Road B',
            fareDescription: '20 per hour',
            hasChargingPoint: true,
            sourceTownName: 'Zhongli',
          },
        ],
      },
    ],
  })
  await fs.writeFile(
    referencePath,
    `${JSON.stringify(pack, null, 2)}\n`,
    'utf-8',
  )
  await writeTaoyuanPaidCurbReviewBundles({
    pack,
    reviewDistrictId: 'all',
    reviewDir,
  })
  const approvedPath = path.join(
    reviewDir,
    'taoyuan-district-paid-curb-review.csv',
  )
  await fs.writeFile(
    approvedPath,
    (
      await fs.readFile(approvedPath, 'utf-8')
    ).replace(
      ',false,false,,\r\n',
      ',false,false,APPROVED_SOURCE_TEXT,reviewed\r\n',
    ),
    'utf-8',
  )
  return { root, referencePath, reviewDir }
}

describe('packageTaoyuanSourceReviews', () => {
  it('parses city handoff options', () => {
    expect(
      parsePackageTaoyuanSourceReviewsArgs([
        'node',
        'package',
        '--review-dir',
        '.tmp/reviews',
        '--reference',
        'reference.json',
        '--out-dir',
        '.tmp/out',
        '--district',
        'zhongli,bade',
      ]),
    ).toMatchObject({
      reviewDir: '.tmp/reviews',
      referencePath: 'reference.json',
      outDir: '.tmp/out',
      districtIds: ['zhongli', 'bade'],
    })
  })

  it('packages only pending districts with templates and checksums', async () => {
    const fixture = await makeFixture()
    const outDir = path.join(fixture.root, 'out')
    const result = await packageTaoyuanSourceReviews({
      reviewDir: fixture.reviewDir,
      referencePath: fixture.referencePath,
      outDir,
      now: new Date('2026-07-18T00:00:00.000Z'),
    })

    expect(result.pass).toBe(true)
    expect(result.packaged).toEqual([
      expect.objectContaining({
        districtId: 'zhongli',
        status: 'pending',
        rows: 1,
        pendingRows: 1,
      }),
    ])
    expect(result.skippedApproved).toEqual(['taoyuan-district'])
    expect(result.pendingRows).toBe(1)
    expect(result.packageSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(path.basename(result.packagePath ?? '')).toBe(
      'taoyuan-source-review-handoff-20260718000000.zip',
    )

    const zip = new AdmZip(result.packagePath ?? '')
    const entries = zip.getEntries().map(({ entryName }) => entryName)
    expect(entries).toContain('reviews/zhongli-paid-curb-review.csv')
    expect(entries).toContain(
      'templates/zhongli-paid-curb-review.template.csv',
    )
    expect(entries).toContain(
      'manifests/zhongli-paid-curb-review.manifest.json',
    )
    expect(entries).toContain('reference/taoyuan-paid-curb.json')
    expect(entries).toContain('taoyuan-city-review-status.md')
    expect(entries).toContain('README.md')
    expect(entries).toContain('manifest.json')
    expect(entries).not.toContain(
      'reviews/taoyuan-district-paid-curb-review.csv',
    )
    const readme = zip
      .getEntry('README.md')
      ?.getData()
      .toString('utf-8')
    expect(readme).toContain('Approval confirms source transcription only')
    const manifest = zip
      .getEntry('manifest.json')
      ?.getData()
      .toString('utf-8')
    expect(manifest).toContain('"approvalScope": "source-text-only"')
    expect(manifest).not.toContain(fixture.root)
    await expect(fs.readFile(`${result.packagePath}.sha256`, 'utf-8')).resolves
      .toContain(result.packageSha256 ?? '')
  })

  it('blocks the handoff when immutable source text is invalid', async () => {
    const fixture = await makeFixture()
    const reviewPath = path.join(
      fixture.reviewDir,
      'zhongli-paid-curb-review.csv',
    )
    await fs.writeFile(
      reviewPath,
      (await fs.readFile(reviewPath, 'utf-8')).replace('Road B', 'Tampered'),
      'utf-8',
    )

    const result = await packageTaoyuanSourceReviews({
      reviewDir: fixture.reviewDir,
      referencePath: fixture.referencePath,
      outDir: path.join(fixture.root, 'out'),
    })

    expect(result.pass).toBe(false)
    expect(result.blocked).toEqual(['zhongli'])
    expect(result.packagePath).toBeNull()
    expect(result.errors).toContain(
      'zhongli: review artifacts are invalid.',
    )
  })

  it('rejects manifest paths that escape the review directory', async () => {
    const fixture = await makeFixture()
    const manifestPath = path.join(
      fixture.reviewDir,
      'zhongli-paid-curb-review.manifest.json',
    )
    const manifest = JSON.parse(
      await fs.readFile(manifestPath, 'utf-8'),
    ) as Record<string, unknown>
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify(
        { ...manifest, templateCsv: '../outside.csv' },
        null,
        2,
      )}\n`,
      'utf-8',
    )

    const result = await packageTaoyuanSourceReviews({
      reviewDir: fixture.reviewDir,
      referencePath: fixture.referencePath,
      outDir: path.join(fixture.root, 'out'),
    })

    expect(result.pass).toBe(false)
    expect(result.blocked).toEqual(['zhongli'])
    expect(result.packagePath).toBeNull()
    expect(result.errors).toContain(
      'zhongli: handoff path validation failed: templateCsv must be a filename inside the review directory',
    )
  })
})
