import { fileURLToPath } from 'node:url'
import { buildIssueReportArtifactIndex } from './issueReportArtifactIndex'
import {
  buildIssueReportArtifactSummaryJsonOutput,
  renderIssueReportArtifactSummary,
} from './issueReportArtifactSummary'
import {
  buildIssueReportArtifactSummaryJsonSurfaceSummary,
} from './issueReportArtifactSummaryJson'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'
import { buildIssueReportWorkflowArtifacts } from './issueReportWorkflowArtifacts'
import type { IssueReportWorkflowArtifactArgs } from './issueReportWorkflowArtifactArgs'
import type {
  IssueReportArtifactIndexOutput,
  IssueReportArtifactSummaryJsonOutput,
  IssueReportArtifactSummarySurfaceSummary,
} from './issueReportSummaryTypes'

type Env = NodeJS.ProcessEnv

export interface WorkflowIssueArtifactRefreshOptions {
  manifestPath: string
  label?: string | null
  packetRootUrl?: string | null
  packetRootUrlEnv?: string | null
  csvRootUrl?: string | null
  csvRootUrlEnv?: string | null
  publishGateSummaryUrl?: string | null
  publishGateSummaryUrlEnv?: string | null
  topCount?: number
}

export interface WorkflowIssueArtifactRefreshResolvedOptions {
  manifestPath: string
  label: string | null
  packetRootUrl: string | null
  csvRootUrl: string | null
  publishGateSummaryUrl: string | null
  topCount: number
}

export interface WorkflowIssueArtifactRefreshFiles {
  artifactIndexPath: string
  indexSummaryJsonPath: string
  indexSurfacePath: string
  indexSummaryPath: string
}

export interface WorkflowIssueArtifactRefreshResult
  extends WorkflowIssueArtifactRefreshFiles {
  manifestPath: string
  packetRootPath: string
  csvRootPath: string
}

