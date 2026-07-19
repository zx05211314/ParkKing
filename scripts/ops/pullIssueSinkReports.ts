import { fileURLToPath } from 'node:url'
import {
  DEFAULT_SYNC_FILE,
  DEFAULT_SYNC_SCOPE,
  STORE_SCHEMA_VERSION,
  normalizeScope,
  normalizeSyncText,
} from './syncServiceConfig'
import {
  createEmptySyncServiceBucket,
} from './syncServiceBucketState'
import { writeSyncStoreFile } from './syncServiceFileStore'
import type {
  SyncServiceBucket,
  SyncServiceStore,
} from './syncServiceTypes'

const DEFAULT_PAGE_LIMIT = 100
const DEFAULT_MAX_PAGES = 100

type FetchImpl = typeof fetch

interface IssueSinkExportRecord {
  receiptId: number
  scope: string
  issueId: string | null
  receivedAt: string
  envelope: {
    issue: Record<string, unknown>
  }
}

interface IssueSinkExportPage {
  issues: IssueSinkExportRecord[]
  nextCursor: string | null
}

export interface PullIssueSinkReportsOptions {
  adminUrl: string | null
  adminToken: string | null
  outputPath: string
  defaultScope: string
  pageLimit: number
  maxPages: number
  requireConfig: boolean
}

export interface PullIssueSinkReportsResult {
  status: 'pulled' | 'skipped'
  outputPath: string
  pages: number
  issueCount: number
  scopes: string[]
  message: string
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const hasFlag = (argv: string[], flag: string) => argv.includes(flag)

const parsePositiveInteger = (
  value: string | null,
  fallback: number,
  maximum: number,
) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const parseIssueSinkExportPage = (value: unknown): IssueSinkExportPage => {
  const page = toRecord(value)
  if (!page || !Array.isArray(page.issues)) {
    throw new Error('Issue sink export response is missing issues.')
  }
  const issues = page.issues.map((entry, index) => {
    const record = toRecord(entry)
    const envelope = toRecord(record?.envelope)
    const issue = toRecord(envelope?.issue)
    if (
      !record ||
      typeof record.receiptId !== 'number' ||
      !Number.isSafeInteger(record.receiptId) ||
      record.receiptId <= 0 ||
      typeof record.scope !== 'string' ||
      typeof record.receivedAt !== 'string' ||
      !issue
    ) {
      throw new Error(`Issue sink export record ${index} is invalid.`)
    }
    return {
      receiptId: record.receiptId,
      scope: record.scope,
      issueId:
        typeof record.issueId === 'string' ? record.issueId : null,
      receivedAt: record.receivedAt,
      envelope: {
        issue,
      },
    }
  })
  return {
    issues,
    nextCursor:
      typeof page.nextCursor === 'string' && page.nextCursor.trim()
        ? page.nextCursor.trim()
        : null,
  }
}

const buildPageUrl = (
  adminUrl: string,
  pageLimit: number,
  cursor: string | null,
) => {
  const url = new URL(adminUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Issue sink admin URL must use http or https.')
  }
  url.searchParams.set('limit', String(pageLimit))
  if (cursor) {
    url.searchParams.set('before', cursor)
  }
  return url.toString()
}

const fetchIssueSinkPage = async (
  url: string,
  token: string,
  fetchImpl: FetchImpl,
) => {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `Issue sink export failed with ${response.status}: ${
        body.trim().slice(0, 300) || response.statusText
      }`,
    )
  }
  return parseIssueSinkExportPage(await response.json())
}

