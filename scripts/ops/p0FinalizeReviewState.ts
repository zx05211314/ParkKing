import * as path from 'node:path'
import { runIngestAll } from '../ingest/ingestAll'
import { buildP0PromoteReview } from './p0PromoteReviewState'
import { buildP0Readiness } from './p0ReadinessState'
import { buildRefreshPublishReport } from './refreshPublishReportState'
import { writeAnswerCases } from './writeAnswerCases'
import type {
  P0FinalizeReviewInputs,
  P0FinalizeReviewParams,
  P0FinalizeReviewResult,
  P0FinalizeReviewRunners,
  P0FinalizeReviewStep,
} from './p0FinalizeReviewTypes'

const DEFAULT_DISTRICT_ID = 'xinyi'
const DEFAULT_PUBLISH_REPORT_PATH = path.join(
  'public',
  'data',
  'generated',
  'ingest_all_report.json',
)

const defaultRunners: P0FinalizeReviewRunners = {
  promote: buildP0PromoteReview,
  ingest: runIngestAll,
  refresh: buildRefreshPublishReport,
  answerCases: writeAnswerCases,
  readiness: buildP0Readiness,
}

const resolveInputs = (params: P0FinalizeReviewParams): P0FinalizeReviewInputs => {
  const districtId = params.districtId?.trim() || DEFAULT_DISTRICT_ID
  return {
    districtId,
    sourcePath: path.resolve(params.sourcePath ?? path.join('.tmp', `${districtId}-review.csv`)),
    reviewsPath: path.resolve(
      params.reviewsPath ?? path.join('.tmp', `${districtId}-next-review.csv`),
    ),
    mergedOutPath: path.resolve(
      params.mergedOutPath ?? path.join('.tmp', `${districtId}-review.merged.csv`),
    ),
    configPath: path.resolve(
      params.configPath ?? path.join('configs', 'prod', `${districtId}.json`),
    ),
    answerCasesPath: path.resolve(
      params.answerCasesPath ?? path.join('configs', 'prod', `${districtId}.answer-cases.json`),
    ),
    outDir: params.outDir ? path.resolve(params.outDir) : null,
    publishReportPath: path.resolve(params.publishReportPath ?? DEFAULT_PUBLISH_REPORT_PATH),
    noCleanup: params.noCleanup ?? false,
    allowPublishWarn: Boolean(params.allowPublishWarn),
    allowPublishFail: Boolean(params.allowPublishFail),
    publishOverrideReason: params.publishOverrideReason?.trim() || null,
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const failedStep = (error: unknown): P0FinalizeReviewStep => ({
  pass: false,
  error: errorMessage(error),
})

const toIngestConfigGlob = (configPath: string) => {
  const relative = path.relative(process.cwd(), configPath)
  const candidate =
    relative && !relative.startsWith('..') && !path.isAbsolute(relative)
      ? relative
      : configPath
  return candidate.split(path.sep).join('/')
}

export const buildP0FinalizeReview = async (
  params: P0FinalizeReviewParams = {},
): Promise<P0FinalizeReviewResult> => {
  const inputs = resolveInputs(params)
  const runners = { ...defaultRunners, ...params.runners }
  const errors: string[] = []
  const warnings: string[] = []

  const promote = await runners.promote({
    districtId: inputs.districtId,
    sourcePath: inputs.sourcePath,
    reviewsPath: inputs.reviewsPath,
    mergedOutPath: inputs.mergedOutPath,
    configPath: inputs.configPath,
    outDir: inputs.outDir,
  })
  errors.push(...promote.errors)
  warnings.push(...promote.warnings)
  if (!promote.pass) {
    return {
      pass: false,
      stage: 'promote',
      inputs,
      promote,
      ingest: null,
      refresh: null,
      answerCases: null,
      readiness: null,
      errors,
      warnings,
    }
  }

  let ingest: P0FinalizeReviewStep
  try {
    const ingestArgs = [
      'node',
      'p0FinalizeReview',
      '--configs',
      toIngestConfigGlob(inputs.configPath),
    ]
    if (inputs.noCleanup) {
      ingestArgs.push('--noCleanup')
    }
    if (inputs.allowPublishWarn) {
      ingestArgs.push('--allowWarn')
    }
    if (inputs.allowPublishFail) {
      ingestArgs.push('--allowFail')
    }
    if ((inputs.allowPublishWarn || inputs.allowPublishFail) && inputs.publishOverrideReason) {
      ingestArgs.push('--override', inputs.publishOverrideReason)
    }
    await runners.ingest(ingestArgs)
    ingest = { pass: true, error: null }
  } catch (error) {
    ingest = failedStep(error)
    errors.push(`Ingest failed: ${ingest.error}`)
    return {
      pass: false,
      stage: 'ingest',
      inputs,
      promote,
      ingest,
      refresh: null,
      answerCases: null,
      readiness: null,
      errors,
      warnings,
    }
  }

  let refresh
  try {
    refresh = await runners.refresh({
      configPath: inputs.configPath,
      outPath: inputs.publishReportPath,
    })
  } catch (error) {
    errors.push(`Publish report refresh failed: ${errorMessage(error)}`)
    return {
      pass: false,
      stage: 'refresh',
      inputs,
      promote,
      ingest,
      refresh: null,
      answerCases: null,
      readiness: null,
      errors,
      warnings,
    }
  }

  const answerCases = await runners.answerCases({
    inputPath: inputs.mergedOutPath,
    datasetDir: refresh.datasetDir,
    outPath: inputs.answerCasesPath,
    districtId: inputs.districtId,
    validate: true,
  })
  errors.push(...answerCases.errors.map((error) => `Answer cases failed: ${error}`))
  if (!answerCases.pass) {
    return {
      pass: false,
      stage: 'answerCases',
      inputs,
      promote,
      ingest,
      refresh,
      answerCases,
      readiness: null,
      errors,
      warnings,
    }
  }

  const readiness = await runners.readiness({
    districtId: inputs.districtId,
    reviewPath: inputs.mergedOutPath,
    configPath: inputs.configPath,
    publishReportPath: inputs.publishReportPath,
    answerCasesPath: inputs.answerCasesPath,
    allowPublishWarn: inputs.allowPublishWarn,
    allowPublishFail: inputs.allowPublishFail,
    publishOverrideReason: inputs.publishOverrideReason,
  })
  if (!readiness.pass) {
    errors.push('Readiness remained blocked after finalize workflow.')
  }

  return {
    pass: readiness.pass,
    stage: readiness.pass ? 'done' : 'readiness',
    inputs,
    promote,
    ingest,
    refresh,
    answerCases,
    readiness,
    errors,
    warnings,
  }
}
