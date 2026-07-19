import { describe, expect, it, vi } from 'vitest'
import { createSyncServiceMiddleware } from './syncServiceMiddleware'
import type { SyncService, SyncServiceConfig } from './syncServiceTypes'

const createMockResponse = () => {
  const headers = new Map<string, string>()
  let body = ''

  return {
    body: () => body,
    headers,
    response: {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        headers.set(name, value)
      },
      end: (value?: string) => {
        body = value ?? ''
      },
    },
  }
}

const createMockService = (): SyncService => ({
  getSyncStatus: vi.fn().mockResolvedValue({
    scope: 'alpha',
    savedPlansRevision: 1,
    reportsRevision: 2,
    issueReportsRevision: 3,
    savedPlansCount: 1,
    reportsCount: 3,
    issueReportsCount: 4,
    savedPlansUpdatedAt: '2026-03-21T00:00:00.000Z',
    reportsUpdatedAt: '2026-03-21T01:00:00.000Z',
    issueReportsUpdatedAt: '2026-03-21T02:00:00.000Z',
  }),
  getSavedPlansState: vi.fn().mockResolvedValue({ plans: [], revision: 0 }),
  getSavedPlans: vi.fn().mockResolvedValue([]),
  replaceSavedPlans: vi.fn().mockResolvedValue({
    conflict: true,
    plans: [{ key: 'latest' }],
    revision: 7,
  }),
  getReportsState: vi.fn().mockResolvedValue({ reports: [], revision: 0 }),
  getReports: vi.fn().mockResolvedValue([]),
  getIssueReportsState: vi.fn().mockResolvedValue({ issues: [], revision: 0 }),
  getIssueReports: vi.fn().mockResolvedValue([]),
  getBootstrapState: vi.fn().mockResolvedValue({
    plans: [{ key: 'plan-a' }],
    savedPlansRevision: 3,
  }),
  appendReport: vi.fn().mockResolvedValue({
    report: { districtId: 'xinyi' },
    revision: 1,
  }),
  appendIssueReport: vi.fn().mockResolvedValue({
    issue: { issueId: 'issue-a' },
    revision: 1,
  }),
})

const createConfig = (
  overrides: Partial<SyncServiceConfig> = {},
): SyncServiceConfig => ({
  path: '/api/sync',
  port: 8789,
  storageFile: '.tmp/sync-service.json',
  defaultScope: 'default',
  mode: 'full',
  durability: 'persistent',
  maxBodyBytes: 1048576,
  maxIssueReports: 1000,
  corsOrigins: ['*'],
  writeRateLimitWindowMs: 60000,
  writeRateLimitMax: 120,
  ...overrides,
})

