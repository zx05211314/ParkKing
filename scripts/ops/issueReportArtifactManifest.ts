import { readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseIssueReportArtifactManifestArgs } from './issueReportArtifactManifestArgs'
import {
  parseIssueReportArtifactSummaryJsonOutput,
  parseIssueReportArtifactSummarySurfaceSummary,
} from './issueReportArtifactSummary'
import { buildIssueReportArtifactSummaryJsonSurfaceSummary } from './issueReportArtifactSummaryJson'
import {
  resolveIssueReportArtifactBundleUrls,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import {
  ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION,
  ISSUE_REPORT_SUMMARY_ARTIFACTS_MANIFEST_SCHEMA_VERSION,
  ISSUE_REPORT_WORKFLOW_ARTIFACT_MANIFEST_SCHEMA_VERSION,
} from './issueReportSummaryTypes'
import type {
  IssueReportArtifactManifest,
  IssueReportSummaryArtifactsManifest,
  IssueReportTriagePacketManifest,
  IssueReportWorkflowArtifactsManifest,
} from './issueReportSummaryTypes'

export interface LoadedIssueReportArtifactManifest {
  manifestPath: string
  manifest: IssueReportArtifactManifest
}

export interface LoadedIssueReportArtifactManifestBundle {
  rootManifestPath: string
  rootManifest: IssueReportArtifactManifest
  packetManifestPath: string | null
  packetManifest: IssueReportTriagePacketManifest | null
}

export interface IssueReportArtifactManifestRelationSummary {
  linkedPublishGateHotspotCount: number
  totalPublishGateHotspotCount: number
  packetSegmentCount: number | null
  packetReasonCount: number | null
  packetCsvCount: number | null
}

export interface IssueReportArtifactManifestSummary {
  manifestPath: string
  artifactType: IssueReportArtifactManifest['artifactType']
  schemaVersion: number
  totalCount: number
  filteredCount: number
  publishGateHotspotCount: number
  packetCount: number
  csvCount: number
  packetRootPath: string | null
  packetRootUrl: string | null
  packetBaseUrl: string | null
  packetArtifactUrl: string | null
  csvRootPath: string | null
  csvRootUrl: string | null
  csvBaseUrl: string | null
  csvArtifactUrl: string | null
  summaryRelativePath: string | null
  summaryUrl: string | null
  indexSummaryPath: string | null
  indexSummaryRelativePath: string | null
  indexSummaryUrl: string | null
  indexSummaryJsonPath: string | null
  indexSummaryJsonRelativePath: string | null
  indexSummaryJsonUrl: string | null
  indexSurfacePath: string | null
  indexSurfaceRelativePath: string | null
  indexSurfaceUrl: string | null
  artifactIndexPath: string | null
  artifactIndexRelativePath: string | null
  artifactIndexUrl: string | null
  indexSummaryJsonArtifactType: string | null
  indexSummaryJsonSchemaVersion: number | null
  indexSurfaceArtifactType: string | null
  indexSurfaceSchemaVersion: number | null
  packetSummaryPath: string | null
  packetSummaryRelativePath: string | null
  packetSummaryUrl: string | null
  packetManifestPath: string | null
  packetManifestRelativePath: string | null
  packetManifestUrl: string | null
  preferredCsvPath: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  linkedPublishGateHotspotCount: number | null
  totalPublishGateHotspotCount: number | null
  packetSegmentCount: number | null
  packetReasonCount: number | null
  packetCsvCount: number | null
}

interface IssueReportArtifactSummaryValidationResult {
  indexSummaryJsonArtifactType: string
  indexSummaryJsonSchemaVersion: number
  indexSurfaceArtifactType: string
  indexSurfaceSchemaVersion: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const assertRecord = (value: unknown, label: string) => {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

const assertString = (
  value: unknown,
  label: string,
): string => {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }
  return value
}

const assertNullableString = (value: unknown, label: string): string | null => {
  if (value === null) {
    return null
  }
  return assertString(value, label)
}

const assertNullableCompatAliasString = (
  value: unknown,
  label: string,
  canonicalLabel: string,
): string | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error(
      `${label} is a legacy compat alias for ${canonicalLabel} and must be a string or null`,
    )
  }
  return value
}

const assertNumber = (
  value: unknown,
  label: string,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }
  return value
}

const assertNullableNumber = (value: unknown, label: string): number | null => {
  if (value === null) {
    return null
  }
  return assertNumber(value, label)
}

const assertBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`)
  }
  return value
}

const assertStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`)
  }
  return value.map((entry, index) => assertString(entry, `${label}[${index}]`))
}

const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const pushRelationError = (errors: string[], message: string) => {
  errors.push(message)
}

const resolveManifestRootLinks = (
  manifest: IssueReportArtifactManifest,
) =>
  manifest.artifactType === 'issue-report-triage-packets'
    ? resolveIssueReportArtifactRootUrls({
        packetRootUrl: manifest.packetRootUrl,
        packetLegacyBaseUrl: manifest.packetBaseUrl,
        csvRootUrl: manifest.csvRootUrl,
        csvLegacyBaseUrl: manifest.csvBaseUrl,
      })
    : resolveIssueReportArtifactRootUrls({
        packetRootUrl: manifest.packetRootUrl,
        packetLegacyArtifactUrl: manifest.packetArtifactUrl,
        csvRootUrl: manifest.csvRootUrl,
        csvLegacyArtifactUrl: manifest.csvArtifactUrl,
      })

const resolveManifestPacketRootUrl = (
  manifest: IssueReportArtifactManifest,
): string | null => resolveManifestRootLinks(manifest).packetRootUrl

const resolveManifestCsvRootUrl = (
  manifest: IssueReportArtifactManifest,
): string | null => resolveManifestRootLinks(manifest).csvRootUrl

type IssueReportRootCompatHotspot =
  | IssueReportWorkflowArtifactsManifest['publishGateHotspots'][number]
  | IssueReportSummaryArtifactsManifest['publishGateHotspots'][number]

const resolveHotspotRootLinks = (
  hotspot: IssueReportRootCompatHotspot,
) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: hotspot.packetRootUrl,
    packetLegacyArtifactUrl: hotspot.packetArtifactUrl,
    csvRootUrl: hotspot.csvRootUrl,
    csvLegacyArtifactUrl: hotspot.csvArtifactUrl,
  })

const resolveHotspotPacketRootUrl = (
  hotspot: IssueReportRootCompatHotspot,
): string | null => resolveHotspotRootLinks(hotspot).packetRootUrl

const resolveHotspotCsvRootUrl = (
  hotspot: IssueReportRootCompatHotspot,
): string | null => resolveHotspotRootLinks(hotspot).csvRootUrl

const parseRootCompatHotspot = (
  value: unknown,
  label: string,
): IssueReportRootCompatHotspot => {
  const hotspot = assertRecord(value, label)
  const packetRootUrl = assertNullableString(
    hotspot.packetRootUrl ?? null,
    `${label}.packetRootUrl`,
  )
  const csvRootUrl = assertNullableString(
    hotspot.csvRootUrl ?? null,
    `${label}.csvRootUrl`,
  )
  const rootLinks = resolveHotspotRootLinks({
    districtId: assertString(hotspot.districtId, `${label}.districtId`),
    segmentLabel: assertNullableString(
      hotspot.segmentLabel ?? null,
      `${label}.segmentLabel`,
    ),
    packetPath: assertNullableString(hotspot.packetPath ?? null, `${label}.packetPath`),
    packetRootUrl,
    packetArtifactUrl: assertNullableCompatAliasString(
      hotspot.packetArtifactUrl ?? null,
      `${label}.packetArtifactUrl`,
      'packetRootUrl',
    ),
    csvRootUrl,
    csvArtifactUrl: assertNullableCompatAliasString(
      hotspot.csvArtifactUrl ?? null,
      `${label}.csvArtifactUrl`,
      'csvRootUrl',
    ),
  })

  return {
    districtId: assertString(hotspot.districtId, `${label}.districtId`),
    segmentLabel: assertNullableString(
      hotspot.segmentLabel ?? null,
      `${label}.segmentLabel`,
    ),
    packetPath: assertNullableString(hotspot.packetPath ?? null, `${label}.packetPath`),
    packetRootUrl: rootLinks.packetRootUrl,
    packetArtifactUrl: rootLinks.packetArtifactUrl,
    csvRootUrl: rootLinks.csvRootUrl,
    csvArtifactUrl: rootLinks.csvArtifactUrl,
  }
}

const compareStringSets = (
  expected: Iterable<string>,
  actual: Iterable<string>,
  label: string,
  errors: string[],
) => {
  const expectedSet = new Set(expected)
  const actualSet = new Set(actual)
  const missing = [...expectedSet].filter((entry) => !actualSet.has(entry))
  const extra = [...actualSet].filter((entry) => !expectedSet.has(entry))

  if (missing.length === 0 && extra.length === 0) {
    return
  }

  pushRelationError(
    errors,
    `${label} mismatch (missing ${missing.length}, extra ${extra.length})`,
  )
}

