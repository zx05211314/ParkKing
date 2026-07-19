import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  installReleasePackage,
  type InstallReleasePackageArgs,
  type InstallReleasePackageResult,
} from './installReleasePackage'
import { loadGenerateBaselineEntries } from './generateBaselineRegistry'
import { runGenerateBaselineWorkflow } from './generateBaselineWorkflow'
import { createGenerateBaselineWorkflowDeps } from './generateBaselineWorkflowRuntime'
import {
  refreshReviewedAnswerCaseHashes,
  type RefreshReviewedAnswerCaseHashesOptions,
  type RefreshReviewedAnswerCaseHashesResult,
} from './refreshReviewedAnswerCaseHashes'

const DEFAULT_TMP_DIR = '.tmp/release-evidence-reconcile'
const DEFAULT_ANSWER_CASES_DIR = 'configs/prod'
const DEFAULT_BASELINE_DIR = 'ops/baselines'
const DEFAULT_OUT_PATH = '.tmp/release-evidence-reconcile.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/release-evidence-reconcile.json'

export interface ReconcileReleaseEvidenceOptions {
  packageUrl?: string | null
  manifestUrl?: string | null
  zipPath?: string | null
  manifestPath?: string | null
  tmpDir?: string | null
  answerCasesDir?: string | null
  baselineDir?: string | null
  downloadToken?: string | null
  downloadAuthHeader?: string | null
  execute?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
  json?: boolean
}

export type ReconciledFileKind = 'answer-cases' | 'baseline'
export type ReconciledFileStatus = 'unchanged' | 'would-update' | 'updated'

export interface ReconciledFile {
  districtId: string
  kind: ReconciledFileKind
  sourcePath: string
  targetPath: string
  status: ReconciledFileStatus
}

export interface ReconcileReleaseEvidenceResult {
  pass: boolean
  execute: boolean
  releaseId: string | null
  packageSource: string | null
  manifestSource: string | null
  datasetRoot: string
  answerCasesDir: string
  baselineDir: string
  districtIds: string[]
  caseCount: number
  semanticValidationPassed: boolean
  baselineGenerationPassed: boolean
  files: ReconciledFile[]
  errors: string[]
}

export interface GenerateReleaseBaselinesResult {
  districtIds: string[]
}

export interface ReconcileReleaseEvidenceDependencies {
  installPackage?: (
    args: InstallReleasePackageArgs,
  ) => Promise<InstallReleasePackageResult>
  refreshAnswerCases?: (
    options: RefreshReviewedAnswerCaseHashesOptions,
  ) => Promise<RefreshReviewedAnswerCaseHashesResult>
  generateBaselines?: (
    datasetRoot: string,
    baselineDir: string,
  ) => Promise<GenerateReleaseBaselinesResult>
}

interface StagedTarget {
  districtId: string
  kind: ReconciledFileKind
  sourcePath: string
  targetPath: string
  changed: boolean
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`${flag} requires a value`)
      }
      return value
    }
  }
  return null
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parseReconcileReleaseEvidenceArgs = (
  argv: string[],
): ReconcileReleaseEvidenceOptions => ({
  packageUrl:
    getArgValue(argv, '--url', '--package-url', '--packageUrl') ??
    process.env.PARKKING_RELEASE_PACKAGE_URL ??
    null,
  manifestUrl:
    getArgValue(argv, '--manifest-url', '--manifestUrl') ??
    process.env.PARKKING_RELEASE_MANIFEST_URL ??
    null,
  zipPath: getArgValue(argv, '--zip', '--zip-path', '--zipPath'),
  manifestPath: getArgValue(
    argv,
    '--manifest',
    '--manifest-path',
    '--manifestPath',
  ),
  tmpDir: getArgValue(argv, '--tmp-dir', '--tmpDir') ?? DEFAULT_TMP_DIR,
  answerCasesDir:
    getArgValue(argv, '--answer-cases-dir', '--answerCasesDir') ??
    DEFAULT_ANSWER_CASES_DIR,
  baselineDir:
    getArgValue(argv, '--baseline-dir', '--baselineDir') ??
    DEFAULT_BASELINE_DIR,
  downloadToken:
    getArgValue(argv, '--download-token', '--downloadToken') ??
    process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN ??
    null,
  downloadAuthHeader:
    getArgValue(argv, '--download-auth-header', '--downloadAuthHeader') ??
    process.env.PARKKING_RELEASE_DOWNLOAD_AUTH_HEADER ??
    null,
  execute: hasFlag(argv, '--execute'),
  outPath: getArgValue(argv, '--out') ?? DEFAULT_OUT_PATH,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_OUT_PATH,
  json: hasFlag(argv, '--json'),
})

