import { describe, expect, it, vi } from 'vitest'
import { handleSyncBootstrapRequest } from './syncServiceBootstrapHandlers'
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
  getReportsState: vi.fn(),
  getReports: vi.fn(),
  getIssueReportsState: vi.fn(),
  getIssueReports: vi.fn(),
  getBootstrapState: vi.fn().mockResolvedValue({ plans: [], reports: [] }),
  appendReport: vi.fn(),
  appendIssueReport: vi.fn(),
})

describe('syncServiceBootstrapHandlers', () => {
  it('passes normalized bootstrap resources through to the service', async () => {
    const service = createMockService()
    const res = createMockResponse()

    await expect(
      handleSyncBootstrapRequest({
        req: { method: 'GET' } as never,
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
  })
})