const isPathWithinRoot = (rootPath: string, targetPath: string) => {
  const rel = relative(rootPath, targetPath)
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

const assertSummaryFilters = (value: unknown, label: string) => {
  const record = assertRecord(value, label)
  return {
    scope: assertNullableString(record.scope ?? null, `${label}.scope`),
    districtId: assertNullableString(record.districtId ?? null, `${label}.districtId`),
    segmentId: assertNullableString(record.segmentId ?? null, `${label}.segmentId`),
    reasonCode: assertNullableString(record.reasonCode ?? null, `${label}.reasonCode`),
    since: assertNullableString(record.since ?? null, `${label}.since`),
  }
}

const assertNightlyPublishGateSummary = (value: unknown, label: string) => {
  if (value === null) {
    return null
  }
  const record = assertRecord(value, label)
  const totals = assertRecord(record.totals, `${label}.totals`)
  return {
    generatedAt: assertString(record.generatedAt, `${label}.generatedAt`),
    mode: assertString(record.mode, `${label}.mode`),
    exitCode: assertNumber(record.exitCode, `${label}.exitCode`),
    allowWarn: assertBoolean(record.allowWarn, `${label}.allowWarn`),
    allowFail: assertBoolean(record.allowFail, `${label}.allowFail`),
    overrideReason: assertNullableString(record.overrideReason ?? null, `${label}.overrideReason`),
    totals: {
      info: assertNumber(totals.info, `${label}.totals.info`),
      warn: assertNumber(totals.warn, `${label}.totals.warn`),
      fail: assertNumber(totals.fail, `${label}.totals.fail`),
    },
    topDistricts: Array.isArray(record.topDistricts)
      ? record.topDistricts.map((entry, index) => {
          const district = assertRecord(entry, `${label}.topDistricts[${index}]`)
          const breakdown =
            district.signOverrideBreakdown === null || district.signOverrideBreakdown === undefined
              ? null
              : assertRecord(
                  district.signOverrideBreakdown,
                  `${label}.topDistricts[${index}].signOverrideBreakdown`,
                )
          return {
            districtId: assertString(
              district.districtId,
              `${label}.topDistricts[${index}].districtId`,
            ),
            warn: assertNumber(district.warn, `${label}.topDistricts[${index}].warn`),
            fail: assertNumber(district.fail, `${label}.topDistricts[${index}].fail`),
            topWarnCodes: assertStringArray(
              district.topWarnCodes,
              `${label}.topDistricts[${index}].topWarnCodes`,
            ),
            topFailCodes: assertStringArray(
              district.topFailCodes,
              `${label}.topDistricts[${index}].topFailCodes`,
            ),
            signOverrideBreakdown:
              breakdown
                ? {
                    matchedBySegmentId: assertNumber(
                      breakdown.matchedBySegmentId,
                      `${label}.topDistricts[${index}].signOverrideBreakdown.matchedBySegmentId`,
                    ),
                    matchedBySpatial: assertNumber(
                      breakdown.matchedBySpatial,
                      `${label}.topDistricts[${index}].signOverrideBreakdown.matchedBySpatial`,
                    ),
                    unmatchedNamed: assertNumber(
                      breakdown.unmatchedNamed,
                      `${label}.topDistricts[${index}].signOverrideBreakdown.unmatchedNamed`,
                    ),
                  }
                : null,
          }
        })
      : [],
    summaryPath: assertNullableString(record.summaryPath ?? null, `${label}.summaryPath`),
    summaryUrl: assertNullableString(record.summaryUrl ?? null, `${label}.summaryUrl`),
  }
}

const assertPacketEntry = (
  value: unknown,
  label: string,
  expectedKind: 'segment' | 'reason',
) => {
  const record = assertRecord(value, label)
  return {
    rank: assertNumber(record.rank, `${label}.rank`),
    packetId: assertString(record.packetId, `${label}.packetId`),
    packetKind: assertString(record.packetKind, `${label}.packetKind`) === expectedKind
      ? expectedKind
      : (() => {
          throw new Error(`${label}.packetKind must be ${expectedKind}`)
        })(),
    label: assertString(record.label, `${label}.label`),
    relativePath: assertString(record.relativePath, `${label}.relativePath`),
    url: assertNullableString(record.url ?? null, `${label}.url`),
  }
}

const assertPacketCsvEntry = (value: unknown, label: string) => {
  const record = assertRecord(value, label)
  return {
    fileName: assertString(record.fileName, `${label}.fileName`),
    path: assertString(record.path, `${label}.path`),
    url: assertNullableString(record.url ?? null, `${label}.url`),
  }
}

const assertDistrictSummaryEntry = (value: unknown, label: string) => {
  const record = assertRecord(value, label)
  return {
    scope: assertString(record.scope, `${label}.scope`),
    districtId: assertString(record.districtId, `${label}.districtId`),
    count: assertNumber(record.count, `${label}.count`),
    latestCreatedAt: assertNullableString(
      record.latestCreatedAt ?? null,
      `${label}.latestCreatedAt`,
    ),
    latestSummary: assertNullableString(
      record.latestSummary ?? null,
      `${label}.latestSummary`,
    ),
  }
}

const parseIssueReportTriagePacketManifest = (
  record: Record<string, unknown>,
  label: string,
): IssueReportTriagePacketManifest => {
  const schemaVersion = assertNumber(record.schemaVersion, `${label}.schemaVersion`)
  if (schemaVersion !== ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `${label}.schemaVersion must be ${ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION}`,
    )
  }
  const packetRootPath = assertString(record.packetRootPath, `${label}.packetRootPath`)
  const summaryPath = assertString(record.summaryPath, `${label}.summaryPath`)
  const summaryRelativePath =
    assertNullableString(
      record.summaryRelativePath ?? null,
      `${label}.summaryRelativePath`,
    ) ?? toPortablePath(relative(packetRootPath, summaryPath))
  const packetRootUrl = assertNullableString(
    record.packetRootUrl ?? null,
    `${label}.packetRootUrl`,
  )
  const packetBaseUrl = assertNullableCompatAliasString(
    record.packetBaseUrl ?? null,
    `${label}.packetBaseUrl`,
    'packetRootUrl',
  )
  const csvRootUrl = assertNullableString(
    record.csvRootUrl ?? null,
    `${label}.csvRootUrl`,
  )
  const csvBaseUrl = assertNullableCompatAliasString(
    record.csvBaseUrl ?? null,
    `${label}.csvBaseUrl`,
    'csvRootUrl',
  )
  const rootLinks = resolveIssueReportArtifactRootUrls({
    packetRootUrl,
    packetLegacyBaseUrl: packetBaseUrl,
    csvRootUrl,
    csvLegacyBaseUrl: csvBaseUrl,
  })

  return {
    artifactType: 'issue-report-triage-packets',
    schemaVersion: ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION,
    generatedAt: assertString(record.generatedAt, `${label}.generatedAt`),
    storageFile: assertString(record.storageFile, `${label}.storageFile`),
    filters: assertSummaryFilters(record.filters, `${label}.filters`),
    totalCount: assertNumber(record.totalCount, `${label}.totalCount`),
    filteredCount: assertNumber(record.filteredCount, `${label}.filteredCount`),
    packetRootPath,
    packetRootUrl: rootLinks.packetRootUrl,
    packetBaseUrl: rootLinks.packetBaseUrl,
    csvRootPath: assertNullableString(record.csvRootPath ?? null, `${label}.csvRootPath`),
    csvRootUrl: rootLinks.csvRootUrl,
    csvBaseUrl: rootLinks.csvBaseUrl,
    summaryPath,
    summaryRelativePath,
    summaryUrl: assertNullableString(record.summaryUrl ?? null, `${label}.summaryUrl`),
    publishGateSummary: assertNightlyPublishGateSummary(
      record.publishGateSummary ?? null,
      `${label}.publishGateSummary`,
    ),
    publishGateHotspots: Array.isArray(record.publishGateHotspots)
      ? record.publishGateHotspots.map((entry, index) => {
          const hotspot = assertRecord(entry, `${label}.publishGateHotspots[${index}]`)
          return {
            districtId: assertString(
              hotspot.districtId,
              `${label}.publishGateHotspots[${index}].districtId`,
            ),
            warn: assertNumber(hotspot.warn, `${label}.publishGateHotspots[${index}].warn`),
            fail: assertNumber(hotspot.fail, `${label}.publishGateHotspots[${index}].fail`),
            topWarnCodes: assertStringArray(
              hotspot.topWarnCodes,
              `${label}.publishGateHotspots[${index}].topWarnCodes`,
            ),
            topFailCodes: assertStringArray(
              hotspot.topFailCodes,
              `${label}.publishGateHotspots[${index}].topFailCodes`,
            ),
            directOverrideMatches: assertNullableNumber(
              hotspot.directOverrideMatches,
              `${label}.publishGateHotspots[${index}].directOverrideMatches`,
            ),
            spatialOverrideMatches: assertNullableNumber(
              hotspot.spatialOverrideMatches,
              `${label}.publishGateHotspots[${index}].spatialOverrideMatches`,
            ),
            unmatchedNamedOverrides: assertNullableNumber(
              hotspot.unmatchedNamedOverrides,
              `${label}.publishGateHotspots[${index}].unmatchedNamedOverrides`,
            ),
            issueHotspotSegmentId: assertNullableString(
              hotspot.issueHotspotSegmentId ?? null,
              `${label}.publishGateHotspots[${index}].issueHotspotSegmentId`,
            ),
            issueHotspotSegmentName: assertNullableString(
              hotspot.issueHotspotSegmentName ?? null,
              `${label}.publishGateHotspots[${index}].issueHotspotSegmentName`,
            ),
            issueHotspotSegmentLabel: assertNullableString(
              hotspot.issueHotspotSegmentLabel ?? null,
              `${label}.publishGateHotspots[${index}].issueHotspotSegmentLabel`,
            ),
            issueHotspotPacketPath: assertNullableString(
              hotspot.issueHotspotPacketPath ?? null,
              `${label}.publishGateHotspots[${index}].issueHotspotPacketPath`,
            ),
            issueHotspotPacketUrl: assertNullableString(
              hotspot.issueHotspotPacketUrl ?? null,
              `${label}.publishGateHotspots[${index}].issueHotspotPacketUrl`,
            ),
          }
        })
      : [],
    segmentPackets: Array.isArray(record.segmentPackets)
      ? record.segmentPackets.map((entry, index) =>
          assertPacketEntry(
            entry,
            `${label}.segmentPackets[${index}]`,
            'segment',
          ),
        )
      : [],
    reasonPackets: Array.isArray(record.reasonPackets)
      ? record.reasonPackets.map((entry, index) =>
          assertPacketEntry(entry, `${label}.reasonPackets[${index}]`, 'reason'),
        )
      : [],
    csvExports: Array.isArray(record.csvExports)
      ? record.csvExports.map((entry, index) =>
          assertPacketCsvEntry(entry, `${label}.csvExports[${index}]`),
        )
      : [],
  }
}

