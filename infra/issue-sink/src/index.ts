const MAX_BODY_BYTES = 1_048_576
const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 100
const IDEMPOTENCY_KEY_PATTERN = /^parkking-[a-f0-9]{64}$/

interface D1ResultSet<T> {
  results: T[]
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T>(): Promise<T | null>
  all<T>(): Promise<D1ResultSet<T>>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

export interface IssueSinkEnv {
  DB: D1Database
  PARKKING_ISSUE_SINK_WRITE_TOKEN?: string
  PARKKING_ISSUE_SINK_ADMIN_TOKEN?: string
}

export interface IssueSinkEnvelope {
  schemaVersion: 1
  source: 'parkking-sync'
  scope: string
  receivedAt: string
  issue: Record<string, unknown>
}

export interface IssueSinkRecord {
  idempotencyKey: string
  scope: string
  issueId: string | null
  sourceReceivedAt: string
  receivedAt: string
  payloadJson: string
}

export interface StoredIssueSinkRecord extends IssueSinkRecord {
  id: number
}

export interface IssueSinkStore {
  check(): Promise<void>
  put(record: IssueSinkRecord): Promise<{
    id: number
    duplicate: boolean
  }>
  list(params: {
    limit: number
    beforeId: number | null
    scope: string | null
  }): Promise<StoredIssueSinkRecord[]>
}

const jsonResponse = (
  status: number,
  body: unknown,
  headers: HeadersInit = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const normalizeText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null

const tokensEqual = (actual: string | null, expected: string | undefined) => {
  if (!actual || !expected || actual.length !== expected.length) {
    return false
  }
  let difference = 0
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return difference === 0
}

const readBearerToken = (request: Request) => {
  const header = request.headers.get('Authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

const requireToken = (
  request: Request,
  expected: string | undefined,
  label: string,
) => {
  if (!expected?.trim()) {
    return jsonResponse(503, {
      error: `${label} token is not configured.`,
    })
  }
  if (!tokensEqual(readBearerToken(request), expected)) {
    return jsonResponse(
      401,
      { error: 'Unauthorized.' },
      { 'WWW-Authenticate': 'Bearer' },
    )
  }
  return null
}

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

const parseCursor = (value: string | null) => {
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const validateEnvelope = (value: unknown): IssueSinkEnvelope => {
  const envelope = toRecord(value)
  const issue = toRecord(envelope?.issue)
  const scope = normalizeText(envelope?.scope)
  const receivedAt = normalizeText(envelope?.receivedAt)
  if (
    envelope?.schemaVersion !== 1 ||
    envelope.source !== 'parkking-sync' ||
    !scope ||
    scope.length > 128 ||
    !receivedAt ||
    Number.isNaN(Date.parse(receivedAt)) ||
    !issue
  ) {
    throw new Error('Invalid ParkKing issue sink envelope.')
  }
  return {
    schemaVersion: 1,
    source: 'parkking-sync',
    scope,
    receivedAt,
    issue,
  }
}

const readEnvelope = async (request: Request) => {
  const declaredLength = Number.parseInt(
    request.headers.get('Content-Length') ?? '',
    10,
  )
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RangeError(`Request body exceeds ${MAX_BODY_BYTES} bytes.`)
  }
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new RangeError(`Request body exceeds ${MAX_BODY_BYTES} bytes.`)
  }
  return validateEnvelope(JSON.parse(raw) as unknown)
}

export const createD1IssueSinkStore = (
  database: D1Database,
): IssueSinkStore => ({
  async check() {
    await database.prepare('SELECT 1 AS ok').first()
  },
  async put(record) {
    const inserted = await database
      .prepare(
        `INSERT INTO issue_reports (
          idempotency_key,
          scope,
          issue_id,
          source_received_at,
          received_at,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(idempotency_key) DO NOTHING
        RETURNING id`,
      )
      .bind(
        record.idempotencyKey,
        record.scope,
        record.issueId,
        record.sourceReceivedAt,
        record.receivedAt,
        record.payloadJson,
      )
      .first<{ id: number }>()
    if (inserted) {
      return {
        id: inserted.id,
        duplicate: false,
      }
    }
    const existing = await database
      .prepare(
        'SELECT id FROM issue_reports WHERE idempotency_key = ? LIMIT 1',
      )
      .bind(record.idempotencyKey)
      .first<{ id: number }>()
    if (!existing) {
      throw new Error('D1 did not return the stored issue receipt.')
    }
    return {
      id: existing.id,
      duplicate: true,
    }
  },
  async list({ limit, beforeId, scope }) {
    const clauses: string[] = []
    const bindings: unknown[] = []
    if (beforeId !== null) {
      clauses.push('id < ?')
      bindings.push(beforeId)
    }
    if (scope !== null) {
      clauses.push('scope = ?')
      bindings.push(scope)
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    const result = await database
      .prepare(
        `SELECT
          id,
          idempotency_key AS idempotencyKey,
          scope,
          issue_id AS issueId,
          source_received_at AS sourceReceivedAt,
          received_at AS receivedAt,
          payload_json AS payloadJson
        FROM issue_reports
        ${where}
        ORDER BY id DESC
        LIMIT ?`,
      )
      .bind(...bindings, limit)
      .all<StoredIssueSinkRecord>()
    return result.results
  },
})

const handleReadiness = async (
  env: IssueSinkEnv,
  store: IssueSinkStore,
) => {
  const issues: string[] = []
  if (!env.PARKKING_ISSUE_SINK_WRITE_TOKEN?.trim()) {
    issues.push('write token is not configured')
  }
  if (!env.PARKKING_ISSUE_SINK_ADMIN_TOKEN?.trim()) {
    issues.push('admin token is not configured')
  }
  try {
    await store.check()
  } catch {
    issues.push('D1 database is unavailable')
  }
  return jsonResponse(issues.length === 0 ? 200 : 503, {
    schemaVersion: 1,
    service: 'parkking-issue-sink',
    status: issues.length === 0 ? 'ok' : 'degraded',
    durability: 'd1',
    issues,
  })
}

const handleIssueWrite = async (
  request: Request,
  env: IssueSinkEnv,
  store: IssueSinkStore,
) => {
  const authError = requireToken(
    request,
    env.PARKKING_ISSUE_SINK_WRITE_TOKEN,
    'Write',
  )
  if (authError) {
    return authError
  }

  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() ?? ''
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return jsonResponse(400, {
      error: 'A valid ParkKing Idempotency-Key is required.',
    })
  }

  let envelope: IssueSinkEnvelope
  try {
    envelope = await readEnvelope(request)
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400
    return jsonResponse(status, {
      error: error instanceof Error ? error.message : 'Invalid request.',
    })
  }

  try {
    const issueId = normalizeText(envelope.issue.issueId)
    const receipt = await store.put({
      idempotencyKey,
      scope: envelope.scope,
      issueId: issueId?.slice(0, 256) ?? null,
      sourceReceivedAt: envelope.receivedAt,
      receivedAt: new Date().toISOString(),
      payloadJson: JSON.stringify(envelope),
    })
    return jsonResponse(receipt.duplicate ? 200 : 201, {
      schemaVersion: 1,
      accepted: true,
      durable: true,
      durability: 'd1',
      duplicate: receipt.duplicate,
      receiptId: receipt.id,
    })
  } catch {
    return jsonResponse(503, {
      error: 'Durable issue storage is unavailable.',
    })
  }
}

const handleIssueList = async (
  request: Request,
  env: IssueSinkEnv,
  store: IssueSinkStore,
) => {
  const authError = requireToken(
    request,
    env.PARKKING_ISSUE_SINK_ADMIN_TOKEN,
    'Admin',
  )
  if (authError) {
    return authError
  }

  const url = new URL(request.url)
  const limit = parsePositiveInteger(
    url.searchParams.get('limit'),
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT,
  )
  const beforeId = parseCursor(url.searchParams.get('before'))
  const scope = normalizeText(url.searchParams.get('scope'))
  let records: StoredIssueSinkRecord[]
  try {
    records = await store.list({ limit, beforeId, scope })
  } catch {
    return jsonResponse(503, {
      error: 'Durable issue storage is unavailable.',
    })
  }
  return jsonResponse(200, {
    schemaVersion: 1,
    issues: records.map((record) => ({
      receiptId: record.id,
      idempotencyKey: record.idempotencyKey,
      scope: record.scope,
      issueId: record.issueId,
      sourceReceivedAt: record.sourceReceivedAt,
      receivedAt: record.receivedAt,
      envelope: JSON.parse(record.payloadJson) as unknown,
    })),
    nextCursor:
      records.length === limit
        ? String(records[records.length - 1]?.id ?? '')
        : null,
  })
}

export const handleIssueSinkRequest = async (
  request: Request,
  env: IssueSinkEnv,
  store: IssueSinkStore = createD1IssueSinkStore(env.DB),
) => {
  const url = new URL(request.url)
  if (url.pathname === '/health' && request.method === 'GET') {
    return jsonResponse(200, {
      schemaVersion: 1,
      service: 'parkking-issue-sink',
      status: 'ok',
      durability: 'd1',
    })
  }
  if (url.pathname === '/ready' && request.method === 'GET') {
    return handleReadiness(env, store)
  }
  if (url.pathname === '/issues' && request.method === 'POST') {
    return handleIssueWrite(request, env, store)
  }
  if (url.pathname === '/issues' && request.method === 'GET') {
    return handleIssueList(request, env, store)
  }
  if (url.pathname === '/issues') {
    return jsonResponse(405, { error: 'Method not allowed.' })
  }
  return jsonResponse(404, { error: 'Not found.' })
}

export default {
  fetch(request: Request, env: IssueSinkEnv) {
    return handleIssueSinkRequest(request, env)
  },
}
