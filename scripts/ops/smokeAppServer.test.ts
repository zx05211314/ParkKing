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
      ]),
    ).toEqual({
      timeoutMs: 1234,
      skipParkingAnswer: true,
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