const parseIssueReportWorkflowArtifactsManifest = (
  record: Record<string, unknown>,
  label: string,
): IssueReportWorkflowArtifactsManifest => {
  const schemaVersion = assertNumber(record.schemaVersion, `${label}.schemaVersion`)
  if (schemaVersion !== ISSUE_REPORT_WORKFLOW_ARTIFACT_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `${label}.schemaVersion must be ${ISSUE_REPORT_WORKFLOW_ARTIFACT_MANIFEST_SCHEMA_VERSION}`,
    )
  }
  const outRoot = assertString(record.outRoot, `${label}.outRoot`)
  const indexSummaryPath =
    assertNullableString(
      record.indexSummaryPath ?? null,
      `${label}.indexSummaryPath`,
    ) ?? join(outRoot, 'index-summary.md')
  const indexSummaryRelativePath =
    assertNullableString(
      record.indexSummaryRelativePath ?? null,
      `${label}.indexSummaryRelativePath`,
    ) ?? toPortablePath(relative(outRoot, indexSummaryPath))
  const indexSummaryJsonPath =
    assertNullableString(
      record.indexSummaryJsonPath ?? null,
      `${label}.indexSummaryJsonPath`,
    ) ?? join(outRoot, 'index-summary.json')
  const indexSummaryJsonRelativePath =
    assertNullableString(
      record.indexSummaryJsonRelativePath ?? null,
      `${label}.indexSummaryJsonRelativePath`,
    ) ?? toPortablePath(relative(outRoot, indexSummaryJsonPath))
  const indexSurfacePath =
    assertNullableString(
      record.indexSurfacePath ?? null,
      `${label}.indexSurfacePath`,
    ) ?? join(outRoot, 'index-surface.json')
  const indexSurfaceRelativePath =
    assertNullableString(
      record.indexSurfaceRelativePath ?? null,
      `${label}.indexSurfaceRelativePath`,
    ) ?? toPortablePath(relative(outRoot, indexSurfacePath))
  const artifactIndexPath =
    assertNullableString(
      record.artifactIndexPath ?? null,
      `${label}.artifactIndexPath`,
    ) ?? join(outRoot, 'artifact-index.json')
  const artifactIndexRelativePath =
    assertNullableString(
      record.artifactIndexRelativePath ?? null,
      `${label}.artifactIndexRelativePath`,
    ) ?? toPortablePath(relative(outRoot, artifactIndexPath))
  const artifactIndexUrl = assertNullableString(
    record.artifactIndexUrl ?? null,
    `${label}.artifactIndexUrl`,
  )
  const summaryPath = assertString(record.summaryPath, `${label}.summaryPath`)
  const summaryRelativePath =
    assertNullableString(
      record.summaryRelativePath ?? null,
      `${label}.summaryRelativePath`,
    ) ?? toPortablePath(relative(outRoot, summaryPath))
  const summaryUrl = assertNullableString(record.summaryUrl ?? null, `${label}.summaryUrl`)
  const indexSummaryUrl = assertNullableString(
    record.indexSummaryUrl ?? null,
    `${label}.indexSummaryUrl`,
  )
  const indexSummaryJsonUrl = assertNullableString(
    record.indexSummaryJsonUrl ?? null,
    `${label}.indexSummaryJsonUrl`,
  )
  const indexSurfaceUrl = assertNullableString(
    record.indexSurfaceUrl ?? null,
    `${label}.indexSurfaceUrl`,
  )
  const packetRootPath = assertString(record.packetRootPath, `${label}.packetRootPath`)
  const packetSummaryPath = assertString(record.packetSummaryPath, `${label}.packetSummaryPath`)
  const packetSummaryRelativePath =
    assertNullableString(
      record.packetSummaryRelativePath ?? null,
      `${label}.packetSummaryRelativePath`,
    ) ?? toPortablePath(relative(packetRootPath, packetSummaryPath))
  const packetRootUrl = assertNullableString(
    record.packetRootUrl ?? null,
    `${label}.packetRootUrl`,
  )
  const packetArtifactUrl = assertNullableCompatAliasString(
    record.packetArtifactUrl ?? null,
    `${label}.packetArtifactUrl`,
    'packetRootUrl',
  )
  const csvRootUrl = assertNullableString(
    record.csvRootUrl ?? null,
    `${label}.csvRootUrl`,
  )
  const csvArtifactUrl = assertNullableCompatAliasString(
    record.csvArtifactUrl ?? null,
    `${label}.csvArtifactUrl`,
    'csvRootUrl',
  )
  const rootLinks = resolveIssueReportArtifactRootUrls({
    packetRootUrl,
    packetLegacyArtifactUrl: packetArtifactUrl,
    csvRootUrl,
    csvLegacyArtifactUrl: csvArtifactUrl,
  })
  const packetManifestPath = assertString(record.packetManifestPath, `${label}.packetManifestPath`)
  const packetManifestRelativePath =
    assertNullableString(
      record.packetManifestRelativePath ?? null,
      `${label}.packetManifestRelativePath`,
    ) ?? toPortablePath(relative(packetRootPath, packetManifestPath))
  const bundleUrls = resolveIssueReportArtifactBundleUrls({
    packetRootUrl: rootLinks.packetRootUrl,
    csvRootUrl: rootLinks.csvRootUrl,
    preferredCsvUrl: null,
    preferredCsvRelativePath: null,
    packetSummaryUrl: assertNullableString(
      record.packetSummaryUrl ?? null,
      `${label}.packetSummaryUrl`,
    ),
    packetSummaryRelativePath,
    packetManifestUrl: assertNullableString(
      record.packetManifestUrl ?? null,
      `${label}.packetManifestUrl`,
    ),
    packetManifestRelativePath,
  })
  const packetSummaryUrl = bundleUrls.packetSummaryUrl
  const packetManifestUrl = bundleUrls.packetManifestUrl

  return {
    artifactType: 'issue-report-workflow-artifacts',
    schemaVersion: ISSUE_REPORT_WORKFLOW_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    generatedAt: assertString(record.generatedAt, `${label}.generatedAt`),
    outRoot,
    publishGateSummary: assertNightlyPublishGateSummary(
      record.publishGateSummary ?? null,
      `${label}.publishGateSummary`,
    ),
    publishGateHotspots: Array.isArray(record.publishGateHotspots)
      ? record.publishGateHotspots.map((entry, index) =>
          parseRootCompatHotspot(entry, `${label}.publishGateHotspots[${index}]`),
        )
      : [],
    topDistricts: Array.isArray(record.topDistricts)
      ? record.topDistricts.map((entry, index) =>
          assertDistrictSummaryEntry(entry, `${label}.topDistricts[${index}]`),
        )
      : [],
    packetRootUrl: rootLinks.packetRootUrl,
    packetArtifactUrl: rootLinks.packetArtifactUrl,
    csvRootUrl: rootLinks.csvRootUrl,
    csvArtifactUrl: rootLinks.csvArtifactUrl,
    packetRootPath,
    packetSummaryPath,
    packetSummaryRelativePath,
    packetSummaryUrl,
    packetManifestPath,
    packetManifestRelativePath,
    packetManifestUrl,
    csvRootPath: assertString(record.csvRootPath, `${label}.csvRootPath`),
    preferredCsvPath: assertNullableString(
      record.preferredCsvPath ?? null,
      `${label}.preferredCsvPath`,
    ),
    preferredCsvRelativePath: assertNullableString(
      record.preferredCsvRelativePath ?? null,
      `${label}.preferredCsvRelativePath`,
    ),
    preferredCsvUrl: assertNullableString(
      record.preferredCsvUrl ?? null,
      `${label}.preferredCsvUrl`,
    ),
    summaryPath,
    summaryRelativePath,
    summaryUrl,
    indexSummaryPath,
    indexSummaryRelativePath,
    indexSummaryUrl,
    indexSummaryJsonPath,
    indexSummaryJsonRelativePath,
    indexSummaryJsonUrl,
    indexSurfacePath,
    indexSurfaceRelativePath,
    indexSurfaceUrl,
    artifactIndexPath,
    artifactIndexRelativePath,
    artifactIndexUrl,
    manifestPath: assertString(record.manifestPath, `${label}.manifestPath`),
    packetPaths: assertStringArray(record.packetPaths, `${label}.packetPaths`),
    csvPaths: assertStringArray(record.csvPaths, `${label}.csvPaths`),
    storageFile: assertString(record.storageFile, `${label}.storageFile`),
    totalCount: assertNumber(record.totalCount, `${label}.totalCount`),
    filteredCount: assertNumber(record.filteredCount, `${label}.filteredCount`),
  }
}

