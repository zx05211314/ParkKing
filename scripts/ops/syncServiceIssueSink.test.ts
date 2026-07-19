import { describe, expect, it, vi } from 'vitest'
import {
  createSyncIssueSink,
  SyncIssueSinkDeliveryError,
  validateSyncIssueSinkConfig,
} from './syncServiceIssueSink'
import type { SyncServiceConfig } from './syncServiceTypes'

const createConfig = (
  overrides: Partial<SyncServiceConfig> = {},
): SyncServiceConfig => ({
  path: '/api/sync',
  port: 8789,
  storageFile: 'sync.json',
  defaultScope: 'default',
  durability: 'ephemeral',
  issueSinkTimeoutMs: 5000,
  ...overrides,
})

describe('syncServiceIssueSink', () => {
  it('reports the configured local durability when no sink exists', async () => {
    const sink = createSyncIssueSink(createConfig())

    await expect(sink({ issueId: 'issue-a' }, 'alpha')).resolves.toEqual({
      configured: false,
      delivered: false,
      durability: 'ephemeral',
    })
  })

  it('delivers a versioned envelope with authentication and idempotency', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 202 }),
    )
    const sink = createSyncIssueSink(
      createConfig({
        issueSinkUrl: 'https://issues.parkking.test/intake',
        issueSinkBearerToken: 'secret',
      }),
      fetchImpl,
    )

    await expect(
      sink({ issueId: 'issue-a', summary: 'curb mismatch' }, 'alpha'),
    ).resolves.toEqual({
      configured: true,
      delivered: true,
      durability: 'external',
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://issues.parkking.test/intake')
    expect(init?.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer secret',
        'Idempotency-Key': expect.stringMatching(/^parkking-[a-f0-9]{64}$/),
      }),
    )
    expect(JSON.parse(String(init?.body))).toMatchObject({
      schemaVersion: 1,
      source: 'parkking-sync',
      scope: 'alpha',
      receivedAt: expect.any(String),
      issue: {
        issueId: 'issue-a',
        summary: 'curb mismatch',
      },
    })
  })

  it('fails closed when the durable sink rejects a report', async () => {
    const sink = createSyncIssueSink(
      createConfig({
        issueSinkUrl: 'https://issues.parkking.test/intake',
      }),
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('temporarily unavailable', { status: 503 }),
      ),
    )

    await expect(sink({ issueId: 'issue-a' })).rejects.toBeInstanceOf(
      SyncIssueSinkDeliveryError,
    )
  })

  it('rejects unsupported sink URL protocols in readiness validation', () => {
    expect(
      validateSyncIssueSinkConfig(
        createConfig({ issueSinkUrl: 'file:///tmp/issues.json' }),
      ),
    ).toBe('Issue sink URL must use http or https.')
  })

  it('times out an unresponsive durable sink', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )
    const sink = createSyncIssueSink(
      createConfig({
        issueSinkUrl: 'https://issues.parkking.test/intake',
        issueSinkTimeoutMs: 1,
      }),
      fetchImpl,
    )

    await expect(sink({ issueId: 'issue-timeout' })).rejects.toThrow(
      'timed out after 1 ms',
    )
  })
})
