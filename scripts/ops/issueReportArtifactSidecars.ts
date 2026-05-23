import { dirname, resolve } from 'node:path'

export const ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH = 'index-summary.md'
export const ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH = 'index-summary.json'
export const ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH = 'index-surface.json'
export const ISSUE_REPORT_MANUAL_ARTIFACTS_MANIFEST_PATH = 'artifacts-manifest.json'

const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const joinPortablePath = (dirPath: string, fileName: string) => {
  const normalizedDir = toPortablePath(dirPath).replace(/\/+$/, '')
  if (normalizedDir.length === 0 || normalizedDir === '.') {
    return fileName
  }
  return `${normalizedDir}/${fileName}`
}

export const resolveIssueReportManualSidecarRelativePath = (
  indexRelativePath: string | null,
  fileName: string,
) => {
  if (!indexRelativePath) {
    return null
  }
  return joinPortablePath(dirname(indexRelativePath), fileName)
}

export const resolveIssueReportManualSidecarPath = (
  indexPath: string | null,
  fileName: string,
) => {
  if (!indexPath) {
    return null
  }
  return resolve(dirname(indexPath), fileName)
}

export const resolveIssueReportManualArtifactsManifestPath = (indexPath: string | null) =>
  resolveIssueReportManualSidecarPath(indexPath, ISSUE_REPORT_MANUAL_ARTIFACTS_MANIFEST_PATH)

export const resolveIssueReportManualArtifactsManifestRelativePath = (
  indexRelativePath: string | null,
) =>
  resolveIssueReportManualSidecarRelativePath(
    indexRelativePath,
    ISSUE_REPORT_MANUAL_ARTIFACTS_MANIFEST_PATH,
  )

export const resolveIssueReportManualSidecarUrl = (
  indexUrl: string | null,
  fileName: string,
) => {
  if (!indexUrl) {
    return null
  }
  const parsedUrl = new URL(indexUrl)
  const currentPath = parsedUrl.pathname.replace(/\/+$/, '')
  const nextPath = `${currentPath.replace(/\/[^/]*$/, '')}/${fileName}`.replace(/\/{2,}/g, '/')
  parsedUrl.pathname = nextPath
  return parsedUrl.toString()
}

export const resolveIssueReportManualArtifactsManifestUrl = (indexUrl: string | null) =>
  resolveIssueReportManualSidecarUrl(indexUrl, ISSUE_REPORT_MANUAL_ARTIFACTS_MANIFEST_PATH)