const buildSyncStore = (
  records: IssueSinkExportRecord[],
  defaultScope: string,
): SyncServiceStore => {
  const grouped = new Map<string, IssueSinkExportRecord[]>()
  for (const record of records) {
    const scope = normalizeScope(record.scope, defaultScope)
    grouped.set(scope, [...(grouped.get(scope) ?? []), record])
  }
  const buckets: Record<string, SyncServiceBucket> = {}
  for (const [scope, scopedRecords] of grouped) {
    const bucket = createEmptySyncServiceBucket()
    const deduped = new Map<string, Record<string, unknown>>()
    for (const record of scopedRecords.sort(
      (left, right) => left.receiptId - right.receiptId,
    )) {
      const key =
        normalizeSyncText(record.issueId) ??
        `receipt-${record.receiptId}`
      deduped.set(key, record.envelope.issue)
    }
    bucket.issueReports = Array.from(deduped.values())
    bucket.issueReportsRevision = scopedRecords.length
    bucket.issueReportsUpdatedAt =
      scopedRecords
        .map((record) => record.receivedAt)
        .sort()
        .at(-1) ?? null
    buckets[scope] = bucket
  }
  if (Object.keys(buckets).length === 0) {
    buckets[defaultScope] = createEmptySyncServiceBucket()
  }
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    buckets,
  }
}

export const pullIssueSinkReports = async (
  options: PullIssueSinkReportsOptions,
  fetchImpl: FetchImpl = fetch,
): Promise<PullIssueSinkReportsResult> => {
  const adminUrl = normalizeSyncText(options.adminUrl)
  const adminToken = normalizeSyncText(options.adminToken)
  if (!adminUrl || !adminToken) {
    if (options.requireConfig) {
      throw new Error(
        'Issue sink admin URL and token are required.',
      )
    }
    return {
      status: 'skipped',
      outputPath: options.outputPath,
      pages: 0,
      issueCount: 0,
      scopes: [],
      message: 'Issue sink admin URL or token is not configured.',
    }
  }

  const records: IssueSinkExportRecord[] = []
  const seenCursors = new Set<string>()
  let cursor: string | null = null
  let pages = 0
  do {
    if (pages >= options.maxPages) {
      throw new Error(
        `Issue sink export exceeded ${options.maxPages} pages.`,
      )
    }
    const page = await fetchIssueSinkPage(
      buildPageUrl(adminUrl, options.pageLimit, cursor),
      adminToken,
      fetchImpl,
    )
    records.push(...page.issues)
    pages += 1
    cursor = page.nextCursor
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error(`Issue sink export repeated cursor ${cursor}.`)
      }
      seenCursors.add(cursor)
    }
  } while (cursor)

  const store = buildSyncStore(records, options.defaultScope)
  await writeSyncStoreFile(options.outputPath, store)
  return {
    status: 'pulled',
    outputPath: options.outputPath,
    pages,
    issueCount: records.length,
    scopes: Object.keys(store.buckets).sort(),
    message: `Pulled ${records.length} durable issue reports.`,
  }
}

export const parsePullIssueSinkReportsArgs = (
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): PullIssueSinkReportsOptions => ({
  adminUrl:
    getArgValue(argv, '--admin-url', '--url') ??
    env.PARKKING_ISSUE_SINK_ADMIN_URL ??
    null,
  adminToken:
    getArgValue(argv, '--admin-token', '--token') ??
    env.PARKKING_ISSUE_SINK_ADMIN_TOKEN ??
    null,
  outputPath:
    getArgValue(argv, '--out') ??
    env.PARKKING_SYNC_FILE ??
    DEFAULT_SYNC_FILE,
  defaultScope:
    getArgValue(argv, '--default-scope') ??
    env.PARKKING_SYNC_DEFAULT_SCOPE ??
    DEFAULT_SYNC_SCOPE,
  pageLimit: parsePositiveInteger(
    getArgValue(argv, '--page-limit'),
    DEFAULT_PAGE_LIMIT,
    100,
  ),
  maxPages: parsePositiveInteger(
    getArgValue(argv, '--max-pages'),
    DEFAULT_MAX_PAGES,
    1000,
  ),
  requireConfig: hasFlag(argv, '--require'),
})

const run = async () => {
  const options = parsePullIssueSinkReportsArgs(process.argv.slice(2))
  const result = await pullIssueSinkReports(options)
  console.log(
    `# ParkKing Issue Sink Pull: ${
      result.status === 'pulled' ? 'PASS' : 'SKIP'
    }`,
  )
  console.log(`- Output: ${result.outputPath}`)
  console.log(`- Pages: ${result.pages}`)
  console.log(`- Issues: ${result.issueCount}`)
  console.log(`- Scopes: ${result.scopes.join(', ') || '-'}`)
  console.log(`- Message: ${result.message}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
