import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import {
  renderHumanReviewBundleIndex,
  runHumanReviewBundleIndex,
  type SpecializedHumanReviewBundleEntry,
} from './humanReviewBundleIndex'
import {
  buildReleaseTimestampId,
  sha256Buffer,
} from './packageReleaseUtils'

const DEFAULT_REVIEW_DIR = '.tmp/taoyuan-human-review'
const DEFAULT_REFERENCE = 'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_OUT_DIR = '.tmp/taoyuan-source-review-handoff'
const DEFAULT_REPORT = '.tmp/taoyuan-source-review-handoff.md'
const DEFAULT_JSON_REPORT = '.tmp/taoyuan-source-review-handoff.json'

interface HandoffFile {
  label: string
  sourcePath: string
  archivePath: string
  bytes: number
  sha256: string
}

export interface PackageTaoyuanSourceReviewsOptions {
  reviewDir?: string
  referencePath?: string
  outDir?: string
  districtIds?: string[]
  outPath?: string | null
  jsonOutPath?: string | null
  now?: Date
}

export interface PackageTaoyuanSourceReviewEntry {
  districtId: string
  status: SpecializedHumanReviewBundleEntry['status']
  rows: number | null
  pendingRows: number | null
  reviewPath: string
  manifestPath: string
  templatePath: string
}

export interface PackageTaoyuanSourceReviewsResult {
  pass: boolean
  reviewDir: string
  referencePath: string
  outDir: string
  packagePath: string | null
  packageSha256: string | null
  packageBytes: number
  packaged: PackageTaoyuanSourceReviewEntry[]
  skippedApproved: string[]
  blocked: string[]
  pendingRows: number
  files: HandoffFile[]
  warnings: string[]
  errors: string[]
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const getArgValues = (argv: string[], ...flags: string[]) =>
  argv
    .flatMap((value, index) =>
      flags.includes(value) && argv[index + 1] ? [argv[index + 1]!] : [],
    )
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)

export const parsePackageTaoyuanSourceReviewsArgs = (
  argv: string[],
): PackageTaoyuanSourceReviewsOptions => ({
  reviewDir:
    getArgValue(argv, '--review-dir', '--reviewDir') ?? DEFAULT_REVIEW_DIR,
  referencePath:
    getArgValue(argv, '--reference') ?? DEFAULT_REFERENCE,
  outDir: getArgValue(argv, '--out-dir', '--outDir') ?? DEFAULT_OUT_DIR,
  districtIds: getArgValues(
    argv,
    '--district',
    '--district-id',
    '--districtId',
  ),
  outPath: getArgValue(argv, '--out') ?? DEFAULT_REPORT,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_REPORT,
})

const normalizeArchivePath = (...parts: string[]) =>
  parts.join('/').replace(/\\/g, '/')

const readFileForPackage = async (
  label: string,
  sourcePath: string,
  archivePath: string,
): Promise<{ buffer: Buffer; file: HandoffFile }> => {
  const buffer = await fs.readFile(sourcePath)
  return {
    buffer,
    file: {
      label,
      sourcePath,
      archivePath,
      bytes: buffer.length,
      sha256: sha256Buffer(buffer),
    },
  }
}

const buildHandoffReadme = (
  entries: PackageTaoyuanSourceReviewEntry[],
) => [
  '# Taoyuan paid-curb source-text review handoff',
  '',
  `Districts requiring review: ${entries.length}`,
  `Rows still pending: ${entries.reduce(
    (total, entry) => total + (entry.pendingRows ?? 0),
    0,
  )}`,
  '',
  '## Human task',
  '',
  '- Edit only the CSV files under `reviews/`; keep every filename unchanged.',
  '- Do not modify source IDs, district fields, descriptions, fare text, charging flags, or safety fields.',
  '- Set `source_text_review_status` to `APPROVED_SOURCE_TEXT`, `NEEDS_CORRECTION`, or `UNCLEAR`.',
  '- Add `source_text_review_note` for every `NEEDS_CORRECTION` or `UNCLEAR` row.',
  '- Approval confirms source transcription only. It never confirms geometry or parking legality.',
  '',
  '## Return',
  '',
  '- Return the edited CSV files only after every row has an explicit status.',
  '- The project gate will revalidate immutable fields, source hash, row count, and allowed statuses.',
  '- No returned file is promoted automatically; only a fully approved district can pass promotion.',
  '',
  '## Included districts',
  '',
  ...entries.map(
    (entry) =>
      `- ${entry.districtId}: ${entry.rows ?? '-'} rows; ${entry.pendingRows ?? '-'} pending.`,
  ),
  '',
].join('\n')

