import { describe, expect, it } from 'vitest'
import {
  handleIssueSinkRequest,
  type IssueSinkEnv,
  type IssueSinkRecord,
  type IssueSinkStore,
  type StoredIssueSinkRecord,
} from './index'

const WRITE_TOKEN = 'write-token'
const ADMIN_TOKEN = 'admin-token'
const IDEMPOTENCY_KEY = `parkking-${'a'.repeat(64)}`

const createStore = () => {
  const records: StoredIssueSinkRecord[] = []
  let healthy = true
  const store: IssueSinkStore = {
    async check() {
      if (!healthy) {
        throw new Error('offline')
      }
    },
    async put(record: IssueSinkRecord) {
      const existing = records.find(
        (entry) => entry.idempotencyKey === record.idempotencyKey,
      )
      if (existing) {
        return {
          id: existing.id,
          duplicate: true,
        }
      }
      const next = {
        ...record,
        id: records.length + 1,
      }
      records.push(next)
      return {
        id: next.id,
        duplicate: false,
      }
    },
    async list({ limit, beforeId, scope }) {
      return [...records]
        .filter((record) => beforeId === null || record.id < beforeId)
        .filter((record) => scope === null || record.scope === scope)
        .sort((left, right) => right.id - left.id)
        .slice(0, limit)
    },
  }
  return {
    records,
    setHealthy(value: boolean) {
      healthy = value
    },
    store,
  }
}

const createEnv = (overrides: Partial<IssueSinkEnv> = {}): IssueSinkEnv => ({
  DB: {} as IssueSinkEnv['DB'],
  PARKKING_ISSUE_SINK_WRITE_TOKEN: WRITE_TOKEN,
  PARKKING_ISSUE_SINK_ADMIN_TOKEN: ADMIN_TOKEN,
  ...overrides,
})

const createEnvelope = (issueId = 'issue-a') => ({
  schemaVersion: 1,
  source: 'parkking-sync',
  scope: 'default',
  receivedAt: '2026-07-19T13:00:00.000Z',
  issue: {
    issueId,
    summary: 'Curb rule mismatch',
  },
})

const createWriteRequest = (
  envelope: unknown = createEnvelope(),
  idempotencyKey = IDEMPOTENCY_KEY,
) =>
  new Request('https://sink.example/issues', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WRITE_TOKEN}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(envelope),
  })

describe('ParkKing D1 issue sink', () => {
  it('serves liveness without exposing configuration or issue data', async () => {
    const fixture = createStore()
    const response = await handleIssueSinkRequest(
      new Request('https://sink.example/health'),
      createEnv(),
      fixture.store,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      service: 'parkking-issue-sink',
      status: 'ok',
      durability: 'd1',
    })
  })

  it('degrades readiness when a token or D1 is unavailable', async () => {
    const fixture = createStore()
    fixture.setHealthy(false)
    const response = await handleIssueSinkRequest(
      new Request('https://sink.example/ready'),
      createEnv({
        PARKKING_ISSUE_SINK_ADMIN_TOKEN: undefined,
      }),
      fixture.store,
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      status: 'degraded',
      issues: [
        'admin token is not configured',
        'D1 database is unavailable',
      ],
    })
  })

  it('requires the write token and a valid idempotency key', async () => {
    const fixture = createStore()
    const unauthorized = await handleIssueSinkRequest(
      new Request('https://sink.example/issues', {
        method: 'POST',
        body: JSON.stringify(createEnvelope()),
      }),
      createEnv(),
      fixture.store,
    )
    const invalidKey = await handleIssueSinkRequest(
      createWriteRequest(createEnvelope(), 'issue-a'),
      createEnv(),
      fixture.store,
    )

    expect(unauthorized.status).toBe(401)
    expect(unauthorized.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect(invalidKey.status).toBe(400)
    expect(fixture.records).toHaveLength(0)
  })

  it('persists valid reports and returns the same receipt for retries', async () => {
    const fixture = createStore()
    const first = await handleIssueSinkRequest(
      createWriteRequest(),
      createEnv(),
      fixture.store,
    )
    const duplicate = await handleIssueSinkRequest(
      createWriteRequest(),
      createEnv(),
      fixture.store,
    )

    expect(first.status).toBe(201)
    await expect(first.json()).resolves.toMatchObject({
      accepted: true,
      durable: true,
      durability: 'd1',
      duplicate: false,
      receiptId: 1,
    })
    expect(duplicate.status).toBe(200)
    await expect(duplicate.json()).resolves.toMatchObject({
      duplicate: true,
      receiptId: 1,
    })
    expect(fixture.records).toHaveLength(1)
    expect(JSON.parse(fixture.records[0]?.payloadJson ?? '{}')).toEqual(
      createEnvelope(),
    )
  })

  it('rejects malformed envelopes without writing them', async () => {
    const fixture = createStore()
    const response = await handleIssueSinkRequest(
      createWriteRequest({
        schemaVersion: 1,
        source: 'unknown',
        issue: {},
      }),
      createEnv(),
      fixture.store,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid ParkKing issue sink envelope.',
    })
    expect(fixture.records).toHaveLength(0)
  })

  it('returns 503 when D1 cannot durably store a valid report', async () => {
    const fixture = createStore()
    fixture.store.put = async () => {
      throw new Error('D1 offline')
    }
    const response = await handleIssueSinkRequest(
      createWriteRequest(),
      createEnv(),
      fixture.store,
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Durable issue storage is unavailable.',
    })
  })

  it('protects admin export and supports scope/cursor pagination', async () => {
    const fixture = createStore()
    await fixture.store.put({
      idempotencyKey: IDEMPOTENCY_KEY,
      scope: 'alpha',
      issueId: 'issue-a',
      sourceReceivedAt: '2026-07-19T13:00:00.000Z',
      receivedAt: '2026-07-19T13:00:01.000Z',
      payloadJson: JSON.stringify(createEnvelope('issue-a')),
    })
    await fixture.store.put({
      idempotencyKey: `parkking-${'b'.repeat(64)}`,
      scope: 'beta',
      issueId: 'issue-b',
      sourceReceivedAt: '2026-07-19T13:01:00.000Z',
      receivedAt: '2026-07-19T13:01:01.000Z',
      payloadJson: JSON.stringify(createEnvelope('issue-b')),
    })

    const unauthorized = await handleIssueSinkRequest(
      new Request('https://sink.example/issues'),
      createEnv(),
      fixture.store,
    )
    const response = await handleIssueSinkRequest(
      new Request('https://sink.example/issues?scope=alpha&limit=1', {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
      }),
      createEnv(),
      fixture.store,
    )

    expect(unauthorized.status).toBe(401)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      issues: [
        {
          receiptId: 1,
          scope: 'alpha',
          issueId: 'issue-a',
          envelope: {
            issue: {
              issueId: 'issue-a',
            },
          },
        },
      ],
      nextCursor: '1',
    })
  })
})
