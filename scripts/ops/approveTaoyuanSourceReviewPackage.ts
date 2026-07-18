import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import { parse as parseCsv } from 'csv-parse/sync'
import { parsePaidCurbReferencePack } from '../../src/data/paidCurbReference'
import {
  type CsvRow,
  type ReviewManifest,
  validateTaoyuanPaidCurbReview,
} from './validateTaoyuanPaidCurbReview'

const DEFAULT_REVIEW_DIR = '.tmp/taoyuan-human-review'
const DEFAULT_REFERENCE = 'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_RECEIPT = '.tmp/taoyuan-source-review-approval.json'
const APPROVED_STATUS = 'APPROVED_SOURCE_TEXT'
const REVIEW_COLUMNS = [
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
] as const

interface PackageFile {
  label: string
  archivePath: string
  bytes: number
  sha256: string
}

interface PackageDistrict {
  districtId: string
  status: string
  rows: number
  pendingRows: number
  reviewCsv: string
  reviewManifest: string
  templateCsv: string
}

interface PackageManifest {
  schemaVersion: number
  generatedAt: string
  safety: {
    geometryAvailable: boolean
    legalAnswerEligible: boolean
    approvalScope: string
  }
  districts: PackageDistrict[]
  skippedApproved: string[]
  files: PackageFile[]
}

export interface ApproveTaoyuanSourceReviewPackageOptions {
  packagePath: string
  expectedPackageSha256: string
  approveAll: boolean
  reviewDir?: string
  referencePath?: string
  receiptPath?: string
  now?: Date
}

export interface TaoyuanSourceReviewApprovalReceipt {
  schemaVersion: 1
  approvedAt: string
  approvalScope: 'source-text-only'
  packagePath: string
  packageSha256: string
  referencePath: string
  reviewDir: string
  approvedDistricts: Array<{
    districtId: string
    approvedRows: number
    reviewSha256: string
  }>
  totalApprovedRows: number
  safety: {
    geometryAvailable: false
    legalAnswerEligible: false
  }
}

const sha256 = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const portablePath = (targetPath: string) => {
  const relative = path.relative(process.cwd(), targetPath)
  return (relative || '.').replace(/\\/g, '/')
}

const normalizeStatus = (value: unknown) =>
  String(value ?? '').trim().toUpperCase()

const isSafeArchivePath = (archivePath: string) =>
  archivePath.length > 0 &&
  !archivePath.includes('\\') &&
  !path.posix.isAbsolute(archivePath) &&
  path.posix.normalize(archivePath) === archivePath &&
  archivePath !== '..' &&
  !archivePath.startsWith('../')

const requireFilename = (value: string, label: string) => {
  if (!value || path.posix.basename(value) !== value || value.includes('\\')) {
    throw new Error(`${label} must be a filename without a path.`)
  }
  return value
}

const parseJson = <T>(buffer: Buffer, label: string): T => {
  try {
    return JSON.parse(buffer.toString('utf-8')) as T
  } catch {
    throw new Error(`${label} is not valid JSON.`)
  }
}

const escapeCsvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const serializeReviewCsv = (rows: CsvRow[]) =>
  `${[
    REVIEW_COLUMNS.join(','),
    ...rows.map((row) =>
      REVIEW_COLUMNS.map((column) => escapeCsvCell(row[column])).join(','),
    ),
  ].join('\n')}\n`

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

