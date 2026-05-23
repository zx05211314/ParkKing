import { describe, expect, it, vi } from 'vitest'
import { requestRoutingMatrix } from './routingProxyProviderRequests'

describe('requestRoutingMatrix', () => {
  it('falls back across providers and preserves no-table payloads', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          code: 'NoTable',
        }),
      })

    await expect(
      requestRoutingMatrix(
        [
          { endpoint: 'https://primary.example.com' },
          { endpoint: 'https://fallback.example.com' },
        ],
        {
          profile: 'walking',
          origin: [121.5645, 25.0338],
          destinations: [[121.565, 25.034]],
        },
        fetchImpl,
        'ParkKing test',
      ),
    ).resolves.toEqual([
      {
        destination: [121.565, 25.034],
        distanceMeters: null,
        durationSeconds: null,
        estimated: false,
      },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[1][0]).toContain('fallback.example.com')
  })
})
