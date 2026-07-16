import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import {
  type HumanReviewBundleEntry,
  renderHumanReviewBundleIndex,
  runHumanReviewBundleIndex,
} from './humanReviewBundleIndex'
import { buildReleaseTimestampId, sha256Buffer } from './packageReleaseUtils'
import {
  type ReviewHandoffAuditOptions,
  type ReviewHandoffAuditResult,
  buildReviewHandoffPriorityRows,
  renderReviewHandoffPriorityCsv,
  renderReviewHandoffPriorityGuide,
  renderReviewHandoffAudit,
  runReviewHandoffAudit,
} from './reviewHandoffAudit'
import { REVIEW_TIMESTAMP_MESSAGE } from './reviewTimestamp'

const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_OUT_DIR = '.tmp/human-review-packages'
const DEFAULT_CONFIG_ROOT = 'configs/prod'
const DEFAULT_PUBLISH_GATE_SUMMARY = 'data/generated/_ops/publish_gate_summary.json'

interface PackageSourceFile {
  label: string
  sourcePath: string
  archivePath: string
}

export interface PackageHumanReviewsOptions {
  reviewRoot?: string
  configRoot?: string
  districtIds?: string[]
  all?: boolean
  outDir?: string
  publishGateSummaryPath?: string | null
  summaryPath?: string
  includeAudit?: boolean
  json?: boolean
  now?: Date
  auditHandoffs?: (
    options: ReviewHandoffAuditOptions,
  ) => Promise<ReviewHandoffAuditResult>
}

export interface PackagedHumanReviewFile {
  label: string
  path: string
  archivePath: string
  sha256: string
  bytes: number
}

export interface PackagedHumanReviewEntry {
  bundleId: string
  districtId: string
  status: string
  zipPath: string
  files: PackagedHumanReviewFile[]
  priorityValidationCommand: string
  finalizeCommand: string
}

export interface SkippedHumanReviewPackageEntry {
  bundleId: string
  districtId: string
  status: string
  reason: string
}

