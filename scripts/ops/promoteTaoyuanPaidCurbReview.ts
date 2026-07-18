import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import { parsePaidCurbReferencePack } from '../../src/data/paidCurbReference'
import {
  type CsvRow,
  type ReviewManifest,
  sha256TaoyuanReviewCsv,
  validateTaoyuanPaidCurbReview,
} from './validateTaoyuanPaidCurbReview'

const DEFAULT_DISTRICT = 'taoyuan-district'
const DEFAULT_INPUT_DIR = '.tmp/taoyuan-human-review'
const DEFAULT_OUTPUT_DIR = 'review-evidence/taoyuan'
const DEFAULT_REFERENCE = 'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_RECEIPT = '.tmp/taoyuan-review-promotion.json'

export interface PromoteTaoyuanPaidCurbReviewOptions {
  districtId?: string
  inputPath?: string | null
  manifestPath?: string | null
  referencePath?: string | null
  outputDir?: string | null
  receiptPath?: string | null
  now?: Date
}

export interface TaoyuanPaidCurbReviewPromotionReceipt {
  schemaVersion: 1
  promotedAt: string
  districtId: string
  source: {
    reviewPath: string
    manifestPath: string
    referencePath: string
    sourceSha256: string
    reviewSha256: string
    manifestSha256: string
  }
  destination: {
    reviewPath: string
    manifestPath: string
    manifestSha256: string
  }
  validation: {
    approved: true
    approvedRows: number
    expectedRows: number
    geometryAvailable: false
    legalAnswerEligible: false
  }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const portablePath = (targetPath: string) => {
  const relative = path.relative(process.cwd(), targetPath)
  return (relative || '.').replace(/\\/g, '/')
}

const sha256 = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const replaceFileAtomically = async (targetPath: string, buffer: Buffer) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.tmp-${suffix}`,
  )
  await fs.writeFile(temporaryPath, buffer)
  try {
    await fs.rename(temporaryPath, targetPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      await fs.rm(temporaryPath, { force: true })
      throw error
    }
    await fs.rm(targetPath, { force: true })
    await fs.rename(temporaryPath, targetPath)
  }
}

const readJson = async <T>(targetPath: string): Promise<T> =>
  JSON.parse(await fs.readFile(targetPath, 'utf-8')) as T

export const promoteTaoyuanPaidCurbReview = async (
  options: PromoteTaoyuanPaidCurbReviewOptions = {},
) => {
  const districtId = options.districtId ?? DEFAULT_DISTRICT
  const baseName = `${districtId}-paid-curb-review`
  const inputDir = path.resolve(DEFAULT_INPUT_DIR)
  const inputPath = path.resolve(
    options.inputPath ?? path.join(inputDir, `${baseName}.csv`),
  )
  const manifestPath = path.resolve(
    options.manifestPath ?? path.join(inputDir, `${baseName}.manifest.json`),
  )
  const referencePath = path.resolve(
    options.referencePath ?? DEFAULT_REFERENCE,
  )
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR)
  const destinationReviewPath = path.join(outputDir, `${baseName}.csv`)
  const destinationManifestPath = path.join(
    outputDir,
    `${baseName}.manifest.json`,
  )
  const receiptPath = path.resolve(options.receiptPath ?? DEFAULT_RECEIPT)

  const [reviewBuffer, manifestBuffer, pack] = await Promise.all([
    fs.readFile(inputPath),
    fs.readFile(manifestPath),
    readJson<unknown>(referencePath).then(parsePaidCurbReferencePack),
  ])
  const rows = parseCsv(reviewBuffer, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[]
  const manifest = JSON.parse(manifestBuffer.toString('utf-8')) as ReviewManifest
  const validation = validateTaoyuanPaidCurbReview({
    pack,
    manifest,
    rows,
    districtId,
    reviewSha256: sha256TaoyuanReviewCsv(reviewBuffer),
    requireApproved: true,
  })
  if (!validation.pass || !validation.approved) {
    throw new Error(
      `Taoyuan paid-curb review failed promotion gate:\n${validation.errors
        .map((error) => `- ${error}`)
        .join('\n')}`,
    )
  }

  const promotedManifest: ReviewManifest = {
    schemaVersion: manifest.schemaVersion,
    districtId: manifest.districtId,
    sourceSha256: manifest.sourceSha256,
    sourceRecordCount: manifest.sourceRecordCount,
    reviewRecordCount: manifest.reviewRecordCount,
    geometryAvailable: false,
    legalAnswerEligible: false,
    allowedStatuses: manifest.allowedStatuses,
    reviewCsv: path.basename(destinationReviewPath),
    reviewSha256: sha256TaoyuanReviewCsv(reviewBuffer),
    approvedRecordCount: validation.statusCounts.APPROVED_SOURCE_TEXT,
  }
  const promotedManifestBuffer = Buffer.from(
    `${JSON.stringify(promotedManifest, null, 2)}\n`,
    'utf-8',
  )
  const receipt: TaoyuanPaidCurbReviewPromotionReceipt = {
    schemaVersion: 1,
    promotedAt: (options.now ?? new Date()).toISOString(),
    districtId,
    source: {
      reviewPath: portablePath(inputPath),
      manifestPath: portablePath(manifestPath),
      referencePath: portablePath(referencePath),
      sourceSha256: pack.source.sha256,
      reviewSha256: sha256TaoyuanReviewCsv(reviewBuffer),
      manifestSha256: sha256(manifestBuffer),
    },
    destination: {
      reviewPath: portablePath(destinationReviewPath),
      manifestPath: portablePath(destinationManifestPath),
      manifestSha256: sha256(promotedManifestBuffer),
    },
    validation: {
      approved: true,
      approvedRows: validation.statusCounts.APPROVED_SOURCE_TEXT,
      expectedRows: validation.expectedRows,
      geometryAvailable: false,
      legalAnswerEligible: false,
    },
  }

  await replaceFileAtomically(destinationReviewPath, reviewBuffer)
  await replaceFileAtomically(destinationManifestPath, promotedManifestBuffer)
  await replaceFileAtomically(
    receiptPath,
    Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf-8'),
  )

  return {
    inputPath,
    manifestPath,
    referencePath,
    destinationReviewPath,
    destinationManifestPath,
    receiptPath,
    receipt,
  }
}

const run = async () => {
  const result = await promoteTaoyuanPaidCurbReview({
    districtId: getArgValue(process.argv, '--district') ?? undefined,
    inputPath: getArgValue(process.argv, '--input'),
    manifestPath: getArgValue(process.argv, '--manifest'),
    referencePath: getArgValue(process.argv, '--reference'),
    outputDir: getArgValue(process.argv, '--out-dir'),
    receiptPath: getArgValue(process.argv, '--receipt'),
  })
  console.log(
    `Promoted ${result.receipt.validation.approvedRows}/${result.receipt.validation.expectedRows} approved Taoyuan source-text rows.`,
  )
  console.log(`Review SHA-256: ${result.receipt.source.reviewSha256}`)
  console.log(`Destination: ${path.dirname(result.destinationReviewPath)}`)
  console.log(`Receipt: ${result.receiptPath}`)
  console.log('Geometry and legal-answer eligibility remain false.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