const parseIssueReportSummaryArtifactsManifest = (
  record: Record<string, unknown>,
  label: string,
): IssueReportSummaryArtifactsManifest => {
  const schemaVersion = assertNumber(record.schemaVersion, `${label}.schemaVersion`)
  if (schemaVersion !== ISSUE_REPORT_SUMMARY_ARTIFACTS_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `${label}.schemaVersion must be ${ISSUE_REPORT_SUMMARY_ARTIFACTS_MANIFEST_SCHEMA_VERSION}`,
    )
  }
  const outRoot = assertString(record.outRoot, `${label}.outRoot`)
  const summaryPath = assertString(record.summaryPath, `${label}.summaryPath`)
  const summaryRelativePath =
    assertNullableString(
      record.summaryRelativePath ?? null,
      `${label}.summaryRelativePath`,
    ) ?? toPortablePath(relative(outRoot, summaryPath))
  const summaryUrl = assertNullableString(record.summaryUrl ?? null, `${label}.summaryUrl`)
  const indexSummaryPath =
    assertNullableString(
      record.indexSummaryPath ?? null,
      `${label}.indexSummaryPath`,
    ) ?? summaryPath
  const indexSummaryRelativePath =
    assertNullableString(
      record.indexSummaryRelativePath ?? null,
      `${label}.indexSummaryRelativePath`,
    ) ?? summaryRelativePath
  const indexSummaryUrl = assertNullableString(
    record.indexSummaryUrl ?? null,
    `${label}.indexSummaryUrl`,
  ) ?? summaryUrl
  const indexSummaryJsonPath = assertString(
    record.indexSummaryJsonPath,
    `${label}.indexSummaryJsonPath`,
  )
  const indexSummaryJsonRelativePath =
    assertNullableString(
      record.indexSummaryJsonRelativePath ?? null,
      `${label}.indexSummaryJsonRelativePath`,
    ) ?? toPortablePath(relative(outRoot, indexSummaryJsonPath))
  const indexSurfacePath = assertString(record.indexSurfacePath, `${label}.indexSurfacePath`)
  const indexSurfaceRelativePath =
    assertNullableString(
      record.indexSurfaceRelativePath ?? null,
      `${label}.indexSurfaceRelativePath`,
    ) ?? toPortablePath(relative(outRoot, indexSurfacePath))
  const artifactIndexPath = assertString(record.artifactIndexPath, `${label}.artifactIndexPath`)
  const artifactIndexRelativePath =
    assertNullableString(
      record.artifactIndexRelativePath ?? null,
      `${label}.artifactIndexRelativePath`,
    ) ?? toPortablePath(relative(outRoot, artifactIndexPath))
  const packetRootUrl = assertNullableString(
    record.packetRootUrl ?? null,
    `${label}.packetRootUrl`,
  )
  const packetArtifactUrl = assertNullableCompatAliasString(
    record.packetArtifactUrl ?? null,
    `${label}.packetArtifactUrl`,
    'packetRootUrl',
  )
  const packetRootPath = assertNullableString(record.packetRootPath ?? null, `${label}.packetRootPath`)
  const packetSummaryPath = assertNullableString(
    record.packetSummaryPath ?? null,
    `${label}.packetSummaryPath`,
  )
  const packetSummaryRelativePath =
    assertNullableString(
      record.packetSummaryRelativePath ?? null,
      `${label}.packetSummaryRelativePath`,
    ) ?? (
      packetRootPath && packetSummaryPath
        ? toPortablePath(relative(packetRootPath, packetSummaryPath))
        : null
    )
  const packetManifestPath = assertNullableString(
    record.packetManifestPath ?? null,
    `${label}.packetManifestPath`,
  )
  const packetManifestRelativePath =
    assertNullableString(
      record.packetManifestRelativePath ?? null,
      `${label}.packetManifestRelativePath`,
    ) ?? (
      packetRootPath && packetManifestPath
        ? toPortablePath(relative(packetRootPath, packetManifestPath))
        : null
    )
  const csvRootUrl = assertNullableString(
    record.csvRootUrl ?? null,
    `${label}.csvRootUrl`,
  )
  const csvArtifactUrl = assertNullableCompatAliasString(
    record.csvArtifactUrl ?? null,
    `${label}.csvArtifactUrl`,
    'csvRootUrl',
  )
  const rootLinks = resolveIssueReportArtifactRootUrls({
    packetRootUrl,
    packetLegacyArtifactUrl: packetArtifactUrl,
    csvRootUrl,
    csvLegacyArtifactUrl: csvArtifactUrl,
  })
  const bundleUrls = resolveIssueReportArtifactBundleUrls({
    packetRootUrl: rootLinks.packetRootUrl,
    csvRootUrl: rootLinks.csvRootUrl,
    preferredCsvUrl: assertNullableString(
      record.preferredCsvUrl ?? null,
      `${label}.preferredCsvUrl`,
    ),
    preferredCsvRelativePath: assertNullableString(
      record.preferredCsvRelativePath ?? null,
      `${label}.preferredCsvRelativePath`,
    ),
    packetSummaryUrl: assertNullableString(
      record.packetSummaryUrl ?? null,
      `${label}.packetSummaryUrl`,
    ),
    packetSummaryRelativePath,
    packetManifestUrl: assertNullableString(
      record.packetManifestUrl ?? null,
      `${label}.packetManifestUrl`,
    ),
    packetManifestRelativePath,
  })
  return {
    artifactType: 'issue-report-summary-artifacts',
    schemaVersion: ISSUE_REPORT_SUMMARY_ARTIFACTS_MANIFEST_SCHEMA_VERSION,
    generatedAt: assertString(record.generatedAt, `${label}.generatedAt`),
    outRoot,
    sourceSummaryPath: assertString(record.sourceSummaryPath, `${label}.sourceSummaryPath`),
    sourceSummaryRelativePath: assertNullableString(
      record.sourceSummaryRelativePath ?? null,
      `${label}.sourceSummaryRelativePath`,
    ),
    sourceSummaryUrl: assertNullableString(
      record.sourceSummaryUrl ?? null,
      `${label}.sourceSummaryUrl`,
    ),
    sourceSummaryArtifactType: assertString(
      record.sourceSummaryArtifactType,
      `${label}.sourceSummaryArtifactType`,
    ) as IssueReportSummaryArtifactsManifest['sourceSummaryArtifactType'],
    sourceSummarySchemaVersion: assertNumber(
      record.sourceSummarySchemaVersion,
      `${label}.sourceSummarySchemaVersion`,
    ) as IssueReportSummaryArtifactsManifest['sourceSummarySchemaVersion'],
    publishGateSummary: assertNightlyPublishGateSummary(
      record.publishGateSummary ?? null,
      `${label}.publishGateSummary`,
    ),
    publishGateHotspots: Array.isArray(record.publishGateHotspots)
      ? record.publishGateHotspots.map((entry, index) =>
          parseRootCompatHotspot(entry, `${label}.publishGateHotspots[${index}]`),
        )
      : [],
    topDistricts: Array.isArray(record.topDistricts)
      ? record.topDistricts.map((entry, index) =>
          assertDistrictSummaryEntry(entry, `${label}.topDistricts[${index}]`),
        )
      : [],
    packetRootUrl: rootLinks.packetRootUrl,
    packetArtifactUrl: rootLinks.packetArtifactUrl,
    csvRootUrl: rootLinks.csvRootUrl,
    csvArtifactUrl: rootLinks.csvArtifactUrl,
    packetRootPath,
    packetSummaryPath,
    packetSummaryRelativePath,
    packetSummaryUrl: bundleUrls.packetSummaryUrl,
    packetManifestPath,
    packetManifestRelativePath,
    packetManifestUrl: bundleUrls.packetManifestUrl,
    csvRootPath: assertNullableString(record.csvRootPath ?? null, `${label}.csvRootPath`),
    preferredCsvPath: assertNullableString(
      record.preferredCsvPath ?? null,
      `${label}.preferredCsvPath`,
    ),
    preferredCsvRelativePath: assertNullableString(
      record.preferredCsvRelativePath ?? null,
      `${label}.preferredCsvRelativePath`,
    ),
    preferredCsvUrl: bundleUrls.preferredCsvUrl,
    summaryPath,
    summaryRelativePath,
    summaryUrl,
    indexSummaryPath,
    indexSummaryRelativePath,
    indexSummaryUrl,
    indexSummaryJsonPath,
    indexSummaryJsonRelativePath,
    indexSummaryJsonUrl: assertNullableString(
      record.indexSummaryJsonUrl ?? null,
      `${label}.indexSummaryJsonUrl`,
    ),
    indexSurfacePath,
    indexSurfaceRelativePath,
    indexSurfaceUrl: assertNullableString(
      record.indexSurfaceUrl ?? null,
      `${label}.indexSurfaceUrl`,
    ),
    artifactIndexPath,
    artifactIndexRelativePath,
    artifactIndexUrl: assertNullableString(
      record.artifactIndexUrl ?? null,
      `${label}.artifactIndexUrl`,
    ),
    manifestPath: assertString(record.manifestPath, `${label}.manifestPath`),
    packetPaths: assertStringArray(record.packetPaths ?? [], `${label}.packetPaths`),
    csvPaths: assertStringArray(record.csvPaths ?? [], `${label}.csvPaths`),
    storageFile: assertString(record.storageFile, `${label}.storageFile`),
    totalCount: assertNumber(record.totalCount, `${label}.totalCount`),
    filteredCount: assertNumber(record.filteredCount, `${label}.filteredCount`),
  }
}

export const parseIssueReportArtifactManifest = (
  value: unknown,
  label = 'manifest',
): IssueReportArtifactManifest => {
  const record = assertRecord(value, label)
  const artifactType = assertString(record.artifactType, `${label}.artifactType`)

  if (artifactType === 'issue-report-triage-packets') {
    return parseIssueReportTriagePacketManifest(record, label)
  }

  if (artifactType === 'issue-report-workflow-artifacts') {
    return parseIssueReportWorkflowArtifactsManifest(record, label)
  }

  if (artifactType === 'issue-report-summary-artifacts') {
    return parseIssueReportSummaryArtifactsManifest(record, label)
  }

  throw new Error(`${label}.artifactType must be a supported issue-report artifact type`)
}

export const getIssueReportArtifactManifestKind = (
  manifest: IssueReportArtifactManifest,
): 'workflow' | 'manual' | 'packet' =>
  manifest.artifactType === 'issue-report-workflow-artifacts'
    ? 'workflow'
    : manifest.artifactType === 'issue-report-summary-artifacts'
      ? 'manual'
      : 'packet'