export const approveTaoyuanSourceReviewPackage = async (
  options: ApproveTaoyuanSourceReviewPackageOptions,
) => {
  if (!options.approveAll) {
    throw new Error(
      'Bulk approval requires the explicit --approve-all authorization flag.',
    )
  }
  const packagePath = path.resolve(options.packagePath)
  const referencePath = path.resolve(
    options.referencePath ?? DEFAULT_REFERENCE,
  )
  const reviewDir = path.resolve(options.reviewDir ?? DEFAULT_REVIEW_DIR)
  const receiptPath = path.resolve(options.receiptPath ?? DEFAULT_RECEIPT)
  const packageBuffer = await fs.readFile(packagePath)
  const packageSha256 = sha256(packageBuffer)
  if (
    packageSha256 !== options.expectedPackageSha256.trim().toLowerCase()
  ) {
    throw new Error(
      `Review package SHA-256 is ${packageSha256}, expected ${options.expectedPackageSha256}.`,
    )
  }

  const zip = new AdmZip(packageBuffer)
  const entriesByName = new Map<string, Buffer>()
  for (const entry of zip.getEntries()) {
    if (!isSafeArchivePath(entry.entryName)) {
      throw new Error(`Unsafe archive path: ${entry.entryName}`)
    }
    if (entry.isDirectory) continue
    if (entriesByName.has(entry.entryName)) {
      throw new Error(`Duplicate archive path: ${entry.entryName}`)
    }
    entriesByName.set(entry.entryName, entry.getData())
  }

  const rawManifest = entriesByName.get('manifest.json')
  if (!rawManifest) {
    throw new Error('Review package is missing manifest.json.')
  }
  const manifest = parseJson<PackageManifest>(
    rawManifest,
    'Review package manifest',
  )
  if (
    manifest.schemaVersion !== 1 ||
    manifest.safety?.geometryAvailable !== false ||
    manifest.safety?.legalAnswerEligible !== false ||
    manifest.safety?.approvalScope !== 'source-text-only'
  ) {
    throw new Error('Review package safety contract is invalid.')
  }
  if (!Array.isArray(manifest.districts) || manifest.districts.length === 0) {
    throw new Error('Review package contains no districts.')
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Review package contains no file inventory.')
  }

  const inventoryPaths = new Set<string>()
  for (const file of manifest.files) {
    if (!isSafeArchivePath(file.archivePath)) {
      throw new Error(`Unsafe inventory path: ${file.archivePath}`)
    }
    if (inventoryPaths.has(file.archivePath)) {
      throw new Error(`Duplicate inventory path: ${file.archivePath}`)
    }
    inventoryPaths.add(file.archivePath)
    const buffer = entriesByName.get(file.archivePath)
    if (!buffer) {
      throw new Error(`Review package is missing ${file.archivePath}.`)
    }
    if (buffer.length !== file.bytes || sha256(buffer) !== file.sha256) {
      throw new Error(`Review package file hash mismatch: ${file.archivePath}`)
    }
  }
  const supplementalPaths = new Set([
    'manifest.json',
    'README.md',
    'taoyuan-city-review-status.md',
  ])
  for (const archivePath of entriesByName.keys()) {
    if (!inventoryPaths.has(archivePath) && !supplementalPaths.has(archivePath)) {
      throw new Error(`Unexpected review package file: ${archivePath}`)
    }
  }

  const referenceInventory = manifest.files.filter(
    ({ label }) => label === 'sourceReference',
  )
  if (referenceInventory.length !== 1) {
    throw new Error('Review package must contain exactly one source reference.')
  }
  const packagedReference = entriesByName.get(
    referenceInventory[0]!.archivePath,
  )!
  const trackedReference = await fs.readFile(referencePath)
  if (sha256(packagedReference) !== sha256(trackedReference)) {
    throw new Error(
      'Review package source reference does not match the tracked reference.',
    )
  }
  const pack = parsePaidCurbReferencePack(
    parseJson<unknown>(trackedReference, 'Tracked source reference'),
  )

  const districtIds = new Set<string>()
  const prepared: Array<{
    districtId: string
    approvedRows: number
    reviewBuffer: Buffer
    reviewSha256: string
    manifestBuffer: Buffer
    templateBuffer: Buffer
    reviewFilename: string
    manifestFilename: string
    templateFilename: string
  }> = []
  for (const district of manifest.districts) {
    if (districtIds.has(district.districtId)) {
      throw new Error(`Duplicate district in review package: ${district.districtId}`)
    }
    districtIds.add(district.districtId)
    if (district.status !== 'pending' && district.status !== 'needs-resolution') {
      throw new Error(
        `${district.districtId}: package status ${district.status} cannot be bulk approved.`,
      )
    }
    const reviewFilename = requireFilename(
      district.reviewCsv,
      `${district.districtId} reviewCsv`,
    )
    const manifestFilename = requireFilename(
      district.reviewManifest,
      `${district.districtId} reviewManifest`,
    )
    const templateFilename = requireFilename(
      district.templateCsv,
      `${district.districtId} templateCsv`,
    )
    const baseName = `${district.districtId}-paid-curb-review`
    if (
      reviewFilename !== `${baseName}.csv` ||
      manifestFilename !== `${baseName}.manifest.json` ||
      templateFilename !== `${baseName}.template.csv`
    ) {
      throw new Error(
        `${district.districtId}: review bundle filenames do not match the district ID.`,
      )
    }
    const reviewBuffer = entriesByName.get(`reviews/${reviewFilename}`)
    const reviewManifestBuffer = entriesByName.get(
      `manifests/${manifestFilename}`,
    )
    const templateBuffer = entriesByName.get(`templates/${templateFilename}`)
    if (!reviewBuffer || !reviewManifestBuffer || !templateBuffer) {
      throw new Error(`${district.districtId}: review bundle is incomplete.`)
    }
    const reviewManifest = parseJson<ReviewManifest>(
      reviewManifestBuffer,
      `${district.districtId} review manifest`,
    )
    if (
      reviewManifest.reviewCsv !== reviewFilename ||
      reviewManifest.templateCsv !== templateFilename
    ) {
      throw new Error(
        `${district.districtId}: review manifest filenames do not match the package.`,
      )
    }
    const rows = parseCsv(reviewBuffer, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
    }) as CsvRow[]
    const pendingValidation = validateTaoyuanPaidCurbReview({
      pack,
      manifest: reviewManifest,
      rows,
      districtId: district.districtId,
    })
    if (!pendingValidation.pass || !pendingValidation.structureValid) {
      throw new Error(
        `${district.districtId}: review bundle failed validation:\n${pendingValidation.errors.join('\n')}`,
      )
    }
    if (
      rows.length !== district.rows ||
      pendingValidation.statusCounts.PENDING !== district.pendingRows
    ) {
      throw new Error(`${district.districtId}: package row counts do not match.`)
    }
    const conflictingRows = rows.filter((row) => {
      const status = normalizeStatus(row.source_text_review_status)
      return status && status !== APPROVED_STATUS
    })
    if (conflictingRows.length > 0) {
      throw new Error(
        `${district.districtId}: ${conflictingRows.length} row(s) contain a correction or unclear decision and cannot be bulk approved.`,
      )
    }
    const approvedRows = rows.map((row) => ({
      ...row,
      source_text_review_status: APPROVED_STATUS,
    }))
    const approvedBuffer = Buffer.from(
      serializeReviewCsv(approvedRows),
      'utf-8',
    )
    const approvedValidation = validateTaoyuanPaidCurbReview({
      pack,
      manifest: reviewManifest,
      rows: approvedRows,
      districtId: district.districtId,
      requireApproved: true,
    })
    if (!approvedValidation.pass || !approvedValidation.approved) {
      throw new Error(
        `${district.districtId}: approved review failed validation:\n${approvedValidation.errors.join('\n')}`,
      )
    }
    prepared.push({
      districtId: district.districtId,
      approvedRows: approvedRows.length,
      reviewBuffer: approvedBuffer,
      reviewSha256: sha256(approvedBuffer),
      manifestBuffer: reviewManifestBuffer,
      templateBuffer,
      reviewFilename,
      manifestFilename,
      templateFilename,
    })
  }

  await fs.mkdir(reviewDir, { recursive: true })
  for (const district of prepared) {
    await replaceFileAtomically(
      path.join(reviewDir, district.reviewFilename),
      district.reviewBuffer,
    )
    await replaceFileAtomically(
      path.join(reviewDir, district.manifestFilename),
      district.manifestBuffer,
    )
    await replaceFileAtomically(
      path.join(reviewDir, district.templateFilename),
      district.templateBuffer,
    )
  }
  const receipt: TaoyuanSourceReviewApprovalReceipt = {
    schemaVersion: 1,
    approvedAt: (options.now ?? new Date()).toISOString(),
    approvalScope: 'source-text-only',
    packagePath: portablePath(packagePath),
    packageSha256,
    referencePath: portablePath(referencePath),
    reviewDir: portablePath(reviewDir),
    approvedDistricts: prepared.map((district) => ({
      districtId: district.districtId,
      approvedRows: district.approvedRows,
      reviewSha256: district.reviewSha256,
    })),
    totalApprovedRows: prepared.reduce(
      (total, district) => total + district.approvedRows,
      0,
    ),
    safety: {
      geometryAvailable: false,
      legalAnswerEligible: false,
    },
  }
  await replaceFileAtomically(
    receiptPath,
    Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf-8'),
  )
  return { receipt, receiptPath }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const run = async () => {
  const packagePath = getArgValue(process.argv, '--package')
  const expectedPackageSha256 = getArgValue(
    process.argv,
    '--expected-sha256',
  )
  if (!packagePath || !expectedPackageSha256) {
    throw new Error(
      '--package and --expected-sha256 are required for source-review approval.',
    )
  }
  const result = await approveTaoyuanSourceReviewPackage({
    packagePath,
    expectedPackageSha256,
    approveAll: process.argv.includes('--approve-all'),
    reviewDir: getArgValue(process.argv, '--review-dir') ?? undefined,
    referencePath: getArgValue(process.argv, '--reference') ?? undefined,
    receiptPath: getArgValue(process.argv, '--receipt') ?? undefined,
  })
  console.log(
    `Approved ${result.receipt.totalApprovedRows} source-text rows across ${result.receipt.approvedDistricts.length} Taoyuan districts.`,
  )
  console.log(`Package SHA-256: ${result.receipt.packageSha256}`)
  console.log(`Receipt: ${result.receiptPath}`)
  console.log('Geometry and legal-answer eligibility remain false.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
