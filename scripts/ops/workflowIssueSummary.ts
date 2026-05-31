import { fileURLToPath } from 'node:url'
import {
  assertIssueReportArtifactManifestKind,
  buildIssueReportArtifactManifestSummary,
  loadIssueReportArtifactManifestBundle,
  renderIssueReportArtifactManifestSummary,
  validateIssueReportArtifactManifestRelations,
  validateIssueReportArtifactSummaryFiles,
} from './issueReportArtifactManifest'
import {
  loadIssueReportArtifactSummaryInputDetails,
  renderIssueReportArtifactSummary,
} from './issueReportArtifactSummary'
import {
  appendWorkflowSummary,
  type WorkflowSummaryResult,
} from './workflowSummary'

type Env = NodeJS.ProcessEnv

export interface WorkflowIssueSummaryOptions {
  manifestPath: string
  summaryPath?: string | null
  label?: string | null
  inputUrlEnv?: string | null
  publishGateSummaryUrlEnv?: string | null
  topCount?: number
}

export interface WorkflowIssueSummaryResult {
  manifestPath: string
  manifestValidation: string
  artifactSummary: string
  summary: WorkflowSummaryResult
}

export interface WorkflowIssueSummaryRunners {
  buildManifestValidation: (manifestPath: string) => Promise<string>
  buildArtifactSummary: (params: {
    manifestPath: string
    label: string | null
    inputUrl: string | null
    publishGateSummaryUrl: string | null
    topCount: number
  }) => Promise<string>
  appendSummary: typeof appendWorkflowSummary
}

const DEFAULT_TOP_COUNT = 5

const requiredArg = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  const value = index >= 0 ? argv[index + 1] : null
  if (!value) {
    throw new Error(`${flag} is required`)
  }
  return value
}

const optionalArg = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  const value = index >= 0 ? argv[index + 1] : null
  return value && value.trim().length > 0 ? value.trim() : null
}

const parsePositiveInteger = (value: string | null, fallback: number, label: string) => {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

export const parseWorkflowIssueSummaryArgs = (
  argv: string[],
): WorkflowIssueSummaryOptions => ({
  manifestPath: requiredArg(argv, '--manifest'),
  summaryPath: optionalArg(argv, '--summary') ?? undefined,
  label: optionalArg(argv, '--label'),
  inputUrlEnv: optionalArg(argv, '--input-url-env'),
  publishGateSummaryUrlEnv: optionalArg(argv, '--publish-gate-summary-url-env'),
  topCount: parsePositiveInteger(optionalArg(argv, '--top-count'), DEFAULT_TOP_COUNT, 'top count'),
})

export const buildWorkflowIssueManifestValidation = async (
  manifestPath: string,
) => {
  const bundle = await loadIssueReportArtifactManifestBundle(manifestPath)
  const manifest = assertIssueReportArtifactManifestKind(bundle.rootManifest, 'workflow')
  const relationSummary = validateIssueReportArtifactManifestRelations(bundle)
  const summaryValidation = await validateIssueReportArtifactSummaryFiles(manifest)
  return renderIssueReportArtifactManifestSummary(
    buildIssueReportArtifactManifestSummary(
      bundle.rootManifestPath,
      manifest,
      relationSummary,
      summaryValidation,
    ),
  )
}

export const buildWorkflowIssueArtifactSummary = async ({
  manifestPath,
  label,
  inputUrl,
  publishGateSummaryUrl,
  topCount,
}: {
  manifestPath: string
  label: string | null
  inputUrl: string | null
  publishGateSummaryUrl: string | null
  topCount: number
}) => {
  const loaded = await loadIssueReportArtifactSummaryInputDetails(manifestPath)
  return renderIssueReportArtifactSummary(loaded.index, {
    label,
    inputUrl,
    publishGateSummaryUrl,
    topCount,
    inputArtifactType: loaded.inputArtifactType,
  })
}

const defaultRunners: WorkflowIssueSummaryRunners = {
  buildManifestValidation: buildWorkflowIssueManifestValidation,
  buildArtifactSummary: buildWorkflowIssueArtifactSummary,
  appendSummary: appendWorkflowSummary,
}

const envValue = (env: Env, name?: string | null) =>
  name ? env[name]?.trim() || null : null

export const appendWorkflowIssueSummary = async (
  options: WorkflowIssueSummaryOptions,
  env: Env = process.env,
  runners: WorkflowIssueSummaryRunners = defaultRunners,
): Promise<WorkflowIssueSummaryResult> => {
  const topCount = options.topCount ?? DEFAULT_TOP_COUNT
  const inputUrl = envValue(env, options.inputUrlEnv)
  const publishGateSummaryUrl = envValue(env, options.publishGateSummaryUrlEnv)
  const manifestValidation = await runners.buildManifestValidation(options.manifestPath)
  const artifactSummary = await runners.buildArtifactSummary({
    manifestPath: options.manifestPath,
    label: options.label ?? null,
    inputUrl,
    publishGateSummaryUrl,
    topCount,
  })
  const summary = await runners.appendSummary(
    {
      summaryPath: options.summaryPath,
      events: [
        { type: 'appendText', text: manifestValidation },
        { type: 'appendText', text: artifactSummary },
      ],
    },
    env,
  )

  return {
    manifestPath: options.manifestPath,
    manifestValidation,
    artifactSummary,
    summary,
  }
}

const formatResult = (result: WorkflowIssueSummaryResult) =>
  [
    'Workflow issue artifact summary: WROTE',
    `Manifest: ${result.manifestPath}`,
    `Summary: ${result.summary.summaryPath ?? '-'}`,
  ].join('\n')

const run = async () => {
  const result = await appendWorkflowIssueSummary(
    parseWorkflowIssueSummaryArgs(process.argv),
  )
  console.log(formatResult(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
