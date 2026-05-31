import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { normalizeSyncText, resolveSyncServiceConfig } from './syncServiceConfig'
import { readSyncStoreFile } from './syncServiceFileStore'
import type { SyncServiceStore } from './syncServiceTypes'
import type {
  IssueReportSummaryArgs,
  IssueReportSummaryFilters,
  IssueReportSummaryResult,
  SyncIssueReportDistrictSummary,
  SyncIssueReportEntry,
  SyncIssueReportRawIssue,
  SyncIssueReportReasonSummary,
  SyncIssueReportSegmentSummary,
} from './issueReportSummaryTypes'

const issueReportStoreExists = async (storageFile: string) => {
  try {
    await access(storageFile)
    return true
  } catch {
    return false
  }
}

const normalizeOptionalText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

const compareNullableDescending = (left: string | null, right: string | null) => {
  if (left && right) {
    return right.localeCompare(left)
  }
  if (left) {
    return -1
  }
  if (right) {
    return 1
  }
  return 0
}

const normalizeReasonCodes = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((code) => normalizeOptionalText(code))
        .filter((code): code is string => Boolean(code))
    : []

const normalizeBundleSnapshot = (bundle: unknown) => {
  if (!bundle || typeof bundle !== 'object') {
    return {
      segmentName: null,
      segmentTier: null,
      allowedNow: null,
      reasonCodes: [] as string[],
      bundleGeneratedAt: null,
      reportHhmm: null,
      includeInferred: null as boolean | null,
    }
  }

  const selectedSegment =
    'selectedSegment' in bundle && bundle.selectedSegment && typeof bundle.selectedSegment === 'object'
      ? bundle.selectedSegment
      : null
  const context =
    'context' in bundle && bundle.context && typeof bundle.context === 'object'
      ? bundle.context
      : null

  return {
    segmentName:
      selectedSegment && 'name' in selectedSegment
        ? normalizeOptionalText(selectedSegment.name)
        : null,
    segmentTier:
      selectedSegment && 'tier' in selectedSegment
        ? normalizeOptionalText(selectedSegment.tier)
        : null,
    allowedNow:
      selectedSegment && 'allowedNow' in selectedSegment
        ? normalizeOptionalText(selectedSegment.allowedNow)
        : null,
    reasonCodes:
      selectedSegment && 'reasonCodes' in selectedSegment
        ? normalizeReasonCodes(selectedSegment.reasonCodes)
        : [],
    bundleGeneratedAt:
      'generatedAt' in bundle ? normalizeOptionalText(bundle.generatedAt) : null,
    reportHhmm:
      context && 'hhmm' in context ? normalizeOptionalText(context.hhmm) : null,
    includeInferred:
      context && 'includeInferred' in context && typeof context.includeInferred === 'boolean'
        ? context.includeInferred
        : null,
  }
}

const normalizeIssueReportEntry = (
  issue: unknown,
  scope: string,
  index: number,
): SyncIssueReportRawIssue | null => {
  if (!issue || typeof issue !== 'object') {
    return null
  }

  const summary =
    'summary' in issue ? normalizeOptionalText(issue.summary) : null
  const createdAt =
    'createdAt' in issue ? normalizeOptionalText(issue.createdAt) : null
  if (!summary || !createdAt) {
    return null
  }

  const issueId =
    ('issueId' in issue ? normalizeOptionalText(issue.issueId) : null) ??
    `${scope}-${createdAt}-${index}`
  const bundle = 'bundle' in issue ? issue.bundle : null
  const snapshot = normalizeBundleSnapshot(bundle)

  return {
    scope,
    issueId,
    districtId:
      ('districtId' in issue ? normalizeOptionalText(issue.districtId) : null) ?? 'unknown',
    segmentId: 'segmentId' in issue ? normalizeOptionalText(issue.segmentId) : null,
    segmentName: snapshot.segmentName,
    segmentTier: snapshot.segmentTier,
    allowedNow: snapshot.allowedNow,
    reasonCodes: snapshot.reasonCodes,
    bundleGeneratedAt: snapshot.bundleGeneratedAt,
    reportHhmm: snapshot.reportHhmm,
    includeInferred: snapshot.includeInferred,
    summary,
    createdAt,
    bundle,
  }
}

export const collectSyncIssueReportEntries = (
  store: SyncServiceStore,
): SyncIssueReportRawIssue[] =>
  Object.entries(store.buckets)
    .flatMap(([scope, bucket]) =>
      bucket.issueReports
        .map((issue, index) => normalizeIssueReportEntry(issue, scope, index))
        .filter((issue): issue is SyncIssueReportRawIssue => Boolean(issue)),
    )
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return right.createdAt.localeCompare(left.createdAt)
      }
      if (left.scope !== right.scope) {
        return left.scope.localeCompare(right.scope)
      }
      return left.issueId.localeCompare(right.issueId)
    })

