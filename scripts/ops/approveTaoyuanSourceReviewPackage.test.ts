import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import AdmZip from 'adm-zip'
import { parse as parseCsv } from 'csv-parse/sync'
import { afterEach, describe, expect, it } from 'vitest'
import { parsePaidCurbReferencePack } from '../../src/data/paidCurbReference'
import {
  approveTaoyuanSourceReviewPackage,
  type ApproveTaoyuanSourceReviewPackageOptions,
} from './approveTaoyuanSourceReviewPackage'
import type { CsvRow } from './validateTaoyuanPaidCurbReview'

const roots: string[] = []
const sha256 = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const escapeCsvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const makeFixture = async (status = '') => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'taoyuan-review-approval-'),
  )
  roots.push(root)
  const referencePath = path.join(
    process.cwd(),
    'public/data/reference/taoyuan-paid-curb.json',
  )
  const referenceBuffer = await fs.readFile(referencePath)
  const pack = parsePaidCurbReferencePack(
    JSON.parse(referenceBuffer.toString('utf-8')),
  )
  const district = pack.districts.find(
    ({ districtId }) => districtId === 'guanyin',
  )!
  const columns = [
    'parking_segment_id',
    'district_id',
    'district_name',
    'description',
    'fare_description',
    'has_charging_point',
    'geometry_available',
    'legal_answer_eligible',
    'source_text_review_status',
    'source_text_review_note',
  ]
  const rows = district.records.map((record) => ({
    parking_segment_id: record.parkingSegmentId,
    district_id: district.districtId,
    district_name: district.districtName,
    description: record.description,
    fare_description: record.fareDescription ?? '',
    has_charging_point: String(record.hasChargingPoint),
    geometry_available: 'false',
    legal_answer_eligible: 'false',
    source_text_review_status: status,
    source_text_review_note:
      status === 'UNCLEAR' ? 'requires another review' : '',
  }))
  const reviewBuffer = Buffer.from(
    `${[
      columns.join(','),
      ...rows.map((row) =>
        columns
          .map((column) =>
            escapeCsvCell(row[column as keyof typeof row]),
          )
          .join(','),
      ),
    ].join('\n')}\n`,
    'utf-8',
  )
  const manifestBuffer = Buffer.from(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        districtId: district.districtId,
        sourceSha256: pack.source.sha256,
        sourceRecordCount: pack.source.recordCount,
        reviewRecordCount: district.recordCount,
        geometryAvailable: false,
        legalAnswerEligible: false,
        allowedStatuses: [
          'APPROVED_SOURCE_TEXT',
          'NEEDS_CORRECTION',
          'UNCLEAR',
        ],
        reviewCsv: 'guanyin-paid-curb-review.csv',
        templateCsv: 'guanyin-paid-curb-review.template.csv',
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )
  const files = [
    {
      label: 'reviewCsv',
      archivePath: 'reviews/guanyin-paid-curb-review.csv',
      buffer: reviewBuffer,
    },
    {
      label: 'templateCsv',
      archivePath: 'templates/guanyin-paid-curb-review.template.csv',
      buffer: reviewBuffer,
    },
    {
      label: 'reviewManifest',
      archivePath: 'manifests/guanyin-paid-curb-review.manifest.json',
      buffer: manifestBuffer,
    },
    {
      label: 'sourceReference',
      archivePath: 'reference/taoyuan-paid-curb.json',
      buffer: referenceBuffer,
    },
  ]
  const zip = new AdmZip()
  files.forEach((file) => zip.addFile(file.archivePath, file.buffer))
  zip.addFile('README.md', Buffer.from('review\n'))
  zip.addFile('taoyuan-city-review-status.md', Buffer.from('pending\n'))
  zip.addFile(
    'manifest.json',
    Buffer.from(
      `${JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-07-18T00:00:00.000Z',
        safety: {
          geometryAvailable: false,
          legalAnswerEligible: false,
          approvalScope: 'source-text-only',
        },
        districts: [
          {
            districtId: 'guanyin',
            status: status ? 'needs-resolution' : 'pending',
            rows: rows.length,
            pendingRows: status ? 0 : rows.length,
            reviewCsv: 'guanyin-paid-curb-review.csv',
            reviewManifest: 'guanyin-paid-curb-review.manifest.json',
            templateCsv: 'guanyin-paid-curb-review.template.csv',
          },
        ],
        skippedApproved: [],
        files: files.map((file) => ({
          label: file.label,
          archivePath: file.archivePath,
          bytes: file.buffer.length,
          sha256: sha256(file.buffer),
        })),
      })}\n`,
    ),
  )
  const packagePath = path.join(root, 'review.zip')
  zip.writeZip(packagePath)
  const packageBuffer = await fs.readFile(packagePath)
  const options: ApproveTaoyuanSourceReviewPackageOptions = {
    packagePath,
    expectedPackageSha256: sha256(packageBuffer),
    approveAll: true,
    reviewDir: path.join(root, 'review'),
    referencePath,
    receiptPath: path.join(root, 'receipt.json'),
    now: new Date('2026-07-18T01:00:00.000Z'),
  }
  return { options, rows }
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  )
})

describe('approveTaoyuanSourceReviewPackage', () => {
  it('approves a hash-pinned package without changing safety fields', async () => {
    const { options, rows } = await makeFixture()
    const result = await approveTaoyuanSourceReviewPackage(options)

    expect(result.receipt).toMatchObject({
      approvedAt: '2026-07-18T01:00:00.000Z',
      approvalScope: 'source-text-only',
      totalApprovedRows: rows.length,
      safety: {
        geometryAvailable: false,
        legalAnswerEligible: false,
      },
    })
    const approved = parseCsv(
      await fs.readFile(
        path.join(options.reviewDir!, 'guanyin-paid-curb-review.csv'),
      ),
      { columns: true, skip_empty_lines: true },
    ) as CsvRow[]
    expect(approved).toHaveLength(rows.length)
    expect(
      approved.every(
        (row) => row.source_text_review_status === 'APPROVED_SOURCE_TEXT',
      ),
    ).toBe(true)
    expect(approved.every((row) => row.legal_answer_eligible === 'false')).toBe(
      true,
    )
  })

  it('rejects a package whose outer SHA-256 is not explicitly pinned', async () => {
    const { options } = await makeFixture()
    await expect(
      approveTaoyuanSourceReviewPackage({
        ...options,
        expectedPackageSha256: '0'.repeat(64),
      }),
    ).rejects.toThrow('Review package SHA-256')
  })

  it('does not override correction or unclear decisions', async () => {
    const { options } = await makeFixture('UNCLEAR')
    await expect(
      approveTaoyuanSourceReviewPackage(options),
    ).rejects.toThrow('contain a correction or unclear decision')
  })

  it('requires an explicit bulk-approval flag', async () => {
    const { options } = await makeFixture()
    await expect(
      approveTaoyuanSourceReviewPackage({
        ...options,
        approveAll: false,
      }),
    ).rejects.toThrow('--approve-all')
  })
})
