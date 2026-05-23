import { describe, expect, it } from 'vitest'
import {
  parseSmokeApiServicesArgs,
  renderSmokeApiServicesSummary,
} from './smokeApiServices'

describe('smokeApiServices', () => {
  it('parses selected services and a mounted base URL', () => {
    expect(
      parseSmokeApiServicesArgs([
        'node',
        'script',
        '--services',
        'geocode,sync',
        '--base-url',
        'http://localhost:4173',
        '--timeout-ms',
        '25000',
      ]),
    ).toEqual({
      services: ['geocode', 'sync'],
      baseUrl: 'http://localhost:4173',
      timeoutMs: 25000,
      startPreview: false,
      previewPort: undefined,
    })
  })

  it('rejects unknown services', () => {
    expect(() =>
      parseSmokeApiServicesArgs([
        'node',
        'script',
        '--services',
        'geocode,unknown',
      ]),
    ).toThrow('Unknown services: unknown')
  })

  it('rejects conflicting mounted and preview modes', () => {
    expect(() =>
      parseSmokeApiServicesArgs([
        'node',
        'script',
        '--base-url',
        'http://localhost:4173',
        '--start-preview',
      ]),
    ).toThrow('--base-url and --start-preview cannot be combined')
  })

  it('renders probe failures with HTTP and service status', () => {
    expect(
      renderSmokeApiServicesSummary({
        passed: 1,
        failed: 1,
        results: [
          {
            service: 'geocode',
            suffix: 'health',
            url: 'http://localhost/api/geocode/health',
            status: 200,
            ok: true,
            serviceStatus: 'ok',
          },
          {
            service: 'parking-answer',
            suffix: 'ready',
            url: 'http://localhost/api/parking-answer/ready',
            status: 503,
            ok: false,
            serviceStatus: 'degraded',
          },
        ],
      }),
    ).toContain('parking-answer/ready: FAIL http=503 status=degraded')
  })
})