export const filterSyncIssueReportEntries = <T extends SyncIssueReportEntry>(
  issues: T[],
  filters: IssueReportSummaryFilters,
): T[] =>
  issues.filter((issue) => {
    if (filters.scope && issue.scope !== filters.scope) {
      return false
    }
    if (filters.districtId && issue.districtId !== filters.districtId) {
      return false
    }
    if (filters.segmentId && issue.segmentId !== filters.segmentId) {
      return false
    }
    if (filters.reasonCode && !issue.reasonCodes.includes(filters.reasonCode)) {
      return false
    }
    if (filters.since && issue.createdAt < filters.since) {
      return false
    }
    return true
  })

export const summarizeSyncIssueReportEntries = (
  issues: SyncIssueReportEntry[],
): SyncIssueReportDistrictSummary[] => {
  const summaries = new Map<string, SyncIssueReportDistrictSummary>()

  issues.forEach((issue) => {
    const key = `${issue.scope}::${issue.districtId}`
    const existing = summaries.get(key)
    if (!existing) {
      summaries.set(key, {
        scope: issue.scope,
        districtId: issue.districtId,
        count: 1,
        latestCreatedAt: issue.createdAt,
        latestSummary: issue.summary,
      })
      return
    }

    existing.count += 1
    if (
      !existing.latestCreatedAt ||
      issue.createdAt > existing.latestCreatedAt
    ) {
      existing.latestCreatedAt = issue.createdAt
      existing.latestSummary = issue.summary
    }
  })

  return Array.from(summaries.values()).sort((left, right) => {
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope)
    }
    return left.districtId.localeCompare(right.districtId)
  })
}

export const summarizeSyncIssueReportSegments = (
  issues: SyncIssueReportEntry[],
): SyncIssueReportSegmentSummary[] => {
  const summaries = new Map<string, SyncIssueReportSegmentSummary>()

  issues.forEach((issue) => {
    if (!issue.segmentId) {
      return
    }

    const key = `${issue.scope}::${issue.districtId}::${issue.segmentId}`
    const existing = summaries.get(key)
    if (!existing) {
      summaries.set(key, {
        scope: issue.scope,
        districtId: issue.districtId,
        segmentId: issue.segmentId,
        segmentName: issue.segmentName,
        segmentTier: issue.segmentTier,
        count: 1,
        latestCreatedAt: issue.createdAt,
        latestSummary: issue.summary,
      })
      return
    }

    existing.count += 1
    if (!existing.segmentName && issue.segmentName) {
      existing.segmentName = issue.segmentName
    }
    if (!existing.segmentTier && issue.segmentTier) {
      existing.segmentTier = issue.segmentTier
    }
    if (
      !existing.latestCreatedAt ||
      issue.createdAt > existing.latestCreatedAt
    ) {
      existing.latestCreatedAt = issue.createdAt
      existing.latestSummary = issue.summary
    }
  })

  return Array.from(summaries.values()).sort((left, right) => {
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope)
    }
    if (left.districtId !== right.districtId) {
      return left.districtId.localeCompare(right.districtId)
    }
    return left.segmentId.localeCompare(right.segmentId)
  })
}

export const summarizeSyncIssueReportReasons = (
  issues: SyncIssueReportEntry[],
): SyncIssueReportReasonSummary[] => {
  const summaries = new Map<string, SyncIssueReportReasonSummary>()
  const districtIdsByReason = new Map<string, Set<string>>()
  const segmentIdsByReason = new Map<string, Set<string>>()

  issues.forEach((issue) => {
    issue.reasonCodes.forEach((reasonCode) => {
      const existing = summaries.get(reasonCode)
      const districtIds = districtIdsByReason.get(reasonCode) ?? new Set<string>()
      districtIds.add(`${issue.scope}::${issue.districtId}`)
      districtIdsByReason.set(reasonCode, districtIds)

      if (issue.segmentId) {
        const segmentIds = segmentIdsByReason.get(reasonCode) ?? new Set<string>()
        segmentIds.add(`${issue.scope}::${issue.districtId}::${issue.segmentId}`)
        segmentIdsByReason.set(reasonCode, segmentIds)
      }

      if (!existing) {
        summaries.set(reasonCode, {
          reasonCode,
          count: 1,
          districtCount: districtIds.size,
          segmentCount: segmentIdsByReason.get(reasonCode)?.size ?? 0,
          latestCreatedAt: issue.createdAt,
          latestDistrictId: issue.districtId,
          latestSegmentId: issue.segmentId,
          latestSegmentName: issue.segmentName,
        })
        return
      }

      existing.count += 1
      existing.districtCount = districtIds.size
      existing.segmentCount = segmentIdsByReason.get(reasonCode)?.size ?? 0
      if (
        !existing.latestCreatedAt ||
        issue.createdAt > existing.latestCreatedAt
      ) {
        existing.latestCreatedAt = issue.createdAt
        existing.latestDistrictId = issue.districtId
        existing.latestSegmentId = issue.segmentId
        existing.latestSegmentName = issue.segmentName
      }
    })
  })

  return Array.from(summaries.values()).sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count
    }
    const byLatest = compareNullableDescending(left.latestCreatedAt, right.latestCreatedAt)
    if (byLatest !== 0) {
      return byLatest
    }
    return left.reasonCode.localeCompare(right.reasonCode)
  })
}

