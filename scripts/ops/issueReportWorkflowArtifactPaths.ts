import { dirname, isAbsolute, resolve } from 'node:path'
import type {
  IssueReportSummaryArtifactsManifest,
  IssueReportWorkflowArtifactsManifest,
} from './issueReportSummaryTypes'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isIssueReportWorkflowArtifactsManifest = (
  value: unknown,
): value is IssueReportWorkflowArtifactsManifest =>
  isRecord(value) && value.artifactType === 'issue-report-workflow-artifacts'

export const isIssueReportSummaryArtifactsManifest = (
  value: unknown,
): value is IssueReportSummaryArtifactsManifest =>
  isRecord(value) && value.artifactType === 'issue-report-summary-artifacts'

export const resolveIssueReportArtifactEntryPath = (
  manifestPath: string,
  relativePath: string | null,
  absolutePath: string | null,
) => {
  if (relativePath) {
    return resolve(dirname(manifestPath), relativePath)
  }
  if (!absolutePath) {
    return null
  }
  return isAbsolute(absolutePath)
    ? absolutePath
    : resolve(dirname(manifestPath), absolutePath)
}

export const resolveIssueReportWorkflowArtifactEntryPath =
  resolveIssueReportArtifactEntryPath
