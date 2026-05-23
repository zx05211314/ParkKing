import { relative, resolve } from 'node:path'
import {
  joinIssueReportBaseUrl,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import type {
  IssueReportArtifactSummaryJsonOutput,
  IssueReportArtifactSummarySurfaceSummary,
  IssueReportSummaryArtifactsManifest,
  IssueReportSummaryArtifactOutputs,
  IssueReportSummaryJsonOutput,
  IssueReportSummaryIndexFileEntry,
  IssueReportSummaryIndexOutput,
} from './issueReportSummaryTypes'

interface IssueReportManualPreferredCsvTarget {
  path: string | null
  relativePath: string | null
  url: string | null
}

interface IssueReportManualPacketTarget {
  path: string | null
  relativePath: string | null
  url: string | null
}

const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const resolveIssueReportManualManifestRootRelativePath = (
  outRoot: string,
  rootPath: string | null,
) => (
  rootPath
    ? toPortablePath(relative(outRoot, rootPath))
    : null
)

const resolveIssueReportManualManifestPacketTarget = (params: {
  rootPath: string | null
  baseUrl: string | null
  path: string | null
  relativePath: string | null
  url: string | null
}): IssueReportManualPacketTarget => {
  const relativePath =
    params.relativePath
    ?? (
    params.rootPath && params.path
      ? toPortablePath(relative(params.rootPath, params.path))
      : null
    )
  const url = params.url ?? joinIssueReportBaseUrl(params.baseUrl, relativePath)
  return {
    path: params.path,
    relativePath,
    url,
  }
}

const resolveIssueReportManualManifestRootUrls = (
  manifest: IssueReportSummaryArtifactsManifest,
) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: manifest.packetRootUrl,
    packetLegacyArtifactUrl: manifest.packetArtifactUrl,
    csvRootUrl: manifest.csvRootUrl,
    csvLegacyArtifactUrl: manifest.csvArtifactUrl,
  })

const hasIssueReportManualManifestPacketOverride = (
  manifest: IssueReportSummaryArtifactsManifest,
) =>
  manifest.packetRootPath !== null
  || manifest.packetArtifactUrl !== null
  || manifest.packetSummaryPath !== null
  || manifest.packetManifestPath !== null
  || manifest.packetPaths.length > 0

export const resolveIssueReportManualManifestPreferredCsv = (
  manifest: IssueReportSummaryArtifactsManifest,
): IssueReportManualPreferredCsvTarget => {
  const { csvRootUrl } = resolveIssueReportManualManifestRootUrls(manifest)
  const path =
    manifest.preferredCsvPath
    ?? (
      manifest.csvRootPath && manifest.preferredCsvRelativePath
        ? resolve(manifest.csvRootPath, manifest.preferredCsvRelativePath)
        : null
    )
  const relativePath =
    manifest.preferredCsvRelativePath
    ?? (
      manifest.csvRootPath && path
        ? toPortablePath(relative(manifest.csvRootPath, path))
        : null
    )
  const url = manifest.preferredCsvUrl ?? joinIssueReportBaseUrl(csvRootUrl, relativePath)
  return {
    path,
    relativePath,
    url,
  }
}

const resolveIssueReportManualManifestCsvFiles = (
  manifest: IssueReportSummaryArtifactsManifest,
) =>
  manifest.csvPaths
    .map((pathValue) => {
      const { csvRootUrl } = resolveIssueReportManualManifestRootUrls(manifest)
      const relativePath =
        manifest.csvRootPath
          ? toPortablePath(relative(manifest.csvRootPath, pathValue))
          : null
      return {
        path: pathValue,
        relativePath,
        url: joinIssueReportBaseUrl(csvRootUrl, relativePath),
      }
    })
    .map((target) => toIssueReportSummaryIndexFileEntry(target))
    .filter((entry): entry is IssueReportSummaryIndexFileEntry => entry !== null)

export const resolveIssueReportManualManifestPacketSummary = (
  manifest: IssueReportSummaryArtifactsManifest,
): IssueReportManualPacketTarget =>
  resolveIssueReportManualManifestPacketTarget({
    rootPath: manifest.packetRootPath,
    baseUrl: resolveIssueReportManualManifestRootUrls(manifest).packetRootUrl,
    path: manifest.packetSummaryPath,
    relativePath: manifest.packetSummaryRelativePath,
    url: manifest.packetSummaryUrl,
  })

export const resolveIssueReportManualManifestPacketManifest = (
  manifest: IssueReportSummaryArtifactsManifest,
): IssueReportManualPacketTarget =>
  resolveIssueReportManualManifestPacketTarget({
    rootPath: manifest.packetRootPath,
    baseUrl: resolveIssueReportManualManifestRootUrls(manifest).packetRootUrl,
    path: manifest.packetManifestPath,
    relativePath: manifest.packetManifestRelativePath,
    url: manifest.packetManifestUrl,
  })

