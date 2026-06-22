import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CACHE_FILE,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_PRIMARY_URL,
  DEFAULT_PROXY_PATH,
  DEFAULT_PROXY_PORT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  resolveRoutingProxyConfig,
} from './routingProxyConfig'

describe('routingProxyConfig', () => {
  it('builds config from env and omits duplicate fallback endpoints', () => {
    const config = resolveRoutingProxyConfig(
      {
        PARKKING_ROUTING_PRIMARY_URL: 'https://primary.example.com',
        PARKKING_ROUTING_FALLBACK_URL: 'https://primary.example.com',
        PARKKING_ROUTING_CACHE_TTL_MS: '1234',
        PARKKING_ROUTING_REQUEST_TIMEOUT_MS: '4567',
        PARKKING_ROUTING_CACHE_FILE: '.tmp/custom-cache.json',
        PARKKING_ROUTING_USER_AGENT: ' ParkKing test ',
        PARKKING_ROUTING_PATH: ' /custom/route ',
        PARKKING_ROUTING_PORT: '9999',
      },
      'C:\\workspace',
    )

    expect(config).toEqual({
      primary: { endpoint: 'https://primary.example.com' },
      fallback: null,
      cacheTtlMs: 1234,
      requestTimeoutMs: 4567,
      cacheFile: 'C:\\workspace\\.tmp\\custom-cache.json',
      userAgent: 'ParkKing test',
      path: '/custom/route',
      port: 9999,
    })
  })

  it('falls back to defaults when env values are blank or invalid', () => {
    const config = resolveRoutingProxyConfig(
      {
        PARKKING_ROUTING_PRIMARY_URL: '   ',
        PARKKING_ROUTING_FALLBACK_URL: '   ',
        PARKKING_ROUTING_CACHE_TTL_MS: '0',
        PARKKING_ROUTING_REQUEST_TIMEOUT_MS: '0',
        PARKKING_ROUTING_USER_AGENT: '   ',
        PARKKING_ROUTING_PATH: '   ',
        PARKKING_ROUTING_PORT: '-1',
      },
      'C:\\workspace',
    )

    expect(config.primary.endpoint).toBe(DEFAULT_PRIMARY_URL)
    expect(config.fallback).toBeNull()
    expect(config.cacheTtlMs).toBe(DEFAULT_CACHE_TTL_MS)
    expect(config.requestTimeoutMs).toBe(DEFAULT_REQUEST_TIMEOUT_MS)
    expect(config.cacheFile).toBe(`C:\\workspace\\${DEFAULT_CACHE_FILE.replace(/\//g, '\\')}`)
    expect(config.userAgent).toBe(DEFAULT_USER_AGENT)
    expect(config.path).toBe(DEFAULT_PROXY_PATH)
    expect(config.port).toBe(DEFAULT_PROXY_PORT)
  })
})