export function assertIssueReportArtifactManifestKind(
  manifest: IssueReportArtifactManifest,
  expectedKind: 'workflow',
): IssueReportWorkflowArtifactsManifest
export function assertIssueReportArtifactManifestKind(
  manifest: IssueReportArtifactManifest,
  expectedKind: 'manual',
): IssueReportSummaryArtifactsManifest
export function assertIssueReportArtifactManifestKind(
  manifest: IssueReportArtifactManifest,
  expectedKind: 'packet',
): IssueReportTriagePacketManifest
export function assertIssueReportArtifactManifestKind(
  manifest: IssueReportArtifactManifest,
  expectedKind: 'any',
): IssueReportArtifactManifest
export const assertIssueReportArtifactManifestKind = (
  manifest: IssueReportArtifactManifest,
  expectedKind: 'any' | 'workflow' | 'manual' | 'packet',
) => {
  if (expectedKind === 'any') {
    return manifest
  }
  const actualKind = getIssueReportArtifactManifestKind(manifest)
  if (actualKind !== expectedKind) {
    throw new Error(`manifest kind mismatch: expected ${expectedKind}, received ${actualKind}`)
  }
  return manifest
}

export const buildIssueReportArtifactManifestSummary = (
  manifestPath: string,
  manifest: IssueReportArtifactManifest,
  relations: IssueReportArtifactManifestRelationSummary | null = null,
  summaryValidation: IssueReportArtifactSummaryValidationResult | null = null,
): IssueReportArtifactManifestSummary => {
  const packetRootPath = manifest.packetRootPath
  const csvRootPath = manifest.csvRootPath
  const rootLinks = resolveManifestRootLinks(manifest)
  const packetRootUrl = rootLinks.packetRootUrl
  const csvRootUrl = rootLinks.csvRootUrl
  const isRootCompatManifest =
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
  const bundleUrls = isRootCompatManifest
    ? resolveIssueReportArtifactBundleUrls({
        packetRootUrl,
        csvRootUrl,
        preferredCsvUrl: manifest.preferredCsvUrl,
        preferredCsvRelativePath: manifest.preferredCsvRelativePath,
        packetSummaryUrl: manifest.packetSummaryUrl,
        packetSummaryRelativePath: manifest.packetSummaryRelativePath,
        packetManifestUrl: manifest.packetManifestUrl,
        packetManifestRelativePath: manifest.packetManifestRelativePath,
      })
    : {
        preferredCsvUrl: null,
        packetSummaryUrl: null,
        packetManifestUrl: null,
      }

  return {
    manifestPath,
    artifactType: manifest.artifactType,
    schemaVersion: manifest.schemaVersion,
    totalCount: manifest.totalCount,
    filteredCount: manifest.filteredCount,
    publishGateHotspotCount: manifest.publishGateHotspots.length,
    packetCount:
      manifest.artifactType === 'issue-report-triage-packets'
        ? manifest.segmentPackets.length + manifest.reasonPackets.length
        : manifest.packetPaths.length,
    csvCount:
      manifest.artifactType === 'issue-report-triage-packets'
        ? manifest.csvExports.length
        : manifest.csvPaths.length,
    packetRootPath,
    packetRootUrl,
    packetBaseUrl: rootLinks.packetBaseUrl,
    packetArtifactUrl: rootLinks.packetArtifactUrl,
    csvRootPath,
    csvRootUrl,
    csvBaseUrl: rootLinks.csvBaseUrl,
    csvArtifactUrl: rootLinks.csvArtifactUrl,
    summaryRelativePath: manifest.summaryRelativePath,
    summaryUrl: manifest.summaryUrl,
  indexSummaryPath:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSummaryPath
      : null,
  indexSummaryRelativePath:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSummaryRelativePath
      : null,
  indexSummaryUrl:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSummaryUrl
      : null,
  indexSummaryJsonPath:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSummaryJsonPath
      : null,
  indexSummaryJsonRelativePath:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSummaryJsonRelativePath
      : null,
  indexSummaryJsonUrl:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSummaryJsonUrl
      : null,
  indexSurfacePath:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSurfacePath
      : null,
  indexSurfaceRelativePath:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSurfaceRelativePath
      : null,
  indexSurfaceUrl:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.indexSurfaceUrl
      : null,
  artifactIndexPath:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.artifactIndexPath
      : null,
  artifactIndexRelativePath:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.artifactIndexRelativePath
      : null,
  artifactIndexUrl:
    manifest.artifactType === 'issue-report-workflow-artifacts'
    || manifest.artifactType === 'issue-report-summary-artifacts'
      ? manifest.artifactIndexUrl
      : null,
  indexSummaryJsonArtifactType: summaryValidation?.indexSummaryJsonArtifactType ?? null,
  indexSummaryJsonSchemaVersion: summaryValidation?.indexSummaryJsonSchemaVersion ?? null,
  indexSurfaceArtifactType: summaryValidation?.indexSurfaceArtifactType ?? null,
  indexSurfaceSchemaVersion: summaryValidation?.indexSurfaceSchemaVersion ?? null,
  packetSummaryPath:
    isRootCompatManifest
      ? manifest.packetSummaryPath
      : null,
  packetSummaryRelativePath:
    isRootCompatManifest
        ? manifest.packetSummaryRelativePath
        : null,
  packetSummaryUrl:
    isRootCompatManifest
        ? bundleUrls.packetSummaryUrl
        : null,
  packetManifestPath:
    isRootCompatManifest
      ? manifest.packetManifestPath
      : null,
  packetManifestRelativePath:
    isRootCompatManifest
        ? manifest.packetManifestRelativePath
        : null,
  packetManifestUrl:
    isRootCompatManifest
        ? bundleUrls.packetManifestUrl
        : null,
  preferredCsvPath:
    isRootCompatManifest
      ? manifest.preferredCsvPath
      : null,
  preferredCsvRelativePath:
    isRootCompatManifest
      ? manifest.preferredCsvRelativePath
      : null,
  preferredCsvUrl:
    isRootCompatManifest
      ? bundleUrls.preferredCsvUrl
      : null,
  linkedPublishGateHotspotCount: relations?.linkedPublishGateHotspotCount ?? null,
  totalPublishGateHotspotCount: relations?.totalPublishGateHotspotCount ?? null,
  packetSegmentCount: relations?.packetSegmentCount ?? null,
  packetReasonCount: relations?.packetReasonCount ?? null,
  packetCsvCount: relations?.packetCsvCount ?? null,
  }
}

export const renderIssueReportArtifactManifestSummary = (
  summary: IssueReportArtifactManifestSummary,
) =>
  [
    `Valid ${summary.artifactType} v${summary.schemaVersion}`,
    `Manifest: ${summary.manifestPath}`,
    `Matching issue reports: ${summary.filteredCount} / ${summary.totalCount}`,
    `Publish gate hotspots: ${summary.publishGateHotspotCount}`,
    `Packet entries: ${summary.packetCount}`,
    `CSV entries: ${summary.csvCount}`,
    ...(summary.packetRootPath
      ? [`Packet root: ${summary.packetRootPath}`]
      : []),
    ...(summary.packetRootUrl
      ? [`Packet root URL: ${summary.packetRootUrl}`]
      : []),
    ...(summary.packetBaseUrl
      ? [`Legacy packet base URL: ${summary.packetBaseUrl}`]
      : []),
    ...(summary.packetArtifactUrl
      ? [`Legacy packet artifact URL: ${summary.packetArtifactUrl}`]
      : []),
    ...(summary.csvRootPath
      ? [`CSV root: ${summary.csvRootPath}`]
      : []),
    ...(summary.csvRootUrl
      ? [`CSV root URL: ${summary.csvRootUrl}`]
      : []),
    ...(summary.csvBaseUrl
      ? [`Legacy CSV base URL: ${summary.csvBaseUrl}`]
      : []),
    ...(summary.csvArtifactUrl
      ? [`Legacy CSV artifact URL: ${summary.csvArtifactUrl}`]
      : []),
    ...(summary.summaryRelativePath
      ? [`Summary entry: ${summary.summaryRelativePath}`]
      : []),
    ...(summary.summaryUrl
      ? [`Summary URL: ${summary.summaryUrl}`]
      : []),
    ...(summary.totalPublishGateHotspotCount !== null
      ? [
          `Linked publish gate hotspots: ${summary.linkedPublishGateHotspotCount} / ${summary.totalPublishGateHotspotCount}`,
        ]
      : []),
    ...(summary.packetSegmentCount !== null
      ? [
          `Nested packet entries: ${summary.packetSegmentCount} segments / ${summary.packetReasonCount} reasons`,
        ]
      : []),
    ...(summary.packetCsvCount !== null
      ? [`Nested packet CSV exports: ${summary.packetCsvCount}`]
      : []),
    ...(summary.packetSummaryPath
      ? [`Nested packet summary: ${summary.packetSummaryPath}`]
      : []),
    ...(summary.packetSummaryRelativePath
      ? [`Nested packet summary entry: ${summary.packetSummaryRelativePath}`]
      : []),
    ...(summary.packetSummaryUrl
      ? [`Nested packet summary URL: ${summary.packetSummaryUrl}`]
      : []),
    ...(summary.packetManifestPath
      ? [`Nested packet manifest: ${summary.packetManifestPath}`]
      : []),
    ...(summary.packetManifestRelativePath
      ? [`Nested packet manifest entry: ${summary.packetManifestRelativePath}`]
      : []),
    ...(summary.packetManifestUrl
      ? [`Nested packet manifest URL: ${summary.packetManifestUrl}`]
      : []),
    ...(summary.preferredCsvPath
      ? [`Preferred CSV join file: ${summary.preferredCsvPath}`]
      : []),
    ...(summary.preferredCsvRelativePath
      ? [`Preferred CSV join entry: ${summary.preferredCsvRelativePath}`]
      : []),
    ...(summary.preferredCsvUrl
      ? [`Preferred CSV join URL: ${summary.preferredCsvUrl}`]
      : []),
    ...(summary.indexSummaryPath
      ? [`Index summary: ${summary.indexSummaryPath}`]
      : []),
    ...(summary.indexSummaryRelativePath
      ? [`Index summary entry: ${summary.indexSummaryRelativePath}`]
      : []),
    ...(summary.indexSummaryUrl
      ? [`Index summary URL: ${summary.indexSummaryUrl}`]
      : []),
    ...(summary.indexSummaryJsonPath
      ? [`Index summary json: ${summary.indexSummaryJsonPath}`]
      : []),
    ...(summary.indexSummaryJsonRelativePath
      ? [`Index summary json entry: ${summary.indexSummaryJsonRelativePath}`]
      : []),
    ...(summary.indexSummaryJsonUrl
      ? [`Index summary json URL: ${summary.indexSummaryJsonUrl}`]
      : []),
    ...(summary.indexSurfacePath
      ? [`Index surface: ${summary.indexSurfacePath}`]
      : []),
    ...(summary.indexSurfaceRelativePath
      ? [`Index surface entry: ${summary.indexSurfaceRelativePath}`]
      : []),
    ...(summary.indexSurfaceUrl
      ? [`Index surface URL: ${summary.indexSurfaceUrl}`]
      : []),
    ...(summary.artifactIndexPath
      ? [`Artifact index: ${summary.artifactIndexPath}`]
      : []),
    ...(summary.artifactIndexRelativePath
      ? [`Artifact index entry: ${summary.artifactIndexRelativePath}`]
      : []),
    ...(summary.artifactIndexUrl
      ? [`Artifact index URL: ${summary.artifactIndexUrl}`]
      : []),
    ...(summary.indexSummaryJsonArtifactType
      ? [
          `Index summary json schema: ${summary.indexSummaryJsonArtifactType} v${summary.indexSummaryJsonSchemaVersion}`,
        ]
      : []),
    ...(summary.indexSurfaceArtifactType
      ? [
          `Index surface schema: ${summary.indexSurfaceArtifactType} v${summary.indexSurfaceSchemaVersion}`,
        ]
      : []),
  ].join('\n')