const resolveIssueReportManualManifestPacketFiles = (
  manifest: IssueReportSummaryArtifactsManifest,
) =>
  manifest.packetPaths
    .map((pathValue) =>
      resolveIssueReportManualManifestPacketTarget({
        rootPath: manifest.packetRootPath,
        baseUrl: resolveIssueReportManualManifestRootUrls(manifest).packetRootUrl,
        path: pathValue,
        relativePath: manifest.packetRootPath
          ? toPortablePath(relative(manifest.packetRootPath, pathValue))
          : null,
        url: null,
      }),
    )
    .map((target) => toIssueReportSummaryIndexFileEntry(target))
    .filter((entry): entry is IssueReportSummaryIndexFileEntry => entry !== null)

const toIssueReportSummaryIndexFileEntry = (
  target: IssueReportManualPreferredCsvTarget | IssueReportManualPacketTarget,
): IssueReportSummaryIndexFileEntry | null =>
  target.path && target.relativePath
    ? {
        path: target.path,
        relativePath: target.relativePath,
        url: target.url,
      }
    : null

export const applyIssueReportManualManifestPreferredCsvToSummaryIndex = (
  index: IssueReportSummaryIndexOutput,
  manifest: IssueReportSummaryArtifactsManifest,
): IssueReportSummaryIndexOutput => {
  const { csvRootUrl, csvArtifactUrl: csvBaseUrl } =
    resolveIssueReportManualManifestRootUrls(manifest)
  const nextIndex: IssueReportSummaryIndexOutput = {
    ...index,
    csvRootPath: manifest.csvRootPath,
    csvRootUrl,
    csvBaseUrl,
    preferredCsvFile: toIssueReportSummaryIndexFileEntry(
      resolveIssueReportManualManifestPreferredCsv(manifest),
    ),
    csvExports: resolveIssueReportManualManifestCsvFiles(manifest),
  }

  if (!hasIssueReportManualManifestPacketOverride(manifest)) {
    return nextIndex
  }

  const { packetRootUrl, packetArtifactUrl: packetBaseUrl } =
    resolveIssueReportManualManifestRootUrls(manifest)

  return {
    ...nextIndex,
    packetRootPath: manifest.packetRootPath,
    packetRootUrl,
    packetBaseUrl,
    packetSummaryFile: toIssueReportSummaryIndexFileEntry(
      resolveIssueReportManualManifestPacketSummary(manifest),
    ),
    packetManifestFile: toIssueReportSummaryIndexFileEntry(
      resolveIssueReportManualManifestPacketManifest(manifest),
    ),
    packetFiles: resolveIssueReportManualManifestPacketFiles(manifest),
  }
}

const toSummaryArtifactPacketOutputs = (
  manifest: IssueReportSummaryArtifactsManifest,
): Pick<
  IssueReportSummaryArtifactOutputs,
  | 'packetRootPath'
  | 'packetRootUrl'
  | 'packetBaseUrl'
  | 'packetSummaryPath'
  | 'packetSummaryRelativePath'
  | 'packetSummaryUrl'
  | 'packetManifestPath'
  | 'packetManifestRelativePath'
  | 'packetManifestUrl'
  | 'packetPaths'
  | 'packetRelativePaths'
> => {
  const { packetRootUrl, packetArtifactUrl: packetBaseUrl } =
    resolveIssueReportManualManifestRootUrls(manifest)
  const packetSummary = resolveIssueReportManualManifestPacketSummary(manifest)
  const packetManifest = resolveIssueReportManualManifestPacketManifest(manifest)
  const packetFiles = manifest.packetPaths.map((pathValue) =>
    resolveIssueReportManualManifestPacketTarget({
      rootPath: manifest.packetRootPath,
      baseUrl: packetRootUrl,
      path: pathValue,
    }),
  )
  return {
    packetRootPath: manifest.packetRootPath,
    packetRootUrl,
    packetBaseUrl,
    packetSummaryPath: packetSummary.path,
    packetSummaryRelativePath: packetSummary.relativePath,
    packetSummaryUrl: packetSummary.url,
    packetManifestPath: packetManifest.path,
    packetManifestRelativePath: packetManifest.relativePath,
    packetManifestUrl: packetManifest.url,
    packetPaths: packetFiles.flatMap((target) => (target.path ? [target.path] : [])),
    packetRelativePaths: packetFiles.flatMap((target) =>
      target.relativePath ? [target.relativePath] : []
    ),
  }
}