const defaultGenerateBaselines = async (
  datasetRoot: string,
  baselineDir: string,
): Promise<GenerateReleaseBaselinesResult> => {
  const { entries } = await loadGenerateBaselineEntries({
    registryPath: path.join(datasetRoot, 'registry.json'),
  })
  const result = await runGenerateBaselineWorkflow(
    {
      args: {
        force: true,
        seed: false,
        districtIdFilter: null,
        generatedRoot: datasetRoot,
      },
      entries,
      baselineDir,
    },
    createGenerateBaselineWorkflowDeps(datasetRoot),
  )
  if (result.skipped.length > 0) {
    throw new Error(
      `Baseline generation skipped ${result.skipped.join(', ')}.`,
    )
  }
  return {
    districtIds: result.written,
  }
}

const writeJson = async (targetPath: string, value: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const writeText = async (targetPath: string, value: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, value, 'utf-8')
}

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const listAnswerCaseFileNames = async (answerCasesDir: string) =>
  (await fs.readdir(answerCasesDir, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() && entry.name.endsWith('.answer-cases.json'),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

const copyAnswerCasesToStage = async (
  answerCasesDir: string,
  stagedAnswerCasesDir: string,
) => {
  const fileNames = await listAnswerCaseFileNames(answerCasesDir)
  await fs.mkdir(stagedAnswerCasesDir, { recursive: true })
  await Promise.all(
    fileNames.map((fileName) =>
      fs.copyFile(
        path.join(answerCasesDir, fileName),
        path.join(stagedAnswerCasesDir, fileName),
      ),
    ),
  )
  return fileNames
}

const sortedUnique = (values: string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right))

const assertSameDistricts = (
  label: string,
  actualDistrictIds: string[],
  expectedDistrictIds: string[],
) => {
  const actual = sortedUnique(actualDistrictIds)
  const expected = sortedUnique(expectedDistrictIds)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} districts ${actual.join(', ') || '-'} do not match release districts ${expected.join(', ') || '-'}.`,
    )
  }
}

const parseJson = async (targetPath: string) =>
  JSON.parse(await fs.readFile(targetPath, 'utf-8')) as Record<string, unknown>

export const baselineIdentityPayload = (
  value: Record<string, unknown>,
): Record<string, unknown> => {
  const identity = { ...value }
  delete identity.baselineCreatedAt
  delete identity.generatedAt
  delete identity.performance
  return identity
}

const jsonFilesEqual = async (
  sourcePath: string,
  targetPath: string,
  kind: ReconciledFileKind,
) => {
  if (!(await fileExists(targetPath))) {
    return false
  }
  const [source, target] = await Promise.all([
    parseJson(sourcePath),
    parseJson(targetPath),
  ])
  const normalize =
    kind === 'baseline'
      ? baselineIdentityPayload
      : (value: Record<string, unknown>) => value
  return JSON.stringify(normalize(source)) === JSON.stringify(normalize(target))
}

const buildStagedTargets = async (params: {
  districtIds: string[]
  stagedAnswerCasesDir: string
  stagedBaselineDir: string
  answerCasesDir: string
  baselineDir: string
}) => {
  const targets: StagedTarget[] = []
  for (const districtId of params.districtIds) {
    const answerCaseSource = path.join(
      params.stagedAnswerCasesDir,
      `${districtId}.answer-cases.json`,
    )
    const answerCaseTarget = path.join(
      params.answerCasesDir,
      `${districtId}.answer-cases.json`,
    )
    const baselineSource = path.join(
      params.stagedBaselineDir,
      `${districtId}.json`,
    )
    const baselineTarget = path.join(params.baselineDir, `${districtId}.json`)
    for (const candidate of [
      {
        kind: 'answer-cases' as const,
        sourcePath: answerCaseSource,
        targetPath: answerCaseTarget,
      },
      {
        kind: 'baseline' as const,
        sourcePath: baselineSource,
        targetPath: baselineTarget,
      },
    ]) {
      if (!(await fileExists(candidate.sourcePath))) {
        throw new Error(
          `Staged ${candidate.kind} file is missing for ${districtId}: ${candidate.sourcePath}`,
        )
      }
      targets.push({
        districtId,
        ...candidate,
        changed: !(await jsonFilesEqual(
          candidate.sourcePath,
          candidate.targetPath,
          candidate.kind,
        )),
      })
    }
  }
  return targets
}

export const applyReconciledFiles = async (targets: StagedTarget[]) => {
  const changed = targets.filter((target) => target.changed)
  const backups = new Map<string, Buffer | null>()
  try {
    for (const target of changed) {
      backups.set(
        target.targetPath,
        (await fileExists(target.targetPath))
          ? await fs.readFile(target.targetPath)
          : null,
      )
    }
    for (const target of changed) {
      await fs.mkdir(path.dirname(target.targetPath), { recursive: true })
      await fs.copyFile(target.sourcePath, target.targetPath)
    }
  } catch (error) {
    for (const [targetPath, backup] of backups) {
      if (backup === null) {
        await fs.rm(targetPath, { force: true })
      } else {
        await fs.writeFile(targetPath, backup)
      }
    }
    throw error
  }
}

const toResultFiles = (
  targets: StagedTarget[],
  execute: boolean,
): ReconciledFile[] =>
  targets.map((target) => ({
    districtId: target.districtId,
    kind: target.kind,
    sourcePath: target.sourcePath,
    targetPath: target.targetPath,
    status: target.changed
      ? execute
        ? 'updated'
        : 'would-update'
      : 'unchanged',
  }))

export const reconcileReleaseEvidence = async (
  options: ReconcileReleaseEvidenceOptions = {},
  dependencies: ReconcileReleaseEvidenceDependencies = {},
): Promise<ReconcileReleaseEvidenceResult> => {
  const execute = Boolean(options.execute)
  const tmpDir = path.resolve(options.tmpDir ?? DEFAULT_TMP_DIR)
  const datasetRoot = path.join(tmpDir, 'generated')
  const answerCasesDir = path.resolve(
    options.answerCasesDir ?? DEFAULT_ANSWER_CASES_DIR,
  )
  const baselineDir = path.resolve(options.baselineDir ?? DEFAULT_BASELINE_DIR)
  const result: ReconcileReleaseEvidenceResult = {
    pass: false,
    execute,
    releaseId: null,
    packageSource: null,
    manifestSource: null,
    datasetRoot,
    answerCasesDir,
    baselineDir,
    districtIds: [],
    caseCount: 0,
    semanticValidationPassed: false,
    baselineGenerationPassed: false,
    files: [],
    errors: [],
  }
  const installPackage = dependencies.installPackage ?? installReleasePackage
  const refreshAnswerCases =
    dependencies.refreshAnswerCases ?? refreshReviewedAnswerCaseHashes
  const generateBaselines =
    dependencies.generateBaselines ?? defaultGenerateBaselines
  let stageRoot: string | null = null

  try {
    const packageUrl =
      options.packageUrl ?? process.env.PARKKING_RELEASE_PACKAGE_URL ?? null
    const manifestUrl =
      options.manifestUrl ?? process.env.PARKKING_RELEASE_MANIFEST_URL ?? null
    const downloadToken =
      options.downloadToken ??
      process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN ??
      null
    const downloadAuthHeader =
      options.downloadAuthHeader ??
      process.env.PARKKING_RELEASE_DOWNLOAD_AUTH_HEADER ??
      null
    if (!options.zipPath && !packageUrl) {
      throw new Error('A release package URL or --zip path is required.')
    }
    if (!options.manifestPath && !manifestUrl) {
      throw new Error('A release manifest URL or --manifest path is required.')
    }

    await fs.mkdir(tmpDir, { recursive: true })
    stageRoot = await fs.mkdtemp(path.join(tmpDir, 'stage-'))
    const stagedAnswerCasesDir = path.join(stageRoot, 'answer-cases')
    const stagedBaselineDir = path.join(stageRoot, 'baselines')
    await copyAnswerCasesToStage(answerCasesDir, stagedAnswerCasesDir)

    const installed = await installPackage({
      url: packageUrl,
      manifestUrl,
      zipPath: options.zipPath,
      manifestPath: options.manifestPath,
      outRoot: datasetRoot,
      tmpDir: path.join(tmpDir, 'downloads'),
      downloadToken,
      downloadAuthHeader,
      requireManifest: true,
      clean: true,
    })
    if (!installed.manifestValidation?.pass) {
      throw new Error('Release manifest validation did not pass.')
    }
    result.releaseId = installed.manifestValidation.releaseId
    result.packageSource = installed.source
    result.manifestSource = installed.manifestSource
    result.districtIds = sortedUnique(installed.registryDistrictIds)

    const refreshed = await refreshAnswerCases({
      datasetRoot,
      answerCasesDir: stagedAnswerCasesDir,
      districtIds: result.districtIds,
      execute: true,
    })
    result.caseCount = refreshed.refreshed.reduce(
      (sum, entry) => sum + entry.caseCount,
      0,
    )
    result.semanticValidationPassed = refreshed.pass
    if (!refreshed.pass) {
      throw new Error(
        `Reviewed answer-case semantic validation failed: ${[
          ...refreshed.errors,
          ...refreshed.refreshed.flatMap((entry) => entry.errors),
        ].join('; ')}`,
      )
    }
    assertSameDistricts(
      'Reviewed answer-case',
      refreshed.refreshed.map(({ districtId }) => districtId),
      result.districtIds,
    )

    const generated = await generateBaselines(datasetRoot, stagedBaselineDir)
    assertSameDistricts(
      'Generated baseline',
      generated.districtIds,
      result.districtIds,
    )
    result.baselineGenerationPassed = true

    const stagedTargets = await buildStagedTargets({
      districtIds: result.districtIds,
      stagedAnswerCasesDir,
      stagedBaselineDir,
      answerCasesDir,
      baselineDir,
    })
    if (execute) {
      await applyReconciledFiles(stagedTargets)
    }
    result.files = toResultFiles(stagedTargets, execute)
    result.pass = true
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  } finally {
    if (stageRoot) {
      await fs.rm(stageRoot, { recursive: true, force: true })
    }
  }

  return result
}

const displayPath = (targetPath: string) => {
  const relative = path.relative(process.cwd(), targetPath)
  return relative && !relative.startsWith('..') ? relative : targetPath
}

export const renderReconcileReleaseEvidence = (
  result: ReconcileReleaseEvidenceResult,
) => {
  const changed = result.files.filter(({ status }) => status !== 'unchanged')
  const lines = [
    `# Release Evidence Reconciliation: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Mode: ${result.execute ? 'execute' : 'report-only'}`,
    `- Release ID: ${result.releaseId ?? '-'}`,
    `- Package: ${result.packageSource ?? '-'}`,
    `- Manifest: ${result.manifestSource ?? '-'}`,
    `- Dataset root: ${result.datasetRoot}`,
    `- Districts: ${result.districtIds.length}`,
    `- Reviewed cases: ${result.caseCount}`,
    `- Semantic validation: ${result.semanticValidationPassed ? 'pass' : 'fail'}`,
    `- Baseline generation: ${result.baselineGenerationPassed ? 'pass' : 'fail'}`,
    `- Tracked evidence changes: ${changed.length}`,
    '',
    '| Status | District | Evidence | Target |',
    '| --- | --- | --- | --- |',
    ...result.files.map(
      (file) =>
        `| ${file.status} | ${file.districtId} | ${file.kind} | ${displayPath(file.targetPath)} |`,
    ),
    ...(result.errors.length > 0
      ? ['', '## Errors', '', ...result.errors.map((error) => `- ${error}`)]
      : []),
    '',
  ]
  return lines.join('\n')
}

const run = async () => {
  const options = parseReconcileReleaseEvidenceArgs(process.argv)
  const result = await reconcileReleaseEvidence(options)
  const markdown = renderReconcileReleaseEvidence(result)
  console.log(options.json ? JSON.stringify(result, null, 2) : markdown)
  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeJson(path.resolve(options.jsonOutPath), result)
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