export const collectSyncIssueReportDistrictSummaries = (
  store: SyncServiceStore,
  filters: IssueReportSummaryFilters = {
    scope: null,
    districtId: null,
    segmentId: null,
    reasonCode: null,
    since: null,
  },
) =>
  summarizeSyncIssueReportEntries(
    filterSyncIssueReportEntries(collectSyncIssueReportEntries(store), filters),
  )

const toIssueReportEntry = (issue: SyncIssueReportRawIssue): SyncIssueReportEntry => ({
  scope: issue.scope,
  issueId: issue.issueId,
  districtId: issue.districtId,
  segmentId: issue.segmentId,
  segmentName: issue.segmentName,
  segmentTier: issue.segmentTier,
  allowedNow: issue.allowedNow,
  reasonCodes: issue.reasonCodes,
  bundleGeneratedAt: issue.bundleGeneratedAt,
  reportHhmm: issue.reportHhmm,
  includeInferred: issue.includeInferred,
  summary: issue.summary,
  createdAt: issue.createdAt,
})

const rankDistrictSummaries = (summaries: SyncIssueReportDistrictSummary[]) =>
  [...summaries].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count
    }
    const byLatest = compareNullableDescending(left.latestCreatedAt, right.latestCreatedAt)
    if (byLatest !== 0) {
      return byLatest
    }
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope)
    }
    return left.districtId.localeCompare(right.districtId)
  })

const sortDistrictsByLatest = (summaries: SyncIssueReportDistrictSummary[]) =>
  [...summaries].sort((left, right) => {
    const byLatest = compareNullableDescending(left.latestCreatedAt, right.latestCreatedAt)
    if (byLatest !== 0) {
      return byLatest
    }
    if (left.count !== right.count) {
      return right.count - left.count
    }
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope)
    }
    return left.districtId.localeCompare(right.districtId)
  })

const rankSegmentSummaries = (summaries: SyncIssueReportSegmentSummary[]) =>
  [...summaries].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count
    }
    const byLatest = compareNullableDescending(left.latestCreatedAt, right.latestCreatedAt)
    if (byLatest !== 0) {
      return byLatest
    }
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope)
    }
    if (left.districtId !== right.districtId) {
      return left.districtId.localeCompare(right.districtId)
    }
    return left.segmentId.localeCompare(right.segmentId)
  })

export const loadIssueReportSummary = async (
  args: Pick<
    IssueReportSummaryArgs,
    | 'syncStorePath'
    | 'scope'
    | 'districtId'
    | 'segmentId'
    | 'reasonCode'
    | 'since'
    | 'limit'
  >,
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): Promise<IssueReportSummaryResult> => {
  const config = resolveSyncServiceConfig(env, cwd)
  const syncStorePath = normalizeSyncText(args.syncStorePath)
  const storageFile = syncStorePath
    ? resolve(cwd, syncStorePath)
    : config.storageFile

  const filters: IssueReportSummaryFilters = {
    scope: args.scope,
    districtId: args.districtId,
    segmentId: args.segmentId,
    reasonCode: args.reasonCode,
    since: args.since,
  }

  if (!(await issueReportStoreExists(storageFile))) {
    return {
      storageFile,
      storeExists: false,
      totalCount: 0,
      filteredCount: 0,
      filters,
      summaries: [],
      segmentSummaries: [],
      topDistricts: [],
      latestDistricts: [],
      topSegments: [],
      topReasons: [],
      issues: [],
      rawIssues: [],
    }
  }

  const store = await readSyncStoreFile(storageFile, config.defaultScope)
  const issues = collectSyncIssueReportEntries(store)
  const filteredIssues = filterSyncIssueReportEntries(issues, filters)
  const issueEntries = filteredIssues.map(toIssueReportEntry)
  const summaries = summarizeSyncIssueReportEntries(filteredIssues)
  const segmentSummaries = summarizeSyncIssueReportSegments(filteredIssues)

  return {
    storageFile,
    storeExists: true,
    totalCount: issues.length,
    filteredCount: filteredIssues.length,
    filters,
    summaries,
    segmentSummaries,
    topDistricts: rankDistrictSummaries(summaries).slice(0, args.limit),
    latestDistricts: sortDistrictsByLatest(summaries).slice(0, args.limit),
    topSegments: rankSegmentSummaries(segmentSummaries).slice(0, args.limit),
    topReasons: summarizeSyncIssueReportReasons(issueEntries).slice(0, args.limit),
    issues: issueEntries.slice(0, args.limit),
    rawIssues: filteredIssues,
  }
}
