import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEndpointUrl,
  fetchJson,
  getApiErrorMessage,
  normalizeOptionalText,
  resolveLocalhostProxyEndpoint,
} from './client'

describe('api client helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    const globalRef = globalThis as Record<string, unknown>
    if ('window' in globalRef) {
      delete globalRef.window
    }
  })

  it('normalizes optional env text values', () => {
    expect(normalizeOptionalText('  /api/test  ')).toBe('/api/test')
    expect(normalizeOptionalText('')).toBeNull()
    expect(normalizeOptionalText(null)).toBeNull()
  })

  it('resolves localhost proxy endpoints only on localhost hosts', () => {
    ;(globalThis as { window?: { location: { hostname: string } } }).window = {
      location: { hostname: 'localhost' },
    }
    expect(resolveLocalhostProxyEndpoint('/api/test')).toBe('/api/test')

    window.location.hostname = 'parkking.example.com'
    expect(resolveLocalhostProxyEndpoint('/api/test')).toBeNull()
  })

  it('creates absolute endpoint urls from relative paths', () => {
    ;(globalThis as { window?: { location: { origin: string; hostname: string } } }).window = {
      location: {
        origin: 'https://parkking.example.com',
        hostname: 'parkking.example.com',
      },
    }

    expect(createEndpointUrl('/api/test').toString()).toBe(
      'https://parkking.example.com/api/test',
    )
    expect(createEndpointUrl('https://api.parkking.test/data').toString()).toBe(
      'https://api.parkking.test/data',
    )
  })

  it('fetches json with default accept headers and preserves payload', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toEqual(
        expect.objectContaining({
          Accept: 'application/json',
        }),
      )
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }) as unknown as typeof fetch

    await expect(fetchJson('https://api.parkking.test/data', { fetchImpl })).resolves.toEqual(
      expect.objectContaining({
        payload: {
          ok: true,
        },
      }),
    )
  })

  it('extracts api error messages from json payloads', () => {
    expect(getApiErrorMessage({ error: 'Upstream unavailable' }, 'fallback')).toBe(
      'Upstream unavailable',
    )
    expect(getApiErrorMessage({ message: 'ignored' }, 'fallback')).toBe('fallback')
  })
})