export const applyIssueReportManualManifestPreferredCsvToSummaryJson = (
  summary: IssueReportArtifactSummaryJsonOutput,
  manifest: IssueReportSummaryArtifactsManifest,
): IssueReportArtifactSummaryJsonOutput => {
  const preferredCsv = resolveIssueReportManualManifestPreferredCsv(manifest)
  const { csvRootUrl, csvArtifactUrl } = resolveIssueReportManualManifestRootUrls(manifest)
  const nextSummary: IssueReportArtifactSummaryJsonOutput = {
    ...summary,
    summaryEntries: {
      ...summary.summaryEntries,
      csvRootRelativePath: resolveIssueReportManualManifestRootRelativePath(
        manifest.outRoot,
        manifest.csvRootPath,
      ),
      preferredCsvRelativePath: preferredCsv.relativePath,
    },
    artifactLinks: {
      ...summary.artifactLinks,
      csvRootUrl,
      csvArtifactUrl,
      preferredCsvUrl: preferredCsv.url,
    },
  }

  if (!hasIssueReportManualManifestPacketOverride(manifest)) {
    return nextSummary
  }

  const packetSummary = resolveIssueReportManualManifestPacketSummary(manifest)
  const packetManifest = resolveIssueReportManualManifestPacketManifest(manifest)
  const { packetRootUrl, packetArtifactUrl } =
    resolveIssueReportManualManifestRootUrls(manifest)
  return {
    ...nextSummary,
    summaryEntries: {
      ...nextSummary.summaryEntries,
      packetRootRelativePath: resolveIssueReportManualManifestRootRelativePath(
        manifest.outRoot,
        manifest.packetRootPath,
      ),
      packetSummaryRelativePath: packetSummary.relativePath,
      packetManifestRelativePath: packetManifest.relativePath,
    },
    artifactLinks: {
      ...nextSummary.artifactLinks,
      packetRootUrl,
      packetSummaryUrl: packetSummary.url,
      packetManifestUrl: packetManifest.url,
      packetArtifactUrl,
    },
  }
}

export const applyIssueReportManualManifestPreferredCsvToSummaryExport = (
  summary: IssueReportSummaryJsonOutput,
  manifest: IssueReportSummaryArtifactsManifest,
): IssueReportSummaryJsonOutput => {
  const preferredCsv = resolveIssueReportManualManifestPreferredCsv(manifest)
  const { csvRootUrl, csvArtifactUrl: csvBaseUrl } =
    resolveIssueReportManualManifestRootUrls(manifest)
  const nextSummary: IssueReportSummaryJsonOutput = {
    ...summary,
    artifacts: {
      ...summary.artifacts,
      csvRootPath: manifest.csvRootPath,
      csvRootUrl,
      csvBaseUrl,
      preferredCsvPath: preferredCsv.path,
      preferredCsvRelativePath: preferredCsv.relativePath,
      preferredCsvUrl: preferredCsv.url,
      csvPaths: resolveIssueReportManualManifestCsvFiles(manifest).map((entry) => entry.path),
      csvRelativePaths: resolveIssueReportManualManifestCsvFiles(manifest).map(
        (entry) => entry.relativePath,
      ),
    },
  }

  if (!hasIssueReportManualManifestPacketOverride(manifest)) {
    return nextSummary
  }

  return {
    ...nextSummary,
    artifacts: {
      ...nextSummary.artifacts,
      ...toSummaryArtifactPacketOutputs(manifest),
    },
  }
}

export const applyIssueReportManualManifestPreferredCsvToSurfaceSummary = (
  surface: IssueReportArtifactSummarySurfaceSummary,
  manifest: IssueReportSummaryArtifactsManifest,
): IssueReportArtifactSummarySurfaceSummary => {
  const preferredCsv = resolveIssueReportManualManifestPreferredCsv(manifest)
  const { csvRootUrl, csvArtifactUrl } = resolveIssueReportManualManifestRootUrls(manifest)
  const nextSurface: IssueReportArtifactSummarySurfaceSummary = {
    ...surface,
    csvRootPath: manifest.csvRootPath,
    csvRootRelativePath: resolveIssueReportManualManifestRootRelativePath(
      manifest.outRoot,
      manifest.csvRootPath,
    ),
    csvRootUrl,
    csvArtifactUrl,
    preferredCsvRelativePath: preferredCsv.relativePath,
    preferredCsvUrl: preferredCsv.url,
  }

  if (!hasIssueReportManualManifestPacketOverride(manifest)) {
    return nextSurface
  }

  const packetSummary = resolveIssueReportManualManifestPacketSummary(manifest)
  const packetManifest = resolveIssueReportManualManifestPacketManifest(manifest)
  const { packetRootUrl, packetArtifactUrl } =
    resolveIssueReportManualManifestRootUrls(manifest)
  return {
    ...nextSurface,
    packetRootPath: manifest.packetRootPath,
    packetRootRelativePath: resolveIssueReportManualManifestRootRelativePath(
      manifest.outRoot,
      manifest.packetRootPath,
    ),
    packetRootUrl,
    packetSummaryRelativePath: packetSummary.relativePath,
    packetManifestRelativePath: packetManifest.relativePath,
    packetSummaryUrl: packetSummary.url,
    packetManifestUrl: packetManifest.url,
    packetArtifactUrl,
  }
}
