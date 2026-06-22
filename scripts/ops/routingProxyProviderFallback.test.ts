import { describe, expect, it, vi } from 'vitest'
import { requestFromRoutingProviders } from './routingProxyProviderFallback'

describe('routingProxyProviderFallback', () => {
  it('falls back across providers until a normalized payload succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ ok: true, value: 42 }),
      })

    await expect(
      requestFromRoutingProviders({
        providers: [
          { endpoint: 'https://primary.example.com' },
          { endpoint: 'https://fallback.example.com' },
        ],
        fetchImpl,
        userAgent: 'ParkKing test',
        requestTimeoutMs: 8000,
        buildUrl: (provider) => `${provider.endpoint}/table`,
        normalize: (_status, payload) =>
          (payload as { ok?: boolean; value?: number }).ok
            ? { value: (payload as { value: number }).value }
            : null,
      }),
    ).resolves.toEqual({ value: 42 })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[1][0]).toContain('fallback.example.com')
  })

  it('throws the last upstream error when all providers fail', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 503,
      json: async () => ({ message: 'temporarily unavailable' }),
    })

    await expect(
      requestFromRoutingProviders({
        providers: [
          { endpoint: 'https://primary.example.com' },
          { endpoint: 'https://fallback.example.com' },
        ],
        fetchImpl,
        userAgent: 'ParkKing test',
        requestTimeoutMs: 8000,
        buildUrl: (provider) => `${provider.endpoint}/table`,
        normalize: () => null,
      }),
    ).rejects.toThrow('temporarily unavailable')
  })
})
