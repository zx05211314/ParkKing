import { describe, expect, it, vi } from 'vitest'
import {
  handleSyncBootstrapRequest,
  handleSyncIssueReportsRequest,
  handleSyncReportsRequest,
} from './syncServiceRequestHandlers'
import type { SyncService } from './syncServiceTypes'

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
  getSyncStatus: vi.fn(),
  getSavedPlansState: vi.fn(),
  getSavedPlans: vi.fn(),
  replaceSavedPlans: vi.fn(),
  getReportsState: vi.fn().mockResolvedValue({ reports: [], revision: 0 }),
  getReports: vi.fn(),
  getIssueReportsState: vi.fn().mockResolvedValue({ issues: [], revision: 0 }),
  getIssueReports: vi.fn(),
  getBootstrapState: vi.fn().mockResolvedValue({
    plans: [{ key: 'plan-a' }],
    reports: [{ districtId: 'xinyi' }],
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

describe('syncServiceRequestHandlers', () => {
  it('passes normalized bootstrap resources through to the service', async () => {
    const service = createMockService()
    const res = createMockResponse()

    await expect(
      handleSyncBootstrapRequest({
        req: {
          method: 'GET',
        } as never,
        res: res.response as never,
        service,
        scope: 'alpha',
        url: new URL(
          'http://localhost/api/sync/bootstrap?include=savedPlans,reports&include=savedPlans',
        ),
      }),
    ).resolves.toBe(true)

    expect(service.getBootstrapState).toHaveBeenCalledWith('alpha', [
      'savedPlans',
      'reports',
    ])
    expect(res.response.statusCode).toBe(200)
  })

  it('appends reports for post requests', async () => {
    const service = createMockService()
    const res = createMockResponse()

    async function* body() {
      yield Buffer.from(JSON.stringify({ report: { districtId: 'daan' } }))
    }

    await expect(
      handleSyncReportsRequest({
        req: {
          method: 'POST',
          [Symbol.asyncIterator]: body,
        } as never,
        res: res.response as never,
        service,
        scope: 'alpha',
        url: new URL('http://localhost/api/sync/reports'),
      }),
    ).resolves.toBe(true)

    expect(service.appendReport).toHaveBeenCalledWith({ districtId: 'daan' }, 'alpha')
    expect(res.response.statusCode).toBe(201)
    expect(res.body()).toContain('"districtId":"xinyi"')
  })

  it('appends issue reports for post requests', async () => {
    const service = createMockService()
    const res = createMockResponse()

    async function* body() {
      yield Buffer.from(JSON.stringify({ issue: { issueId: 'issue-b' } }))
    }

    await expect(
      handleSyncIssueReportsRequest({
        req: {
          method: 'POST',
          [Symbol.asyncIterator]: body,
        } as never,
        res: res.response as never,
        service,
        scope: 'alpha',
        url: new URL('http://localhost/api/sync/issues'),
      }),
    ).resolves.toBe(true)

    expect(service.appendIssueReport).toHaveBeenCalledWith(
      { issueId: 'issue-b' },
      'alpha',
    )
    expect(res.response.statusCode).toBe(201)
    expect(res.body()).toContain('"issueId":"issue-a"')
  })
})
