import * as fs from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ParkKingAppServerConfig } from './appServer'
import {
  parseSmokeAppServerArgs,
  renderSmokeAppServer,
  runSmokeAppServer,
} from './smokeAppServer'

const makeStaticDir = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'smoke-app-server-'))
  await fs.writeFile(path.join(dir, 'index.html'), '<div id="root"></div>')
  return dir
}

const baseConfig = (staticDir: string): ParkKingAppServerConfig => ({
  port: 0,
  host: '127.0.0.1',
  staticDir,
  spaFallback: true,
  healthPath: '/api/app/health',
  readyPath: '/api/app/ready',
  api: {
    geocoder: false,
    routing: false,
    parkingAnswer: false,
    sync: false,
  },
})

describe('parseSmokeAppServerArgs', () => {
  it('parses timeout and skip flags', () => {
    expect(
      parseSmokeAppServerArgs([
        '--timeout-ms',
        '1234',
        '--skip-parking-answer',
        '--include-api-services',
        '--api-services',
        'sync',
        '--sync-issue-roundtrip',
      ]),
    ).toEqual({
      timeoutMs: 1234,
      skipParkingAnswer: true,
      includeApiServices: true,
      apiServices: ['sync'],
      syncIssueRoundtrip: true,
    })
  })
})

describe('runSmokeAppServer', () => {
  it('probes app readiness, API 404 behavior, and static root serving', async () => {
    const staticDir = await makeStaticDir()
    const result = await runSmokeAppServer(
      { skipParkingAnswer: true },
      {
        config: baseConfig(staticDir),
        middlewares: [],
      },
    )

    expect(result.pass).toBe(true)
    expect(result.probes.map((probe) => probe.path)).toEqual([
      '/api/app/ready',
      '/api/not-found',
      '/',
    ])
  })

  it('requires parking-answer readiness metadata when probing the same-origin service', async () => {
    const staticDir = await makeStaticDir()
    const result = await runSmokeAppServer(
      {},
      {
        config: {
          ...baseConfig(staticDir),
          api: {
            geocoder: false,
            routing: false,
            parkingAnswer: true,
            sync: false,
          },
        },
        middlewares: [
          (req, res, next) => {
            if (req.url !== '/api/parking-answer/ready') {
              next?.()
              return false
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                status: 'ok',
                districts: [
                  {
                    district: 'xinyi',
                    ready: true,
                    datasetHash: 'hash-1',
                  },
                ],
              }),
            )
            return true
          },
        ],
      },
    )

    expect(result.pass).toBe(true)
    expect(result.probes.find((probe) => probe.path === '/api/parking-answer/ready')).toMatchObject({
      summary: 'ok; xinyi:hash-1',
    })
  })

  it('fails when parking-answer readiness lacks dataset hashes', async () => {
    const staticDir = await makeStaticDir()
    const result = await runSmokeAppServer(
      {},
      {
        config: {
          ...baseConfig(staticDir),
          api: {
            geocoder: false,
            routing: false,
            parkingAnswer: true,
            sync: false,
          },
        },
        middlewares: [
          (req, res, next) => {
            if (req.url !== '/api/parking-answer/ready') {
              next?.()
              return false
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                status: 'ok',
                districts: [
                  {
                    district: 'xinyi',
                    ready: true,
                  },
                ],
              }),
            )
            return true
          },
        ],
      },
    )

    expect(result.pass).toBe(false)
    expect(result.probes.find((probe) => probe.path === '/api/parking-answer/ready')).toMatchObject({
      error: 'ready districts missing datasetHash: xinyi',
    })
  })

  it('can run mounted API service probes before closing the app server', async () => {
    const staticDir = await makeStaticDir()
    const issues: unknown[] = []
    const result = await runSmokeAppServer(
      {
        skipParkingAnswer: true,
        includeApiServices: true,
        apiServices: ['sync'],
        syncIssueRoundtrip: true,
      },
      {
        config: {
          ...baseConfig(staticDir),
          api: {
            geocoder: false,
            routing: false,
            parkingAnswer: false,
            sync: true,
          },
        },
        middlewares: [
          async (req, res, next) => {
            const url = new URL(req.url ?? '/', 'http://localhost')
            if (!url.pathname.startsWith('/api/sync')) {
              next?.()
              return false
            }
            res.setHeader('Content-Type', 'application/json')
            if (url.pathname === '/api/sync/health' || url.pathname === '/api/sync/ready') {
              res.statusCode = 200
              res.end(JSON.stringify({ status: 'ok' }))
              return true
            }
            if (url.pathname === '/api/sync/issues' && req.method === 'POST') {
              const chunks: Buffer[] = []
              for await (const chunk of req) {
                chunks.push(Buffer.from(chunk))
              }
              const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as {
                issue?: unknown
              }
              issues.push(body.issue)
              res.statusCode = 201
              res.end(JSON.stringify({ issue: body.issue, revision: issues.length }))
              return true
            }
            if (url.pathname === '/api/sync/status' && req.method === 'GET') {
              res.statusCode = 200
              res.end(
                JSON.stringify({
                  issueReportsCount: issues.length,
                  issueReportsRevision: issues.length,
                }),
              )
              return true
            }
            next?.()
            return false
          },
        ],
      },
    )

    expect(result.pass).toBe(true)
    expect(result.apiServices).toMatchObject({
      failed: 0,
    })
    expect(renderSmokeAppServer(result)).toContain('Mounted API Services')
  })
})

describe('renderSmokeAppServer', () => {
  it('renders a markdown summary table', () => {
    expect(
      renderSmokeAppServer({
        pass: true,
        baseUrl: 'http://127.0.0.1:1',
        probes: [
          {
            path: '/api/app/ready',
            status: 200,
            pass: true,
            summary: 'ok',
            error: null,
          },
        ],
      }),
    ).toContain('# App Server Smoke: PASS')
  })
})
