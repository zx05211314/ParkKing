import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import {
  parseSmokeApiServicesArgs,
  renderSmokeApiServicesSummary,
  runSyncIssueReportRoundtrip,
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
      syncIssueRoundtrip: false,
      requireDurableIssueSink: false,
    })
  })

  it('parses sync issue-report roundtrip smoke mode', () => {
    expect(
      parseSmokeApiServicesArgs([
        'node',
        'script',
        '--services',
        'sync',
        '--sync-issue-roundtrip',
      ]),
    ).toMatchObject({
      services: ['sync'],
      syncIssueRoundtrip: true,
    })
  })

  it('parses durable issue sink acceptance mode', () => {
    expect(
      parseSmokeApiServicesArgs([
        'node',
        'script',
        '--services',
        'sync',
        '--sync-issue-roundtrip',
        '--require-durable-issue-sink',
      ]),
    ).toMatchObject({
      syncIssueRoundtrip: true,
      requireDurableIssueSink: true,
    })
  })

  it('requires an issue roundtrip when durable intake is required', () => {
    expect(() =>
      parseSmokeApiServicesArgs([
        'node',
        'script',
        '--require-durable-issue-sink',
      ]),
    ).toThrow(
      '--require-durable-issue-sink requires --sync-issue-roundtrip',
    )
  })

  it('rejects issue-report roundtrip mode when sync is not selected', () => {
    expect(() =>
      parseSmokeApiServicesArgs([
        'node',
        'script',
        '--services',
        'geocode',
        '--sync-issue-roundtrip',
      ]),
    ).toThrow('--sync-issue-roundtrip requires the sync service')
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
        actions: [],
      }),
    ).toContain('parking-answer/ready: FAIL http=503 status=degraded')
  })

  it('renders issue-report roundtrip action failures', () => {
    expect(
      renderSmokeApiServicesSummary({
        passed: 2,
        failed: 1,
        results: [
          {
            service: 'sync',
            suffix: 'health',
            url: 'http://localhost/api/sync/health',
            status: 200,
            ok: true,
            serviceStatus: 'ok',
          },
          {
            service: 'sync',
            suffix: 'ready',
            url: 'http://localhost/api/sync/ready',
            status: 200,
            ok: true,
            serviceStatus: 'ok',
          },
        ],
        actions: [
          {
            service: 'sync',
            action: 'issue-report-roundtrip',
            url: 'http://localhost/api/sync/issues?scope=smoke',
            status: 400,
            ok: false,
            detail: 'POST failed',
          },
        ],
      }),
    ).toContain('sync/issue-report-roundtrip: FAIL http=400 detail=POST failed')
  })

  it('confirms issue uploads through non-content status metadata', async () => {
    const issues: unknown[] = []
    const server = createServer((req, res) => {
      void (async () => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (
          url.pathname !== '/api/sync/issues' &&
          url.pathname !== '/api/sync/status'
        ) {
          res.statusCode = 404
          res.end('Not found')
          return
        }

        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk))
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as {
            issue?: unknown
          }
          issues.push(body.issue)
          res.setHeader('content-type', 'application/json')
          res.statusCode = 201
          res.end(
            JSON.stringify({
              issue: body.issue,
              revision: issues.length,
              durable: true,
              durability: 'external',
            }),
          )
          return
        }

        if (url.pathname === '/api/sync/status' && req.method === 'GET') {
          res.setHeader('content-type', 'application/json')
          res.statusCode = 200
          res.end(
            JSON.stringify({
              issueReportsCount: issues.length,
              issueReportsRevision: issues.length,
            }),
          )
          return
        }

        res.statusCode = 405
        res.end('Method not allowed')
      })()
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address() as AddressInfo

    try {
      const result = await runSyncIssueReportRoundtrip({
        url: new URL(
          `http://127.0.0.1:${address.port}/api/sync/issues?scope=test`,
        ),
        timeoutMs: 2_000,
        issueId: 'smoke-sync-issue-test',
        createdAt: '2026-04-02T00:00:00.000Z',
        requireDurable: true,
      })

      expect(result).toMatchObject({
        service: 'sync',
        action: 'issue-report-roundtrip',
        status: 200,
        ok: true,
        durable: true,
        durability: 'external',
      })
      expect(issues).toEqual([
        expect.objectContaining({
          schemaVersion: 1,
          issueId: 'smoke-sync-issue-test',
          districtId: 'xinyi',
          summary: 'Smoke sync issue report roundtrip',
        }),
      ])
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
    }
  })
})