export interface WorkflowIssueArtifactRefreshRunners {
  buildWorkflowArtifacts: (
    args: IssueReportWorkflowArtifactArgs,
  ) => Promise<{ manifestPath: string; packetRootPath: string; csvRootPath: string }>
  writeIndexSummaries: (
    options: WorkflowIssueArtifactRefreshResolvedOptions,
  ) => Promise<WorkflowIssueArtifactRefreshFiles>
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

const optionalArg = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    const value = index >= 0 ? argv[index + 1] : null
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
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

const normalizeOptionalText = (value: string | null | undefined) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const resolveEnvBackedValue = (params: {
  directValue?: string | null
  envName?: string | null
  env: Env
  label: string
}) => {
  const directValue = normalizeOptionalText(params.directValue)
  const envName = normalizeOptionalText(params.envName)
  const envValue = envName ? normalizeOptionalText(params.env[envName]) : null
  if (directValue && envValue && directValue !== envValue) {
    throw new Error(`${params.label} conflicts with ${envName}`)
  }
  return directValue ?? envValue
}

export const parseWorkflowIssueArtifactRefreshArgs = (
  argv: string[],
): WorkflowIssueArtifactRefreshOptions => ({
  manifestPath: requiredArg(argv, '--manifest'),
  label: optionalArg(argv, '--label'),
  packetRootUrl: optionalArg(argv, '--packet-root-url', '--packet-artifact-url'),
  packetRootUrlEnv: optionalArg(argv, '--packet-root-url-env', '--packet-artifact-url-env'),
  csvRootUrl: optionalArg(argv, '--csv-root-url', '--csv-artifact-url'),
  csvRootUrlEnv: optionalArg(argv, '--csv-root-url-env', '--csv-artifact-url-env'),
  publishGateSummaryUrl: optionalArg(argv, '--publish-gate-summary-url'),
  publishGateSummaryUrlEnv: optionalArg(argv, '--publish-gate-summary-url-env'),
  topCount: parsePositiveInteger(optionalArg(argv, '--top-count'), DEFAULT_TOP_COUNT, 'top count'),
})

export const resolveWorkflowIssueArtifactRefreshOptions = (
  options: WorkflowIssueArtifactRefreshOptions,
  env: Env = process.env,
): WorkflowIssueArtifactRefreshResolvedOptions => ({
  manifestPath: options.manifestPath,
  label: normalizeOptionalText(options.label),
  packetRootUrl: resolveEnvBackedValue({
    directValue: options.packetRootUrl,
    envName: options.packetRootUrlEnv,
    env,
    label: 'packet root url',
  }),
  csvRootUrl: resolveEnvBackedValue({
    directValue: options.csvRootUrl,
    envName: options.csvRootUrlEnv,
    env,
    label: 'csv root url',
  }),
  publishGateSummaryUrl: resolveEnvBackedValue({
    directValue: options.publishGateSummaryUrl,
    envName: options.publishGateSummaryUrlEnv,
    env,
    label: 'publish gate summary url',
  }),
  topCount: options.topCount ?? DEFAULT_TOP_COUNT,
})

const writeJsonOutput = async (outPath: string, value: unknown) =>
  writeIssueReportSummaryOutput(outPath, `${JSON.stringify(value, null, 2)}\n`)

const buildIndexSummaryJson = (
  index: IssueReportArtifactIndexOutput,
  options: WorkflowIssueArtifactRefreshResolvedOptions,
): IssueReportArtifactSummaryJsonOutput =>
  buildIssueReportArtifactSummaryJsonOutput({
    index,
    options: {
      label: options.label,
      publishGateSummaryUrl: options.publishGateSummaryUrl,
      topCount: options.topCount,
      inputArtifactType: 'issue-report-workflow-artifacts',
    },
  })

const buildIndexSurface = (
  summaryPath: string,
  summary: IssueReportArtifactSummaryJsonOutput,
): IssueReportArtifactSummarySurfaceSummary =>
  buildIssueReportArtifactSummaryJsonSurfaceSummary({
    summaryPath,
    summary,
  })

export const writeWorkflowIssueArtifactIndexSummaries = async (
  options: WorkflowIssueArtifactRefreshResolvedOptions,
): Promise<WorkflowIssueArtifactRefreshFiles> => {
  const index = await buildIssueReportArtifactIndex(options.manifestPath)
  const artifactIndexPath = await writeJsonOutput(
    index.rootManifest.artifactIndexPath,
    index,
  )
  const summaryJson = buildIndexSummaryJson(index, options)
  const indexSummaryJsonPath = await writeJsonOutput(
    index.rootManifest.indexSummaryJsonPath,
    summaryJson,
  )
  const surface = buildIndexSurface(indexSummaryJsonPath, summaryJson)
  const indexSurfacePath = await writeJsonOutput(
    index.rootManifest.indexSurfacePath,
    surface,
  )
  const markdownSummary = renderIssueReportArtifactSummary(surface, {
    label: options.label,
    publishGateSummaryUrl: options.publishGateSummaryUrl,
    topCount: options.topCount,
    inputArtifactType: 'issue-report-workflow-artifacts',
  })
  const indexSummaryPath = await writeIssueReportSummaryOutput(
    index.rootManifest.indexSummaryPath,
    `${markdownSummary}\n`,
  )

  return {
    artifactIndexPath,
    indexSummaryJsonPath,
    indexSurfacePath,
    indexSummaryPath,
  }
}

const defaultRunners: WorkflowIssueArtifactRefreshRunners = {
  buildWorkflowArtifacts: buildIssueReportWorkflowArtifacts,
  writeIndexSummaries: writeWorkflowIssueArtifactIndexSummaries,
}

export const refreshWorkflowIssueArtifacts = async (
  options: WorkflowIssueArtifactRefreshOptions,
  env: Env = process.env,
  runners: WorkflowIssueArtifactRefreshRunners = defaultRunners,
): Promise<WorkflowIssueArtifactRefreshResult> => {
  const resolved = resolveWorkflowIssueArtifactRefreshOptions(options, env)
  const artifacts = await runners.buildWorkflowArtifacts({
    manifestPath: resolved.manifestPath,
    syncStorePath: null,
    outRoot: '.tmp/issue-report-artifacts',
    limit: DEFAULT_TOP_COUNT,
    packetIssueLimit: DEFAULT_TOP_COUNT,
    publishGateSummaryPath: null,
    indexBaseUrl: null,
    packetRootUrl: resolved.packetRootUrl,
    csvRootUrl: resolved.csvRootUrl,
  })
  const files = await runners.writeIndexSummaries(resolved)

  return {
    manifestPath: artifacts.manifestPath,
    packetRootPath: artifacts.packetRootPath,
    csvRootPath: artifacts.csvRootPath,
    ...files,
  }
}

const formatResult = (result: WorkflowIssueArtifactRefreshResult) =>
  [
    'Workflow issue artifacts: REFRESHED',
    `Manifest: ${result.manifestPath}`,
    `Packet root: ${result.packetRootPath}`,
    `CSV root: ${result.csvRootPath}`,
    `Artifact index: ${result.artifactIndexPath}`,
    `Index summary json: ${result.indexSummaryJsonPath}`,
    `Index surface: ${result.indexSurfacePath}`,
    `Index summary: ${result.indexSummaryPath}`,
  ].join('\n')

const run = async () => {
  const result = await refreshWorkflowIssueArtifacts(
    parseWorkflowIssueArtifactRefreshArgs(process.argv),
  )
  console.log(formatResult(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
