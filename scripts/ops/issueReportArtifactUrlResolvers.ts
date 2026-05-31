export const joinIssueReportBaseUrl = (
  baseUrl: string | null | undefined,
  relativePath: string | null,
) =>
  baseUrl && relativePath
    ? `${baseUrl.replace(/\/+$/, '')}/${relativePath.replace(/^\/+/, '')}`
    : null

export const resolveIssueReportCanonicalRootUrl = (params: {
  rootUrl: string | null
  legacyBaseUrl?: string | null
  legacyArtifactUrl?: string | null
}) => params.rootUrl ?? params.legacyBaseUrl ?? params.legacyArtifactUrl ?? null

export const resolveIssueReportLegacyBaseUrl = (params: {
  rootUrl: string | null
  legacyBaseUrl: string | null | undefined
}) =>
  params.legacyBaseUrl && params.legacyBaseUrl !== params.rootUrl
    ? params.legacyBaseUrl
    : null

export const resolveIssueReportLegacyArtifactUrl = (params: {
  rootUrl: string | null
  legacyBaseUrl?: string | null
  legacyArtifactUrl: string | null | undefined
}) =>
  params.legacyArtifactUrl
  && params.legacyArtifactUrl !== params.rootUrl
  && params.legacyArtifactUrl !== params.legacyBaseUrl
    ? params.legacyArtifactUrl
    : null

export const resolveIssueReportArtifactRootUrls = (params: {
  packetRootUrl: string | null
  packetLegacyBaseUrl?: string | null
  packetLegacyArtifactUrl?: string | null
  csvRootUrl: string | null
  csvLegacyBaseUrl?: string | null
  csvLegacyArtifactUrl?: string | null
}) => {
  const packetRootUrl = resolveIssueReportCanonicalRootUrl({
    rootUrl: params.packetRootUrl,
    legacyBaseUrl: params.packetLegacyBaseUrl ?? null,
    legacyArtifactUrl: params.packetLegacyArtifactUrl ?? null,
  })
  const csvRootUrl = resolveIssueReportCanonicalRootUrl({
    rootUrl: params.csvRootUrl,
    legacyBaseUrl: params.csvLegacyBaseUrl ?? null,
    legacyArtifactUrl: params.csvLegacyArtifactUrl ?? null,
  })

  return {
    packetRootUrl,
    packetBaseUrl: resolveIssueReportLegacyBaseUrl({
      rootUrl: packetRootUrl,
      legacyBaseUrl: params.packetLegacyBaseUrl ?? null,
    }),
    packetArtifactUrl: resolveIssueReportLegacyArtifactUrl({
      rootUrl: packetRootUrl,
      legacyBaseUrl: params.packetLegacyBaseUrl ?? null,
      legacyArtifactUrl: params.packetLegacyArtifactUrl ?? null,
    }),
    csvRootUrl,
    csvBaseUrl: resolveIssueReportLegacyBaseUrl({
      rootUrl: csvRootUrl,
      legacyBaseUrl: params.csvLegacyBaseUrl ?? null,
    }),
    csvArtifactUrl: resolveIssueReportLegacyArtifactUrl({
      rootUrl: csvRootUrl,
      legacyBaseUrl: params.csvLegacyBaseUrl ?? null,
      legacyArtifactUrl: params.csvLegacyArtifactUrl ?? null,
    }),
  }
}

export const resolveIssueReportArtifactBundleUrls = (params: {
  packetRootUrl: string | null
  csvRootUrl: string | null
  preferredCsvUrl: string | null
  preferredCsvRelativePath: string | null
  packetSummaryUrl: string | null
  packetSummaryRelativePath: string | null
  packetManifestUrl: string | null
  packetManifestRelativePath: string | null
}) => ({
  preferredCsvUrl:
    params.preferredCsvUrl
    ?? joinIssueReportBaseUrl(params.csvRootUrl, params.preferredCsvRelativePath),
  packetSummaryUrl:
    params.packetSummaryUrl
    ?? joinIssueReportBaseUrl(params.packetRootUrl, params.packetSummaryRelativePath),
  packetManifestUrl:
    params.packetManifestUrl
    ?? joinIssueReportBaseUrl(params.packetRootUrl, params.packetManifestRelativePath),
})
