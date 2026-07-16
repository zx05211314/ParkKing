import * as fs from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import {
  resolveParkKingAppServerConfig,
  startParkKingAppServer,
  type ParkKingAppMiddleware,
  type ParkKingAppServerConfig,
} from './appServer'

const servers: Server[] = []

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

const makeStaticDir = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'parkking-app-server-'))
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true })
  await fs.writeFile(path.join(dir, 'index.html'), '<main>ParkKing app</main>')
  await fs.writeFile(path.join(dir, 'assets', 'app.js'), 'console.log("ok")')
  return dir
}

const startTestServer = async (
  config: ParkKingAppServerConfig,
  middlewares: ParkKingAppMiddleware[] = [],
) => {
  const server = startParkKingAppServer({ config, middlewares })
  servers.push(server)
  await new Promise<void>((resolve) => server.on('listening', () => resolve()))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind to a TCP address')
  }
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        }),
    ),
  )
})

describe('resolveParkKingAppServerConfig', () => {
  it('uses PORT and app env overrides for deploy entrypoint config', () => {
    const config = resolveParkKingAppServerConfig(
      {
        PORT: '9000',
        PARKKING_APP_STATIC_DIR: 'build-output',
        PARKKING_APP_HOST: '127.0.0.1',
        PARKKING_APP_ENABLE_SYNC: 'false',
        PARKKING_APP_ENABLE_ROUTING: '0',
        PARKKING_APP_HEALTH_PATH: 'healthz',
      },
      'C:/repo',
    )

    expect(config.port).toBe(9000)
    expect(config.host).toBe('127.0.0.1')
    expect(config.staticDir).toBe(path.resolve('C:/repo', 'build-output'))
    expect(config.healthPath).toBe('/healthz')
    expect(config.api.geocoder).toBe(true)
    expect(config.api.routing).toBe(false)
    expect(config.api.parkingAnswer).toBe(true)
    expect(config.api.sync).toBe(false)
  })

  it('treats an empty app port override as unset so platform PORT still works', () => {
    const config = resolveParkKingAppServerConfig({
      PORT: '10000',
      PARKKING_APP_PORT: '',
    })

    expect(config.port).toBe(10000)
  })
})

describe('ParkKing app server', () => {
  it('serves static assets and falls back to index for SPA routes', async () => {
    const staticDir = await makeStaticDir()
    const baseUrl = await startTestServer(baseConfig(staticDir))

    await expect(fetch(`${baseUrl}/assets/app.js`).then((res) => res.text())).resolves.toBe(
      'console.log("ok")',
    )
    const spaResponse = await fetch(`${baseUrl}/district/xinyi`)
    await expect(spaResponse.text()).resolves.toBe('<main>ParkKing app</main>')
    expect(spaResponse.headers.get('content-type')).toContain('text/html')
  })

  it('streams precompressed GeoJSON when the client accepts gzip', async () => {
    const staticDir = await makeStaticDir()
    const dataDir = path.join(staticDir, 'data')
    const body = JSON.stringify({
      type: 'FeatureCollection',
      features: Array.from({ length: 500 }, () => ({ type: 'Feature' })),
    })
    const filePath = path.join(dataDir, 'parking_spaces.geojson')
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(filePath, body)
    await fs.writeFile(`${filePath}.gz`, gzipSync(body))
    const baseUrl = await startTestServer(baseConfig(staticDir))

    const response = await fetch(`${baseUrl}/data/parking_spaces.geojson`, {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    await expect(response.text()).resolves.toBe(body)
    expect(response.headers.get('content-encoding')).toBe('gzip')
    expect(response.headers.get('content-type')).toContain('application/geo+json')
    expect(response.headers.get('vary')).toBe('Accept-Encoding')
    expect(Number(response.headers.get('content-length'))).toBeLessThan(
      Buffer.byteLength(body),
    )
  })

  it('serves the original representation when gzip is explicitly disabled', async () => {
    const staticDir = await makeStaticDir()
    const dataDir = path.join(staticDir, 'data')
    const body = JSON.stringify({
      type: 'FeatureCollection',
      features: Array.from({ length: 500 }, () => ({ type: 'Feature' })),
    })
    const filePath = path.join(dataDir, 'parking_spaces.geojson')
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(filePath, body)
    await fs.writeFile(`${filePath}.gz`, gzipSync(body))
    const baseUrl = await startTestServer(baseConfig(staticDir))

    const response = await fetch(`${baseUrl}/data/parking_spaces.geojson`, {
      headers: { 'Accept-Encoding': 'gzip;q=0, identity' },
    })

    await expect(response.text()).resolves.toBe(body)
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(Number(response.headers.get('content-length'))).toBe(Buffer.byteLength(body))
  })

  it('does not hide unknown API routes behind the SPA fallback', async () => {
    const staticDir = await makeStaticDir()
    const baseUrl = await startTestServer(baseConfig(staticDir))

    const response = await fetch(`${baseUrl}/api/missing`)
    await expect(response.json()).resolves.toEqual({ error: 'API route not found.' })
    expect(response.status).toBe(404)
  })

  it('runs API middleware before static serving', async () => {
    const staticDir = await makeStaticDir()
    const middleware: ParkKingAppMiddleware = (req, res, next) => {
      if (req.url?.startsWith('/api/geocode')) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ handled: true }))
        return true
      }
      next?.()
      return false
    }
    const baseUrl = await startTestServer(baseConfig(staticDir), [middleware])

    const response = await fetch(`${baseUrl}/api/geocode?q=test`)
    await expect(response.json()).resolves.toEqual({ handled: true })
    expect(response.status).toBe(200)
  })

  it('reports readiness failure when the built index is missing', async () => {
    const staticDir = await mkdtemp(path.join(tmpdir(), 'parkking-empty-dist-'))
    const baseUrl = await startTestServer(baseConfig(staticDir))

    const response = await fetch(`${baseUrl}/api/app/ready`)
    const body = await response.json() as { status: string; issues: string[] }
    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.issues[0]).toContain('static index missing')
  })
})