export interface PackageHumanReviewsResult {
  pass: boolean
  reviewRoot: string
  outDir: string
  selectedDistricts: string[]
  packages: PackagedHumanReviewEntry[]
  skipped: SkippedHumanReviewPackageEntry[]
  auditResult: ReviewHandoffAuditResult | null
  errors: string[]
  warnings: string[]
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

const getArgValues = (argv: string[], ...flags: string[]) => {
  const values: string[] = []
  argv.forEach((arg, index) => {
    if (flags.includes(arg) && argv[index + 1]) {
      values.push(argv[index + 1])
    }
  })
  return values.flatMap((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parsePackageHumanReviewsArgs = (
  argv: string[],
): PackageHumanReviewsOptions => ({
  reviewRoot:
    getArgValue(argv, '--review-root', '--reviewRoot') ?? DEFAULT_REVIEW_ROOT,
  configRoot:
    getArgValue(argv, '--config-root', '--configRoot') ?? DEFAULT_CONFIG_ROOT,
  districtIds: getArgValues(argv, '--district', '--district-id', '--districtId'),
  all: hasFlag(argv, '--all'),
  outDir: getArgValue(argv, '--out-dir', '--outDir') ?? DEFAULT_OUT_DIR,
  publishGateSummaryPath: hasFlag(argv, '--no-publish-gate-summary')
    ? null
    : (getArgValue(
        argv,
        '--publish-gate-summary',
        '--publishGateSummary',
        '--publish-gate-summary-path',
        '--publishGateSummaryPath',
      ) ?? DEFAULT_PUBLISH_GATE_SUMMARY),
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  includeAudit: !hasFlag(argv, '--no-audit', '--noAudit'),
  json: hasFlag(argv, '--json'),
})

const readyForHumanReview = (entry: HumanReviewBundleEntry) =>
  entry.status === 'ready-for-review'

const skippedReason = (entry: HumanReviewBundleEntry) => {
  if (entry.status === 'ready-to-finalize' || entry.status === 'review-complete') {
    return 'human review is already sufficient; use ops:p0-finalize-ready-reviews'
  }
  return 'bundle is incomplete or has fatal validation errors'
}

const normalizeArchivePath = (...parts: string[]) => parts.join('/').replace(/\\/g, '/')

const quoteArg = (value: string) => `"${value.replace(/"/g, '\\"')}"`

const uniqueFiles = (files: PackageSourceFile[]) => {
  const seen = new Set<string>()
  return files.filter((file) => {
    const key = path.resolve(file.sourcePath).toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const buildPackageFiles = (entry: HumanReviewBundleEntry): PackageSourceFile[] => {
  const archiveRoot = entry.bundleId
  return uniqueFiles([
    {
      label: 'sourceCsv',
      sourcePath: entry.sourcePath,
      archivePath: normalizeArchivePath(archiveRoot, 'source', path.basename(entry.sourcePath)),
    },
    {
      label: 'bundledSourceCsv',
      sourcePath: entry.files.sourceCsv.path,
      archivePath: normalizeArchivePath(
        archiveRoot,
        'bundle',
        path.basename(entry.files.sourceCsv.path),
      ),
    },
    {
      label: 'sourceManifest',
      sourcePath: entry.files.sourceManifest.path,
      archivePath: normalizeArchivePath(
        archiveRoot,
        'bundle',
        path.basename(entry.files.sourceManifest.path),
      ),
    },
    {
      label: 'sourceReviewDoc',
      sourcePath: entry.files.sourceReviewDoc.path,
      archivePath: normalizeArchivePath(
        archiveRoot,
        'bundle',
        path.basename(entry.files.sourceReviewDoc.path),
      ),
    },
    {
      label: 'handoffCsv',
      sourcePath: entry.files.handoffCsv.path,
      archivePath: normalizeArchivePath(
        archiveRoot,
        'review',
        path.basename(entry.files.handoffCsv.path),
      ),
    },
    {
      label: 'handoffChecklist',
      sourcePath: entry.files.handoffChecklist.path,
      archivePath: normalizeArchivePath(
        archiveRoot,
        'review',
        path.basename(entry.files.handoffChecklist.path),
      ),
    },
    {
      label: 'handoffGeojson',
      sourcePath: entry.files.handoffGeojson.path,
      archivePath: normalizeArchivePath(
        archiveRoot,
        'review',
        path.basename(entry.files.handoffGeojson.path),
      ),
    },
  ])
}

const buildPriorityValidationCommand = (
  entry: HumanReviewBundleEntry,
  reviewsPath = '<path-to-filled-priority-review.csv>',
) =>
  [
    'npm run ops:p0-validate-priority-review --',
    '--district',
    entry.districtId,
    '--reviews',
    quoteArg(reviewsPath),
    '--config',
    quoteArg(entry.finalizeInputs.configPath),
    '--answer-cases',
    quoteArg(entry.finalizeInputs.answerCasesPath),
    ...(entry.finalizeInputs.allowPublishWarn && entry.finalizeInputs.publishOverrideReason
      ? [
          '--allow-publish-warn',
          '--publish-override',
          quoteArg(entry.finalizeInputs.publishOverrideReason),
        ]
      : []),
  ].join(' ')

const buildPackageReadme = (
  entry: HumanReviewBundleEntry,
  districtAuditResult: ReviewHandoffAuditResult | null,
) => {
  const auditEntry = districtAuditResult?.entries[0] ?? null
  const priorityRows = districtAuditResult
    ? buildReviewHandoffPriorityRows(districtAuditResult).length
    : null
  return [
    `# Human Review Handoff: ${entry.bundleId}`,
    '',
    `District: ${entry.districtId}`,
    `Status: ${entry.status}`,
    `Handoff rows: ${entry.handoffRows ?? '-'}`,
    `Valid reviewed handoff rows: ${entry.handoffValidReviewedRows ?? '-'}`,
    `Minimum remaining new reviews: ${auditEntry?.remainingMinimumNewReviews ?? entry.handoffEstimatedMinimumNewReviews ?? entry.estimatedMinimumNewReviews ?? '-'}`,
    `Priority rows in review/priority-review.csv: ${priorityRows ?? '-'}`,
    '',
    '## Required Human Fields',
    '',
    '- Fill `reviewStatus` from observed evidence.',
    '- Fill `reviewNote` with auditable evidence, not a guess.',
    `- Fill \`createdAt\` or \`reviewedAt\` with the review timestamp. ${REVIEW_TIMESTAMP_MESSAGE}.`,
    '- Keep enough reviewed rows to cover both `LEGAL` and `ILLEGAL`, with at least two `marked_space_park` and two `no_stop` rows.',
    '- Start from `review/handoff-audit.md`; it highlights pending fields and priority rows to review first.',
    '',
    '## Review Options',
    '',
    `- Full handoff path: fill \`review/${entry.districtId}-next-review.csv\`, then run the full handoff finalize command below.`,
    '- Priority path: fill only `review/priority-review.csv`, run the priority validation command below, then run the finalize command printed by that validation.',
    '- Do not run the full handoff finalize command unless the full handoff CSV has been filled.',
    '',
    '## Validate Priority Review',
    '',
    'Run this command from the repo root after `review/priority-review.csv` is filled:',
    '',
    '```powershell',
    buildPriorityValidationCommand(entry),
    '```',
    '',
    '## After Review',
    '',
    'Run this command from the repo root only after the full handoff CSV is filled:',
    '',
    '```powershell',
    entry.finalizeCommand,
    '```',
    '',
  ].join('\n')
}

const filterAuditResultForBundle = (
  auditResult: ReviewHandoffAuditResult | null,
  bundleId: string,
) => {
  const entry = auditResult?.entries.find(
    (auditEntry) => auditEntry.bundleId === bundleId,
  )
  if (!auditResult || !entry) {
    return null
  }
  return {
    ...auditResult,
    selectedDistricts: [bundleId],
    entries: [entry],
  }
}

const writePackageForEntry = async (params: {
  entry: HumanReviewBundleEntry
  outDir: string
  packageId: string
  indexMarkdown: string
  auditResult: ReviewHandoffAuditResult | null
}): Promise<PackagedHumanReviewEntry> => {
  const { entry, outDir, packageId, indexMarkdown, auditResult } = params
  const zip = new AdmZip()
  const files: PackagedHumanReviewFile[] = []
  const priorityValidationCommand = buildPriorityValidationCommand(entry)
  const districtAuditResult = filterAuditResultForBundle(
    auditResult,
    entry.bundleId,
  )

  for (const file of buildPackageFiles(entry)) {
    let buffer: Buffer
    try {
      buffer = await fs.readFile(file.sourcePath)
    } catch {
      continue
    }
    zip.addFile(file.archivePath, buffer)
    files.push({
      label: file.label,
      path: file.sourcePath,
      archivePath: file.archivePath,
      sha256: sha256Buffer(buffer),
      bytes: buffer.length,
    })
  }

  const archiveRoot = entry.bundleId
  const readmePath = normalizeArchivePath(archiveRoot, 'README.md')
  zip.addFile(
    readmePath,
    Buffer.from(buildPackageReadme(entry, districtAuditResult), 'utf-8'),
  )
  zip.addFile(
    normalizeArchivePath(archiveRoot, 'human-review-index.md'),
    Buffer.from(indexMarkdown, 'utf-8'),
  )
  if (districtAuditResult) {
    zip.addFile(
      normalizeArchivePath(archiveRoot, 'review', 'handoff-audit.md'),
      Buffer.from(renderReviewHandoffAudit(districtAuditResult), 'utf-8'),
    )
    zip.addFile(
      normalizeArchivePath(archiveRoot, 'review', 'handoff-audit.json'),
      Buffer.from(`${JSON.stringify(districtAuditResult, null, 2)}\n`, 'utf-8'),
    )
    zip.addFile(
      normalizeArchivePath(archiveRoot, 'review', 'priority-review.md'),
      Buffer.from(renderReviewHandoffPriorityGuide(districtAuditResult), 'utf-8'),
    )
    zip.addFile(
      normalizeArchivePath(archiveRoot, 'review', 'priority-review.csv'),
      Buffer.from(`${renderReviewHandoffPriorityCsv(districtAuditResult)}\n`, 'utf-8'),
    )
    zip.addFile(
      normalizeArchivePath(archiveRoot, 'review', 'priority-review.json'),
      Buffer.from(
        `${JSON.stringify(buildReviewHandoffPriorityRows(districtAuditResult), null, 2)}\n`,
        'utf-8',
      ),
    )
  }
  zip.addFile(
    normalizeArchivePath(archiveRoot, 'manifest.json'),
    Buffer.from(
      `${JSON.stringify(
        {
          bundleId: entry.bundleId,
          districtId: entry.districtId,
          status: entry.status,
          generatedAt: new Date().toISOString(),
          priorityValidationCommand,
          finalizeCommand: entry.finalizeCommand,
          audit: districtAuditResult
            ? {
                markdown: normalizeArchivePath(
                  archiveRoot,
                  'review',
                  'handoff-audit.md',
                ),
                json: normalizeArchivePath(
                  archiveRoot,
                  'review',
                  'handoff-audit.json',
                ),
                priorityMarkdown: normalizeArchivePath(
                  archiveRoot,
                  'review',
                  'priority-review.md',
                ),
                priorityCsv: normalizeArchivePath(
                  archiveRoot,
                  'review',
                  'priority-review.csv',
                ),
                priorityJson: normalizeArchivePath(
                  archiveRoot,
                  'review',
                  'priority-review.json',
                ),
              }
            : null,
          files,
        },
        null,
        2,
      )}\n`,
      'utf-8',
    ),
  )

  await fs.mkdir(outDir, { recursive: true })
  const zipPath = path.resolve(outDir, `${entry.bundleId}-human-review-${packageId}.zip`)
  zip.writeZip(zipPath)
  return {
    bundleId: entry.bundleId,
    districtId: entry.districtId,
    status: entry.status,
    zipPath,
    files,
    priorityValidationCommand,
    finalizeCommand: entry.finalizeCommand,
  }
}

export const runPackageHumanReviews = async (
  options: PackageHumanReviewsOptions = {},
): Promise<PackageHumanReviewsResult> => {
  const reviewRoot = path.resolve(options.reviewRoot ?? DEFAULT_REVIEW_ROOT)
  const outDir = path.resolve(options.outDir ?? DEFAULT_OUT_DIR)
  const districtIds = options.districtIds ?? []
  const errors: string[] = []
  const warnings: string[] = []
  if (!options.all && districtIds.length === 0) {
    errors.push('Pass at least one --district value or --all.')
  }

  const index = await runHumanReviewBundleIndex({
    reviewRoot,
    configRoot: options.configRoot ?? DEFAULT_CONFIG_ROOT,
    districtIds: options.all ? [] : districtIds,
    publishGateSummaryPath:
      options.publishGateSummaryPath === undefined
        ? DEFAULT_PUBLISH_GATE_SUMMARY
        : options.publishGateSummaryPath,
  })
  warnings.push(...index.warnings)
  errors.push(...index.errors)

  const packageable = index.entries.filter(readyForHumanReview)
  const skipped = index.entries
    .filter((entry) => !readyForHumanReview(entry))
    .map((entry) => ({
      bundleId: entry.bundleId,
      districtId: entry.districtId,
      status: entry.status,
      reason: skippedReason(entry),
    }))
  if (packageable.length === 0) {
    errors.push('No review bundles need human handoff packaging.')
  }

  let auditResult: ReviewHandoffAuditResult | null = null
  if (errors.length === 0 && (options.includeAudit ?? true)) {
    auditResult = await (options.auditHandoffs ?? runReviewHandoffAudit)({
      reviewRoot,
      districtIds: packageable.map((entry) => entry.bundleId),
      publishGateSummaryPath:
        options.publishGateSummaryPath === undefined
          ? DEFAULT_PUBLISH_GATE_SUMMARY
          : options.publishGateSummaryPath,
    })
    warnings.push(...auditResult.warnings)
    errors.push(...auditResult.errors)
  }

  const packages: PackagedHumanReviewEntry[] = []
  if (errors.length === 0) {
    const packageId = buildReleaseTimestampId(options.now)
    const indexMarkdown = renderHumanReviewBundleIndex(index)
    for (const entry of packageable) {
      packages.push(
        await writePackageForEntry({
          entry,
          outDir,
          packageId,
          indexMarkdown,
          auditResult,
        }),
      )
    }
    await fs.writeFile(
      path.join(outDir, `human-review-packages-${packageId}.json`),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), packages, skipped }, null, 2)}\n`,
      'utf-8',
    )
  }

  return {
    pass: errors.length === 0,
    reviewRoot,
    outDir,
    selectedDistricts: options.all ? ['*'] : districtIds,
    packages,
    skipped,
    auditResult,
    errors,
    warnings,
  }
}

const statusLabel = (result: PackageHumanReviewsResult) =>
  result.pass ? 'PASS' : 'BLOCKED'

export const renderPackageHumanReviews = (result: PackageHumanReviewsResult) => {
  const lines = [
    `Human review package: ${statusLabel(result)}`,
    `Review root: ${result.reviewRoot}`,
    `Output dir: ${result.outDir}`,
    `Selected districts: ${result.selectedDistricts.join(', ') || 'none'}`,
    `Packages: ${result.packages.length}`,
    `Skipped: ${result.skipped.length}`,
    '',
    '## Packages',
  ]

  if (result.packages.length === 0) {
    lines.push('- none')
  }
  result.packages.forEach((entry) => {
    const label =
      entry.bundleId === entry.districtId
        ? entry.districtId
        : `${entry.bundleId} (district ${entry.districtId})`
    lines.push(`- ${label}: ${entry.zipPath}`)
    lines.push(`  Copied source/review files: ${entry.files.length}`)
    lines.push(`  Validate priority review: ${entry.priorityValidationCommand}`)
    lines.push(`  After review: ${entry.finalizeCommand}`)
  })

  lines.push('', '## Skipped')
  if (result.skipped.length === 0) {
    lines.push('- none')
  }
  result.skipped.forEach((entry) => {
    const label =
      entry.bundleId === entry.districtId
        ? entry.districtId
        : `${entry.bundleId} (district ${entry.districtId})`
    lines.push(`- ${label}: ${entry.status}; ${entry.reason}`)
  })

  if (result.errors.length > 0) {
    lines.push('', '## Errors')
    result.errors.forEach((error) => lines.push(`- ${error}`))
  }
  if (result.warnings.length > 0) {
    lines.push('', '## Warnings')
    result.warnings.forEach((warning) => lines.push(`- ${warning}`))
  }

  return lines.join('\n')
}

export const resolvePackageHumanReviewsSummaryPath = (
  options: Pick<PackageHumanReviewsOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const run = async () => {
  const options = parsePackageHumanReviewsArgs(process.argv)
  const result = await runPackageHumanReviews(options)
  const output = options.json
    ? JSON.stringify(result, null, 2)
    : renderPackageHumanReviews(result)
  console.log(output)

  const summaryPath = resolvePackageHumanReviewsSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${renderPackageHumanReviews(result)}\n\n`)
  }

  if (!result.pass) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