export const loadIssueReportArtifactManifest = async (
  manifestPath: string,
  cwd = process.cwd(),
): Promise<LoadedIssueReportArtifactManifest> => {
  const resolvedPath = resolve(cwd, manifestPath)
  const raw = await readFile(resolvedPath, 'utf8')
  return {
    manifestPath: resolvedPath,
    manifest: parseIssueReportArtifactManifest(JSON.parse(raw), resolvedPath),
  }
}

export const loadIssueReportArtifactManifestBundle = async (
  manifestPath: string,
  cwd = process.cwd(),
): Promise<LoadedIssueReportArtifactManifestBundle> => {
  const root = await loadIssueReportArtifactManifest(manifestPath, cwd)
  const rootManifest = root.manifest

  if (
    rootManifest.artifactType !== 'issue-report-workflow-artifacts'
    && rootManifest.artifactType !== 'issue-report-summary-artifacts'
  ) {
    return {
      rootManifestPath: root.manifestPath,
      rootManifest,
      packetManifestPath: null,
      packetManifest: null,
    }
  }

  if (!rootManifest.packetManifestPath) {
    return {
      rootManifestPath: root.manifestPath,
      rootManifest,
      packetManifestPath: null,
      packetManifest: null,
    }
  }

  const packet = await loadIssueReportArtifactManifest(rootManifest.packetManifestPath, cwd)
  const packetManifest = assertIssueReportArtifactManifestKind(packet.manifest, 'packet')

  return {
    rootManifestPath: root.manifestPath,
    rootManifest,
    packetManifestPath: packet.manifestPath,
    packetManifest,
  }
}

export const validateIssueReportArtifactSummaryFiles = async (
  manifest: IssueReportWorkflowArtifactsManifest | IssueReportSummaryArtifactsManifest,
): Promise<IssueReportArtifactSummaryValidationResult> => {
  const summaryJson = parseIssueReportArtifactSummaryJsonOutput(
    JSON.parse(await readFile(manifest.indexSummaryJsonPath, 'utf8')),
  )
  const expectedSurface = buildIssueReportArtifactSummaryJsonSurfaceSummary({
    summaryPath: manifest.indexSummaryJsonPath,
    summary: summaryJson,
  })
  const actualSurface = parseIssueReportArtifactSummarySurfaceSummary(
    JSON.parse(await readFile(manifest.indexSurfacePath, 'utf8')),
  )

  if (JSON.stringify(actualSurface) !== JSON.stringify(expectedSurface)) {
    throw new Error(
      'issue report artifact summary validation failed:\n- indexSurfacePath does not match the validated compact surface derived from indexSummaryJsonPath',
    )
  }

  return {
    indexSummaryJsonArtifactType: summaryJson.artifactType,
    indexSummaryJsonSchemaVersion: summaryJson.schemaVersion,
    indexSurfaceArtifactType: actualSurface.artifactType,
    indexSurfaceSchemaVersion: actualSurface.schemaVersion,
  }
}

type RootIssueReportArtifactManifest =
  | IssueReportWorkflowArtifactsManifest
  | IssueReportSummaryArtifactsManifest

const isRootIssueReportArtifactManifest = (
  manifest: IssueReportArtifactManifest,
): manifest is RootIssueReportArtifactManifest =>
  manifest.artifactType === 'issue-report-workflow-artifacts'
  || manifest.artifactType === 'issue-report-summary-artifacts'