const templatePathFromManifest = async (
  entry: SpecializedHumanReviewBundleEntry,
  reviewDir: string,
) => {
  const manifest = JSON.parse(
    await fs.readFile(entry.manifestPath, 'utf-8'),
  ) as Record<string, unknown>
  const templateCsv =
    typeof manifest.templateCsv === 'string'
      ? manifest.templateCsv
      : `${entry.districtId}-paid-curb-review.template.csv`
  if (path.basename(templateCsv) !== templateCsv) {
    throw new Error('templateCsv must be a filename inside the review directory')
  }
  return resolveReviewFile(
    reviewDir,
    path.join(reviewDir, templateCsv),
    'templateCsv',
  )
}

const resolveReviewFile = (
  reviewDir: string,
  targetPath: string,
  label: string,
) => {
  const resolvedReviewDir = path.resolve(reviewDir)
  const resolvedPath = path.resolve(targetPath)
  const relative = path.relative(resolvedReviewDir, resolvedPath)
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.dirname(relative) !== '.'
  ) {
    throw new Error(`${label} must be a direct child of the review directory`)
  }
  return resolvedPath
}

export const packageTaoyuanSourceReviews = async (
  options: PackageTaoyuanSourceReviewsOptions = {},
): Promise<PackageTaoyuanSourceReviewsResult> => {
  const reviewDir = path.resolve(options.reviewDir ?? DEFAULT_REVIEW_DIR)
  const referencePath = path.resolve(
    options.referencePath ?? DEFAULT_REFERENCE,
  )
  const outDir = path.resolve(options.outDir ?? DEFAULT_OUT_DIR)
  const index = await runHumanReviewBundleIndex({
    reviewRoot: reviewDir,
    districtIds: options.districtIds,
    publishGateSummaryPath: null,
    sourceTextReferencePath: referencePath,
  })
  const warnings = [...index.warnings]
  const errors = [...index.errors]
  const specializedEntries = index.specializedEntries ?? []
  if (specializedEntries.length === 0) {
    errors.push('No Taoyuan source-text review entries were found.')
  }

  const blockedEntries = specializedEntries.filter(
    ({ status }) => status === 'invalid' || status === 'unknown',
  )
  const blockedDistrictIds = new Set(
    blockedEntries.map(({ districtId }) => districtId),
  )
  blockedEntries.forEach((entry) => {
    errors.push(
      `${entry.districtId}: review artifacts are ${entry.status}.`,
      ...entry.errors.map((error) => `${entry.districtId}: ${error}`),
    )
  })
  const packageableEntries = specializedEntries.filter(
    ({ status }) => status === 'pending' || status === 'needs-resolution',
  )
  const skippedApproved = specializedEntries
    .filter(({ status }) => status === 'approved')
    .map(({ districtId }) => districtId)
  const packaged: PackageTaoyuanSourceReviewEntry[] = []
  const preparedEntries: Array<{
    entry: SpecializedHumanReviewBundleEntry
    templatePath: string
  }> = []
  const files: HandoffFile[] = []
  let packagePath: string | null = null
  let packageSha256: string | null = null
  let packageBytes = 0

  if (errors.length === 0) {
    for (const entry of packageableEntries) {
      try {
        resolveReviewFile(reviewDir, entry.reviewPath, 'reviewCsv')
        resolveReviewFile(reviewDir, entry.manifestPath, 'reviewManifest')
        const templatePath = await templatePathFromManifest(entry, reviewDir)
        await fs.access(templatePath)
        preparedEntries.push({ entry, templatePath })
      } catch (error) {
        blockedDistrictIds.add(entry.districtId)
        errors.push(
          `${entry.districtId}: handoff path validation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }
  }

  if (errors.length === 0 && preparedEntries.length > 0) {
    const zip = new AdmZip()
    const now = options.now ?? new Date()
    const packageId = buildReleaseTimestampId(now)
    const generatedAt = now.toISOString()

    for (const { entry, templatePath } of preparedEntries) {
      const packageEntry: PackageTaoyuanSourceReviewEntry = {
        districtId: entry.districtId,
        status: entry.status,
        rows: entry.actualRows,
        pendingRows: entry.pendingRows,
        reviewPath: entry.reviewPath,
        manifestPath: entry.manifestPath,
        templatePath,
      }
      packaged.push(packageEntry)
      const sourceFiles = [
        await readFileForPackage(
          'reviewCsv',
          entry.reviewPath,
          normalizeArchivePath(
            'reviews',
            path.basename(entry.reviewPath),
          ),
        ),
        await readFileForPackage(
          'templateCsv',
          templatePath,
          normalizeArchivePath(
            'templates',
            path.basename(templatePath),
          ),
        ),
        await readFileForPackage(
          'reviewManifest',
          entry.manifestPath,
          normalizeArchivePath(
            'manifests',
            path.basename(entry.manifestPath),
          ),
        ),
      ]
      sourceFiles.forEach(({ buffer, file }) => {
        zip.addFile(file.archivePath, buffer)
        files.push(file)
      })
    }

    const referenceFile = await readFileForPackage(
      'sourceReference',
      referencePath,
      normalizeArchivePath('reference', path.basename(referencePath)),
    )
    zip.addFile(referenceFile.file.archivePath, referenceFile.buffer)
    files.push(referenceFile.file)
    const indexMarkdown = renderHumanReviewBundleIndex(index)
    zip.addFile(
      'taoyuan-city-review-status.md',
      Buffer.from(indexMarkdown, 'utf-8'),
    )
    zip.addFile(
      'README.md',
      Buffer.from(buildHandoffReadme(packaged), 'utf-8'),
    )
    zip.addFile(
      'manifest.json',
      Buffer.from(
        `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            safety: {
              geometryAvailable: false,
              legalAnswerEligible: false,
              approvalScope: 'source-text-only',
            },
            districts: packaged.map((entry) => ({
              districtId: entry.districtId,
              status: entry.status,
              rows: entry.rows,
              pendingRows: entry.pendingRows,
              reviewCsv: path.basename(entry.reviewPath),
              reviewManifest: path.basename(entry.manifestPath),
              templateCsv: path.basename(entry.templatePath),
            })),
            skippedApproved,
            files: files.map((file) => ({
              label: file.label,
              archivePath: file.archivePath,
              bytes: file.bytes,
              sha256: file.sha256,
            })),
          },
          null,
          2,
        )}\n`,
        'utf-8',
      ),
    )

    await fs.mkdir(outDir, { recursive: true })
    packagePath = path.join(
      outDir,
      `taoyuan-source-review-handoff-${packageId}.zip`,
    )
    zip.writeZip(packagePath)
    const packageBuffer = await fs.readFile(packagePath)
    packageSha256 = sha256Buffer(packageBuffer)
    packageBytes = packageBuffer.length
    await fs.writeFile(
      `${packagePath}.sha256`,
      `${packageSha256}  ${path.basename(packagePath)}\n`,
      'utf-8',
    )
  }

  return {
    pass: errors.length === 0,
    reviewDir,
    referencePath,
    outDir,
    packagePath,
    packageSha256,
    packageBytes,
    packaged,
    skippedApproved,
    blocked: [...blockedDistrictIds].sort(),
    pendingRows: packaged.reduce(
      (total, entry) => total + (entry.pendingRows ?? 0),
      0,
    ),
    files,
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
  }
}

export const renderPackageTaoyuanSourceReviews = (
  result: PackageTaoyuanSourceReviewsResult,
) => [
  `# Taoyuan Source Review Handoff: ${result.pass ? 'PASS' : 'BLOCKED'}`,
  '',
  `- Review directory: ${result.reviewDir}`,
  `- Reference: ${result.referencePath}`,
  `- Districts packaged: ${result.packaged.length}`,
  `- Pending rows: ${result.pendingRows}`,
  `- Approved districts skipped: ${result.skippedApproved.join(', ') || 'none'}`,
  `- Blocked districts: ${result.blocked.join(', ') || 'none'}`,
  `- Package: ${result.packagePath ?? 'not needed'}`,
  `- Package SHA-256: ${result.packageSha256 ?? '-'}`,
  `- Package bytes: ${result.packageBytes}`,
  '',
  '## Packaged districts',
  '',
  ...(result.packaged.length > 0
    ? result.packaged.map(
        (entry) =>
          `- ${entry.districtId}: ${entry.status}; rows=${entry.rows ?? '-'}; pending=${entry.pendingRows ?? '-'}`,
      )
    : ['- none']),
  ...(result.warnings.length > 0
    ? ['', '## Warnings', '', ...result.warnings.map((warning) => `- ${warning}`)]
    : []),
  ...(result.errors.length > 0
    ? ['', '## Errors', '', ...result.errors.map((error) => `- ${error}`)]
    : []),
  '',
].join('\n')

const run = async () => {
  const options = parsePackageTaoyuanSourceReviewsArgs(process.argv)
  const result = await packageTaoyuanSourceReviews(options)
  const report = renderPackageTaoyuanSourceReviews(result)
  console.log(report)
  if (options.outPath) {
    await fs.mkdir(path.dirname(path.resolve(options.outPath)), {
      recursive: true,
    })
    await fs.writeFile(path.resolve(options.outPath), report, 'utf-8')
  }
  if (options.jsonOutPath) {
    await fs.mkdir(path.dirname(path.resolve(options.jsonOutPath)), {
      recursive: true,
    })
    await fs.writeFile(
      path.resolve(options.jsonOutPath),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf-8',
    )
  }
  if (!result.pass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
