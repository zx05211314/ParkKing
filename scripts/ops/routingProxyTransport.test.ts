import { describe, expect, it, vi } from 'vitest'
import { requestRoutingPath } from './routingProxyTransport'

describe('requestRoutingPath', () => {
  it('falls back across providers and preserves no-route payloads', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          code: 'NoRoute',
        }),
      })

    await expect(
      requestRoutingPath(
        [
          { endpoint: 'https://primary.example.com' },
          { endpoint: 'https://fallback.example.com' },
        ],
        {
          profile: 'walking',
          origin: [121.5645, 25.0338],
          destination: [121.565, 25.034],
        },
        fetchImpl,
        'ParkKing test',
      ),
    ).resolves.toEqual({
      destination: [121.565, 25.034],
      distanceMeters: null,
      durationSeconds: null,
      estimated: false,
      geometry: null,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[1][0]).toContain('fallback.example.com')
  })
})