export const validateIssueReportArtifactManifestRelations = (
  bundle: LoadedIssueReportArtifactManifestBundle,
): IssueReportArtifactManifestRelationSummary => {
  const { rootManifest } = bundle

  if (rootManifest.artifactType === 'issue-report-triage-packets') {
    if (!isPathWithinRoot(rootManifest.packetRootPath, rootManifest.summaryPath)) {
      throw new Error('issue report artifact relation validation failed:\n- packet summaryPath must stay within packetRootPath')
    }
    if (
      resolve(rootManifest.packetRootPath, rootManifest.summaryRelativePath)
      !== rootManifest.summaryPath
    ) {
      throw new Error('issue report artifact relation validation failed:\n- packet summaryRelativePath must resolve to packet summaryPath')
    }
    if (rootManifest.summaryPath === bundle.rootManifestPath) {
      throw new Error('issue report artifact relation validation failed:\n- packet summaryPath must not equal packet manifestPath')
    }
    const linkedPublishGateHotspotCount = rootManifest.publishGateHotspots.filter(
      (entry) => entry.issueHotspotPacketPath !== null,
    ).length
    return {
      linkedPublishGateHotspotCount,
      totalPublishGateHotspotCount: rootManifest.publishGateHotspots.length,
      packetSegmentCount: rootManifest.segmentPackets.length,
      packetReasonCount: rootManifest.reasonPackets.length,
      packetCsvCount: rootManifest.csvExports.length,
    }
  }

  if (!isRootIssueReportArtifactManifest(rootManifest)) {
    throw new Error('issue report artifact relation validation failed:\n- unsupported root artifact manifest kind')
  }

  const packetManifest = bundle.packetManifest
  const errors: string[] = []
  const rootLabel =
    rootManifest.artifactType === 'issue-report-workflow-artifacts'
      ? 'workflow'
      : 'manual'
  const rootPacketRootPath = rootManifest.packetRootPath
  const rootPacketSummaryPath = rootManifest.packetSummaryPath
  const rootPacketManifestPath = rootManifest.packetManifestPath
  const rootPacketRootUrl = resolveManifestPacketRootUrl(rootManifest)
  const rootCsvRootUrl = resolveManifestCsvRootUrl(rootManifest)
  const rootPacketSummaryRelativePath = rootManifest.packetSummaryRelativePath
  const rootPacketManifestRelativePath = rootManifest.packetManifestRelativePath
  const rootPacketSummaryUrl = rootManifest.packetSummaryUrl
  const rootPacketManifestUrl = rootManifest.packetManifestUrl
  const rootBundleUrls = resolveIssueReportArtifactBundleUrls({
    packetRootUrl: rootPacketRootUrl,
    csvRootUrl: rootCsvRootUrl,
    preferredCsvUrl: null,
    preferredCsvRelativePath: rootManifest.preferredCsvRelativePath,
    packetSummaryUrl: null,
    packetSummaryRelativePath: rootPacketSummaryRelativePath,
    packetManifestUrl: null,
    packetManifestRelativePath: rootPacketManifestRelativePath,
  })

  if (!isPathWithinRoot(rootManifest.outRoot, rootManifest.summaryPath)) {
    pushRelationError(errors, `${rootLabel} summaryPath must stay within ${rootLabel} outRoot`)
  }
  if (!isPathWithinRoot(rootManifest.outRoot, rootManifest.indexSummaryJsonPath)) {
    pushRelationError(errors, `${rootLabel} indexSummaryJsonPath must stay within ${rootLabel} outRoot`)
  }
  if (!isPathWithinRoot(rootManifest.outRoot, rootManifest.indexSurfacePath)) {
    pushRelationError(errors, `${rootLabel} indexSurfacePath must stay within ${rootLabel} outRoot`)
  }
  if (!isPathWithinRoot(rootManifest.outRoot, rootManifest.artifactIndexPath)) {
    pushRelationError(errors, `${rootLabel} artifactIndexPath must stay within ${rootLabel} outRoot`)
  }
  if (!isPathWithinRoot(rootManifest.outRoot, rootManifest.indexSummaryPath)) {
    pushRelationError(errors, `${rootLabel} indexSummaryPath must stay within ${rootLabel} outRoot`)
  }
  if (rootManifest.preferredCsvPath !== null && rootManifest.csvRootPath === null) {
    pushRelationError(errors, `${rootLabel} preferredCsvPath requires ${rootLabel} csvRootPath`)
  }
  if (rootManifest.preferredCsvRelativePath !== null && rootManifest.csvRootPath === null) {
    pushRelationError(errors, `${rootLabel} preferredCsvRelativePath requires ${rootLabel} csvRootPath`)
  }
  if (
    rootManifest.preferredCsvPath !== null
    && rootManifest.csvRootPath !== null
    && !isPathWithinRoot(rootManifest.csvRootPath, rootManifest.preferredCsvPath)
  ) {
    pushRelationError(errors, `${rootLabel} preferredCsvPath must stay within ${rootLabel} csvRootPath`)
  }
  if (
    rootManifest.artifactType === 'issue-report-summary-artifacts'
    && rootPacketSummaryPath !== null
    && rootPacketRootPath === null
  ) {
    pushRelationError(errors, 'manual packetSummaryPath requires manual packetRootPath')
  }
  if (
    rootManifest.artifactType === 'issue-report-summary-artifacts'
    && rootPacketManifestPath !== null
    && rootPacketRootPath === null
  ) {
    pushRelationError(errors, 'manual packetManifestPath requires manual packetRootPath')
  }
  if (
    rootManifest.artifactType === 'issue-report-summary-artifacts'
    && rootPacketSummaryRelativePath !== null
    && rootPacketRootPath === null
  ) {
    pushRelationError(errors, 'manual packetSummaryRelativePath requires manual packetRootPath')
  }
  if (
    rootManifest.artifactType === 'issue-report-summary-artifacts'
    && rootPacketManifestRelativePath !== null
    && rootPacketRootPath === null
  ) {
    pushRelationError(errors, 'manual packetManifestRelativePath requires manual packetRootPath')
  }
  if (
    rootManifest.artifactType === 'issue-report-summary-artifacts'
    && rootPacketSummaryUrl !== null
    && rootPacketRootUrl === null
  ) {
    pushRelationError(errors, 'manual packetSummaryUrl requires manual packetRootUrl')
  }
  if (
    rootManifest.artifactType === 'issue-report-summary-artifacts'
    && rootPacketManifestUrl !== null
    && rootPacketRootUrl === null
  ) {
    pushRelationError(errors, 'manual packetManifestUrl requires manual packetRootUrl')
  }
  if (
    rootManifest.artifactType === 'issue-report-summary-artifacts'
    && rootPacketSummaryUrl !== null
    && rootPacketSummaryRelativePath === null
  ) {
    pushRelationError(errors, 'manual packetSummaryUrl requires manual packetSummaryRelativePath')
  }
  if (
    rootManifest.artifactType === 'issue-report-summary-artifacts'
    && rootPacketManifestUrl !== null
    && rootPacketManifestRelativePath === null
  ) {
    pushRelationError(errors, 'manual packetManifestUrl requires manual packetManifestRelativePath')
  }
  if (
    rootPacketRootPath
    && rootPacketSummaryPath !== null
    && !isPathWithinRoot(rootPacketRootPath, rootPacketSummaryPath)
  ) {
    pushRelationError(errors, `${rootLabel} packetSummaryPath must stay within ${rootLabel} packetRootPath`)
  }
  if (
    rootPacketRootPath
    && rootPacketManifestPath !== null
    && !isPathWithinRoot(rootPacketRootPath, rootPacketManifestPath)
  ) {
    pushRelationError(errors, `${rootLabel} packetManifestPath must stay within ${rootLabel} packetRootPath`)
  }
  if (
    resolve(rootManifest.outRoot, rootManifest.summaryRelativePath)
    !== rootManifest.summaryPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} summaryRelativePath must resolve to ${rootLabel} summaryPath`,
    )
  }
  if (
    resolve(rootManifest.outRoot, rootManifest.indexSummaryRelativePath)
    !== rootManifest.indexSummaryPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} indexSummaryRelativePath must resolve to ${rootLabel} indexSummaryPath`,
    )
  }
  if (
    resolve(rootManifest.outRoot, rootManifest.indexSummaryJsonRelativePath)
    !== rootManifest.indexSummaryJsonPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} indexSummaryJsonRelativePath must resolve to ${rootLabel} indexSummaryJsonPath`,
    )
  }
  if (
    resolve(rootManifest.outRoot, rootManifest.indexSurfaceRelativePath)
    !== rootManifest.indexSurfacePath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} indexSurfaceRelativePath must resolve to ${rootLabel} indexSurfacePath`,
    )
  }
  if (
    resolve(rootManifest.outRoot, rootManifest.artifactIndexRelativePath)
    !== rootManifest.artifactIndexPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} artifactIndexRelativePath must resolve to ${rootLabel} artifactIndexPath`,
    )
  }
  if (
    rootPacketRootPath
    && rootPacketSummaryPath !== null
    && rootPacketSummaryRelativePath !== null
    && resolve(rootPacketRootPath, rootPacketSummaryRelativePath)
      !== rootPacketSummaryPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} packetSummaryRelativePath must resolve to ${rootLabel} packetSummaryPath`,
    )
  }
  if (
    rootPacketRootPath
    && rootPacketManifestPath !== null
    && rootPacketManifestRelativePath !== null
    && resolve(rootPacketRootPath, rootPacketManifestRelativePath)
      !== rootPacketManifestPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} packetManifestRelativePath must resolve to ${rootLabel} packetManifestPath`,
    )
  }
  if (
    rootManifest.preferredCsvRelativePath !== null
    && rootManifest.preferredCsvPath !== null
    && rootManifest.csvRootPath !== null
    && resolve(rootManifest.csvRootPath, rootManifest.preferredCsvRelativePath)
      !== rootManifest.preferredCsvPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} preferredCsvRelativePath must resolve to ${rootLabel} preferredCsvPath`,
    )
  }
  if (
    rootPacketSummaryUrl !== null
    && rootPacketRootUrl !== null
    && rootPacketSummaryRelativePath !== null
    && rootBundleUrls.packetSummaryUrl !== rootPacketSummaryUrl
  ) {
    pushRelationError(
      errors,
      `${rootLabel} packetSummaryUrl must align with ${rootLabel} packetRootUrl and packetSummaryRelativePath`,
    )
  }
  if (
    rootPacketManifestUrl !== null
    && rootPacketRootUrl !== null
    && rootPacketManifestRelativePath !== null
    && rootBundleUrls.packetManifestUrl !== rootPacketManifestUrl
  ) {
    pushRelationError(
      errors,
      `${rootLabel} packetManifestUrl must align with ${rootLabel} packetRootUrl and packetManifestRelativePath`,
    )
  }
  if (
    rootManifest.preferredCsvUrl !== null
    && rootCsvRootUrl !== null
    && rootManifest.preferredCsvRelativePath !== null
    && rootBundleUrls.preferredCsvUrl !== rootManifest.preferredCsvUrl
  ) {
    pushRelationError(
      errors,
      `${rootLabel} preferredCsvUrl must align with ${rootLabel} csvRootUrl and preferredCsvRelativePath`,
    )
  }
  if (rootManifest.indexSummaryJsonPath === rootManifest.summaryPath) {
    pushRelationError(errors, `${rootLabel} indexSummaryJsonPath must not equal ${rootLabel} summaryPath`)
  }
  if (rootManifest.indexSummaryJsonPath === rootManifest.indexSummaryPath) {
    pushRelationError(
      errors,
      `${rootLabel} indexSummaryJsonPath must not equal ${rootLabel} indexSummaryPath`,
    )
  }
  if (rootManifest.indexSurfacePath === rootManifest.summaryPath) {
    pushRelationError(errors, `${rootLabel} indexSurfacePath must not equal ${rootLabel} summaryPath`)
  }
  if (rootManifest.indexSurfacePath === rootManifest.indexSummaryPath) {
    pushRelationError(
      errors,
      `${rootLabel} indexSurfacePath must not equal ${rootLabel} indexSummaryPath`,
    )
  }
  if (rootManifest.indexSurfacePath === rootManifest.indexSummaryJsonPath) {
    pushRelationError(
      errors,
      `${rootLabel} indexSurfacePath must not equal ${rootLabel} indexSummaryJsonPath`,
    )
  }
  if (rootManifest.artifactIndexPath === rootManifest.summaryPath) {
    pushRelationError(errors, `${rootLabel} artifactIndexPath must not equal ${rootLabel} summaryPath`)
  }
  if (rootManifest.artifactIndexPath === rootManifest.indexSummaryPath) {
    pushRelationError(
      errors,
      `${rootLabel} artifactIndexPath must not equal ${rootLabel} indexSummaryPath`,
    )
  }
  if (rootManifest.artifactIndexPath === rootManifest.indexSummaryJsonPath) {
    pushRelationError(
      errors,
      `${rootLabel} artifactIndexPath must not equal ${rootLabel} indexSummaryJsonPath`,
    )
  }
  if (rootManifest.artifactIndexPath === rootManifest.indexSurfacePath) {
    pushRelationError(
      errors,
      `${rootLabel} artifactIndexPath must not equal ${rootLabel} indexSurfacePath`,
    )
  }
  if (rootManifest.summaryPath === bundle.rootManifestPath) {
    pushRelationError(errors, `${rootLabel} summaryPath must not equal ${rootLabel} manifestPath`)
  }
  if (rootManifest.indexSummaryJsonPath === bundle.rootManifestPath) {
    pushRelationError(
      errors,
      `${rootLabel} indexSummaryJsonPath must not equal ${rootLabel} manifestPath`,
    )
  }
  if (rootManifest.indexSurfacePath === bundle.rootManifestPath) {
    pushRelationError(
      errors,
      `${rootLabel} indexSurfacePath must not equal ${rootLabel} manifestPath`,
    )
  }
  if (rootManifest.artifactIndexPath === bundle.rootManifestPath) {
    pushRelationError(
      errors,
      `${rootLabel} artifactIndexPath must not equal ${rootLabel} manifestPath`,
    )
  }
  if (
    rootPacketSummaryPath !== null
    && rootPacketManifestPath !== null
    && rootPacketSummaryPath === rootPacketManifestPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} packetSummaryPath must not equal ${rootLabel} packetManifestPath`,
    )
  }
  if (
    rootPacketSummaryPath !== null
    && rootPacketSummaryPath === bundle.rootManifestPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} packetSummaryPath must not equal ${rootLabel} manifestPath`,
    )
  }
  if (
    rootPacketManifestPath !== null
    && rootPacketManifestPath === bundle.rootManifestPath
  ) {
    pushRelationError(
      errors,
      `${rootLabel} packetManifestPath must not equal ${rootLabel} manifestPath`,
    )
  }
  if (
    rootManifest.artifactType === 'issue-report-workflow-artifacts'
    && rootManifest.indexSummaryPath === rootManifest.summaryPath
  ) {
    pushRelationError(errors, 'workflow indexSummaryPath must not equal workflow summaryPath')
  }
  if (
    rootManifest.artifactType === 'issue-report-workflow-artifacts'
    && rootManifest.indexSummaryPath === bundle.rootManifestPath
  ) {
    pushRelationError(errors, 'workflow indexSummaryPath must not equal workflow manifestPath')
  }

  if (!packetManifest || !bundle.packetManifestPath) {
    if (errors.length > 0) {
      throw new Error(
        `issue report artifact relation validation failed:\n${errors.map((entry) => `- ${entry}`).join('\n')}`,
      )
    }
    return {
      linkedPublishGateHotspotCount: rootManifest.publishGateHotspots.filter(
        (entry) => entry.packetPath !== null,
      ).length,
      totalPublishGateHotspotCount: rootManifest.publishGateHotspots.length,
      packetSegmentCount: null,
      packetReasonCount: null,
      packetCsvCount: rootManifest.csvPaths.length,
    }
  }

  if (rootManifest.packetManifestPath !== bundle.packetManifestPath) {
    pushRelationError(errors, `${rootLabel} packetManifestPath does not match resolved packet manifest`)
  }
  if (rootManifest.packetRootPath !== packetManifest.packetRootPath) {
    pushRelationError(errors, `${rootLabel} packetRootPath does not match packet manifest packetRootPath`)
  }
  if (rootManifest.packetSummaryPath !== packetManifest.summaryPath) {
    pushRelationError(errors, `${rootLabel} packetSummaryPath does not match packet manifest summaryPath`)
  }
  if (packetManifest.csvRootPath === null) {
    if (rootManifest.csvPaths.length > 0) {
      pushRelationError(errors, 'packet manifest is missing csvRootPath but root csvPaths are present')
    }
  } else if (rootManifest.csvRootPath !== packetManifest.csvRootPath) {
    pushRelationError(errors, `${rootLabel} csvRootPath does not match packet manifest csvRootPath`)
  }
  if (rootPacketRootUrl !== packetManifest.packetRootUrl) {
    pushRelationError(errors, `${rootLabel} packetRootUrl does not match packet manifest packetRootUrl`)
  }
  if (rootCsvRootUrl !== packetManifest.csvRootUrl) {
    pushRelationError(errors, `${rootLabel} csvRootUrl does not match packet manifest csvRootUrl`)
  }
  if (rootManifest.storageFile !== packetManifest.storageFile) {
    pushRelationError(errors, `${rootLabel} storageFile does not match packet manifest storageFile`)
  }
  if (rootManifest.totalCount !== packetManifest.totalCount) {
    pushRelationError(errors, `${rootLabel} totalCount does not match packet manifest totalCount`)
  }
  if (rootManifest.filteredCount !== packetManifest.filteredCount) {
    pushRelationError(errors, `${rootLabel} filteredCount does not match packet manifest filteredCount`)
  }
  if (!isPathWithinRoot(packetManifest.packetRootPath, packetManifest.summaryPath)) {
    pushRelationError(errors, 'packet summaryPath must stay within packetRootPath')
  }
  if (
    resolve(packetManifest.packetRootPath, packetManifest.summaryRelativePath)
    !== packetManifest.summaryPath
  ) {
    pushRelationError(
      errors,
      'packet summaryRelativePath must resolve to packet summaryPath',
    )
  }
  if (packetManifest.summaryPath === bundle.packetManifestPath) {
    pushRelationError(errors, 'packet summaryPath must not equal packet manifestPath')
  }

  compareStringSets(
    [
      packetManifest.summaryPath,
      bundle.packetManifestPath,
      ...packetManifest.segmentPackets.map((entry) =>
        resolve(packetManifest.packetRootPath, entry.relativePath),
      ),
      ...packetManifest.reasonPackets.map((entry) =>
        resolve(packetManifest.packetRootPath, entry.relativePath),
      ),
    ],
    rootManifest.packetPaths,
    `${rootLabel} packet paths`,
    errors,
  )

  compareStringSets(
    packetManifest.csvExports.map((entry) => entry.path),
    rootManifest.csvPaths,
    `${rootLabel} csv paths`,
    errors,
  )
  if (
    rootManifest.preferredCsvPath !== null
    && !rootManifest.csvPaths.includes(rootManifest.preferredCsvPath)
  ) {
    pushRelationError(errors, `${rootLabel} preferredCsvPath must be one of ${rootLabel} csvPaths`)
  }
  if (
    rootManifest.preferredCsvPath !== null
    && !packetManifest.csvExports.some((entry) => entry.path === rootManifest.preferredCsvPath)
  ) {
    pushRelationError(errors, `${rootLabel} preferredCsvPath does not match any packet manifest csv export`)
  }

  const packetSegmentByPath = new Map(
    packetManifest.segmentPackets.map((entry) => [entry.relativePath, entry] as const),
  )
  const packetHotspotByDistrict = new Map(
    packetManifest.publishGateHotspots.map((entry) => [entry.districtId, entry] as const),
  )

  if (rootManifest.publishGateHotspots.length !== packetManifest.publishGateHotspots.length) {
    pushRelationError(
      errors,
      `${rootLabel} publishGateHotspots length does not match packet manifest publishGateHotspots length`,
    )
  }

  let linkedPublishGateHotspotCount = 0
  rootManifest.publishGateHotspots.forEach((entry, index) => {
    if (resolveHotspotPacketRootUrl(entry) !== rootPacketRootUrl) {
      pushRelationError(
        errors,
        `${rootLabel} publishGateHotspots[${index}] packetRootUrl does not match ${rootLabel} packetRootUrl`,
      )
    }
    if (resolveHotspotCsvRootUrl(entry) !== rootCsvRootUrl) {
      pushRelationError(
        errors,
        `${rootLabel} publishGateHotspots[${index}] csvRootUrl does not match ${rootLabel} csvRootUrl`,
      )
    }

    const packetHotspot = packetHotspotByDistrict.get(entry.districtId)
    if (!packetHotspot) {
      pushRelationError(
        errors,
        `${rootLabel} publishGateHotspots[${index}] district ${entry.districtId} is missing from packet manifest`,
      )
      return
    }

    if (entry.segmentLabel !== packetHotspot.issueHotspotSegmentLabel) {
      pushRelationError(
        errors,
        `${rootLabel} publishGateHotspots[${index}] segmentLabel does not match packet manifest hotspot label`,
      )
    }
    const workflowPacketAbsolutePath =
      entry.packetPath
        ? resolve(rootManifest.outRoot, entry.packetPath)
        : null
    const packetHotspotAbsolutePath =
      packetHotspot.issueHotspotPacketPath
        ? resolve(packetManifest.packetRootPath, packetHotspot.issueHotspotPacketPath)
        : null

    if (workflowPacketAbsolutePath !== packetHotspotAbsolutePath) {
      pushRelationError(
        errors,
        `${rootLabel} publishGateHotspots[${index}] packetPath does not match packet manifest hotspot packet path`,
      )
    }

    if (entry.packetPath) {
      linkedPublishGateHotspotCount += 1
      if (
        !workflowPacketAbsolutePath ||
        !rootManifest.packetPaths.includes(workflowPacketAbsolutePath)
      ) {
        pushRelationError(
          errors,
          `${rootLabel} publishGateHotspots[${index}] packetPath ${entry.packetPath} does not resolve to a root packet file`,
        )
      }
      if (
        packetHotspot.issueHotspotPacketPath &&
        !packetSegmentByPath.has(packetHotspot.issueHotspotPacketPath)
      ) {
        pushRelationError(
          errors,
          `${rootLabel} publishGateHotspots[${index}] packetPath ${entry.packetPath} does not resolve to a segment packet`,
        )
      }
    }
  })

  if (errors.length > 0) {
    throw new Error(
      `issue report artifact relation validation failed:\n${errors.map((entry) => `- ${entry}`).join('\n')}`,
    )
  }

  return {
    linkedPublishGateHotspotCount,
    totalPublishGateHotspotCount: rootManifest.publishGateHotspots.length,
    packetSegmentCount: packetManifest.segmentPackets.length,
    packetReasonCount: packetManifest.reasonPackets.length,
    packetCsvCount: packetManifest.csvExports.length,
  }
}

const run = async () => {
  const args = parseIssueReportArtifactManifestArgs(process.argv)
  const loaded =
    args.followPacketManifest
      ? await loadIssueReportArtifactManifestBundle(args.manifestPath)
      : null
  const single =
    args.followPacketManifest
      ? null
      : await loadIssueReportArtifactManifest(args.manifestPath)
  const bundle =
    loaded ?? {
      rootManifestPath: single!.manifestPath,
      rootManifest: single!.manifest,
      packetManifestPath: null,
      packetManifest: null,
    }
  const manifest = assertIssueReportArtifactManifestKind(bundle.rootManifest, args.expectKind)
  const relationSummary =
    args.followPacketManifest
      ? validateIssueReportArtifactManifestRelations(bundle)
      : null
  const summaryValidation =
    args.followSummaryArtifacts && isRootIssueReportArtifactManifest(manifest)
      ? await validateIssueReportArtifactSummaryFiles(manifest)
      : null
  const summary = buildIssueReportArtifactManifestSummary(
    bundle.rootManifestPath,
    manifest,
    relationSummary,
    summaryValidation,
  )
  console.log(
    args.json
      ? JSON.stringify(summary, null, 2)
      : renderIssueReportArtifactManifestSummary(summary),
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