describe('createSyncServiceMiddleware', () => {
  it('passes normalized bootstrap resources through to the service', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(service)
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/sync/bootstrap?scope=alpha&include=savedPlans,reports&include=savedPlans',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(service.getBootstrapState).toHaveBeenCalledWith('alpha', [
      'savedPlans',
      'reports',
    ])
    expect(res.response.statusCode).toBe(200)
  })

  it('returns 409 for stale saved-plan writes', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(service)
    const res = createMockResponse()

    async function* body() {
      yield Buffer.from(JSON.stringify({ plans: [{ key: 'incoming' }], revision: 2 }))
    }

    await expect(
      middleware(
        {
          method: 'PUT',
          url: '/api/sync/saved-plans?scope=alpha',
          [Symbol.asyncIterator]: body,
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(service.replaceSavedPlans).toHaveBeenCalledWith(
      [{ key: 'incoming' }],
      'alpha',
      2,
    )
    expect(res.response.statusCode).toBe(409)
    expect(res.body()).toContain('"Saved plans are out of date."')
  })

  it('routes issue submissions through the issues endpoint', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(service)
    const res = createMockResponse()

    async function* body() {
      yield Buffer.from(JSON.stringify({ issue: { issueId: 'issue-b' } }))
    }

    await expect(
      middleware(
        {
          method: 'POST',
          url: '/api/sync/issues?scope=alpha',
          [Symbol.asyncIterator]: body,
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(service.appendIssueReport).toHaveBeenCalledWith(
      { issueId: 'issue-b' },
      'alpha',
    )
    expect(res.response.statusCode).toBe(201)
    expect(res.body()).toContain('"issueId":"issue-a"')
  })

  it('limits upload-only mode to issue POST and metadata routes', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig({
        mode: 'issue-upload-only',
        durability: 'ephemeral',
      }),
    )

    for (const request of [
      { method: 'GET', url: '/api/sync/bootstrap?scope=alpha' },
      { method: 'GET', url: '/api/sync/saved-plans?scope=alpha' },
      { method: 'PUT', url: '/api/sync/saved-plans?scope=alpha' },
      { method: 'GET', url: '/api/sync/reports?scope=alpha' },
      { method: 'POST', url: '/api/sync/reports?scope=alpha' },
      { method: 'GET', url: '/api/sync/issues?scope=alpha' },
    ]) {
      const res = createMockResponse()
      await middleware(request as never, res.response as never)
      expect(res.response.statusCode, `${request.method} ${request.url}`).toBe(403)
      expect(res.body()).toContain('issue-upload-only')
    }

    const statusResponse = createMockResponse()
    await middleware(
      {
        method: 'GET',
        url: '/api/sync/status?scope=alpha',
      } as never,
      statusResponse.response as never,
    )
    expect(statusResponse.response.statusCode).toBe(200)
    expect(service.getSyncStatus).toHaveBeenCalledWith('alpha')

    const issueResponse = createMockResponse()
    async function* body() {
      yield Buffer.from(JSON.stringify({ issue: { issueId: 'issue-upload' } }))
    }
    await middleware(
      {
        method: 'POST',
        url: '/api/sync/issues?scope=alpha',
        [Symbol.asyncIterator]: body,
      } as never,
      issueResponse.response as never,
    )
    expect(issueResponse.response.statusCode).toBe(201)
    expect(service.appendIssueReport).toHaveBeenCalledWith(
      { issueId: 'issue-upload' },
      'alpha',
    )
  })

  it('returns 413 before writing oversized issue reports', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig({ maxBodyBytes: 8 }),
    )
    const res = createMockResponse()

    async function* body() {
      yield Buffer.from(JSON.stringify({ issue: { issueId: 'issue-large' } }))
    }

    await expect(
      middleware(
        {
          method: 'POST',
          url: '/api/sync/issues?scope=alpha',
          [Symbol.asyncIterator]: body,
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(service.appendIssueReport).not.toHaveBeenCalled()
    expect(res.response.statusCode).toBe(413)
    expect(res.body()).toContain('exceeds 8 bytes')
  })

  it('rejects disallowed CORS origins before writing issue reports', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig({ corsOrigins: ['https://parkking.example'] }),
    )
    const res = createMockResponse()

    async function* body() {
      yield Buffer.from(JSON.stringify({ issue: { issueId: 'issue-cross-origin' } }))
    }

    await expect(
      middleware(
        {
          method: 'POST',
          url: '/api/sync/issues?scope=alpha',
          headers: {
            origin: 'https://evil.example',
          },
          [Symbol.asyncIterator]: body,
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(service.appendIssueReport).not.toHaveBeenCalled()
    expect(res.response.statusCode).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeUndefined()
    expect(res.body()).toContain('Origin is not allowed')
  })

  it('mirrors configured CORS origins for allowed preflight requests', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig({ corsOrigins: ['https://parkking.example'] }),
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'OPTIONS',
          url: '/api/sync/issues',
          headers: {
            origin: 'https://parkking.example',
          },
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://parkking.example',
    )
    expect(res.headers.get('Vary')).toBe('Origin')
  })

  it('rate-limits repeated write requests before writing issue reports', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig({
        writeRateLimitMax: 2,
        writeRateLimitWindowMs: 60000,
      }),
    )

    const postIssue = async () => {
      const res = createMockResponse()

      async function* body() {
        yield Buffer.from(JSON.stringify({ issue: { issueId: 'issue-limited' } }))
      }

      await middleware(
        {
          method: 'POST',
          url: '/api/sync/issues?scope=alpha',
          headers: {},
          socket: {
            remoteAddress: '127.0.0.1',
          },
          [Symbol.asyncIterator]: body,
        } as never,
        res.response as never,
      )
      return res
    }

    const first = await postIssue()
    const second = await postIssue()
    const third = await postIssue()

    expect(first.response.statusCode).toBe(201)
    expect(second.response.statusCode).toBe(201)
    expect(third.response.statusCode).toBe(429)
    expect(third.headers.get('Retry-After')).toBe('60')
    expect(third.body()).toContain('write rate limit exceeded')
    expect(service.appendIssueReport).toHaveBeenCalledTimes(2)
  })

  it('serves health without reading a scoped sync store', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig(),
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/sync/health',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(200)
    expect(JSON.parse(res.body())).toMatchObject({
      service: 'sync-service',
      status: 'ok',
      basePath: '/api/sync',
      readinessPath: '/api/sync/ready',
      statusPath: '/api/sync/status',
      maxIssueReports: 1000,
      mode: 'full',
      durability: 'persistent',
      capabilities: {
        savedPlansRead: true,
        savedPlansWrite: true,
        reportsRead: true,
        reportsWrite: true,
        issueReportsRead: true,
        issueReportsWrite: true,
      },
      corsOrigins: ['*'],
      writeRateLimitWindowMs: 60000,
      writeRateLimitMax: 120,
    })
    expect(service.getSyncStatus).not.toHaveBeenCalled()
  })

  it('advertises restricted and ephemeral production capabilities', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig({
        mode: 'issue-upload-only',
        durability: 'ephemeral',
      }),
    )
    const res = createMockResponse()

    await middleware(
      {
        method: 'GET',
        url: '/api/sync/health',
      } as never,
      res.response as never,
    )

    expect(JSON.parse(res.body())).toMatchObject({
      mode: 'issue-upload-only',
      durability: 'ephemeral',
      capabilities: {
        savedPlansRead: false,
        savedPlansWrite: false,
        reportsRead: false,
        reportsWrite: false,
        issueReportsRead: false,
        issueReportsWrite: true,
      },
    })
  })

  it('serves readiness with the scoped sync status snapshot', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig(),
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/sync/ready?scope=alpha',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    const payload = JSON.parse(res.body())
    expect(res.response.statusCode).toBe(200)
    expect(payload.status).toBe('ok')
    expect(payload.snapshot).toMatchObject({
      scope: 'alpha',
      issueReportsCount: 4,
    })
    expect(service.getSyncStatus).toHaveBeenCalledWith('alpha')
  })

  it('marks readiness degraded when storage config is invalid', async () => {
    const service = createMockService()
    const middleware = createSyncServiceMiddleware(
      service,
      '/api/sync',
      'default',
      createConfig({ storageFile: ' ' }),
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/sync/ready',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    const payload = JSON.parse(res.body())
    expect(res.response.statusCode).toBe(503)
    expect(payload.status).toBe('degraded')
    expect(payload.issues).toContain('storage file is empty')
    expect(service.getSyncStatus).not.toHaveBeenCalled()
  })
})
