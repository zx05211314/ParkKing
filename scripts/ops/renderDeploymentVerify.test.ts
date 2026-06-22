import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import {
  parseRenderDeploymentVerifyArgs,
  renderRenderDeploymentVerify,
  verifyRenderDeployment,
  writeRenderDeploymentVerifyOutputs,
} from './renderDeploymentVerify'

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const startJsonServer = async (
  parkingReadyPayload: unknown,
  parkingReadyStatus = 200,
  options: {
    failApiPaths?: string[]
    allowUntrustedSyncCors?: boolean
    omitProxyTimeouts?: boolean
  } = {},
) => {
  const issues: unknown[] = []
  const failApiPaths = new Set(options.failApiPaths ?? [])
  const sendJson = (
    response: http.ServerResponse,
    responseStatus: number,
    body: unknown,
  ) => {
    response.statusCode = responseStatus
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(body))
  }
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (failApiPaths.has(url.pathname)) {
      sendJson(response, 503, { status: 'error' })
      return
    }
    if (url.pathname === '/api/parking-answer/ready') {
      sendJson(response, parkingReadyStatus, parkingReadyPayload)
      return
    }
    if (['/api/geocode/health', '/api/geocode/ready'].includes(url.pathname)) {
      sendJson(response, 200, {
        status: 'ok',
        ...(options.omitProxyTimeouts ? {} : { requestTimeoutMs: 5000 }),
      })
      return
    }
    if (['/api/route/health', '/api/route/ready'].includes(url.pathname)) {
      sendJson(response, 200, {
        status: 'ok',
        ...(options.omitProxyTimeouts ? {} : { requestTimeoutMs: 8000 }),
      })
      return
    }
    if (
      ['/api/sync/health', '/api/sync/ready', '/api/parking-answer/health'].includes(
        url.pathname,
      )
    ) {
      sendJson(response, 200, { status: 'ok' })
      return
    }
    if (url.pathname === '/api/sync/issues' && request.method === 'POST') {
      const chunks: Buffer[] = []
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk))
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as {
        issue?: unknown
      }
      issues.push(body.issue)
      sendJson(response, 201, { issue: body.issue, revision: issues.length })
      return
    }
    if (url.pathname === '/api/sync/issues' && request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      if (options.allowUntrustedSyncCors) {
        response.setHeader('Access-Control-Allow-Origin', '*')
        response.statusCode = 204
        response.end()
        return
      }
      sendJson(response, 403, {
        error: 'Origin is not allowed by sync service CORS policy.',
      })
      return
    }
    if (url.pathname === '/api/sync/issues' && request.method === 'GET') {
      sendJson(response, 200, { issues, revision: issues.length })
      return
    }
    response.statusCode = 404
    response.end('not found')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

describe('renderDeploymentVerify', () => {
  it('parses CLI args', () => {
    expect(
      parseRenderDeploymentVerifyArgs([
        'node',
        'renderDeploymentVerify.ts',
        '--app-url',
        'https://parkking.onrender.com',
        '--handoff-json',
        '.tmp/handoff.json',
        '--manifest-url',
        'https://example.test/release_manifest.json',
        '--timeout-ms',
        '1000',
        '--skip-api-services',
        '--api-services',
        'geocode,routing',
        '--skip-sync-issue-roundtrip',
        '--skip-sync-cors-check',
        '--out',
        '.tmp/verify.md',
        '--json-out',
        '.tmp/verify.json',
      ]),
    ).toMatchObject({
      appUrl: 'https://parkking.onrender.com',
      handoffJsonPath: '.tmp/handoff.json',
      manifestUrl: 'https://example.test/release_manifest.json',
      timeoutMs: 1000,
      skipApiServices: true,
      apiServices: ['geocode', 'routing'],
      syncIssueRoundtrip: false,
      syncCorsCheck: false,
      outPath: '.tmp/verify.md',
      jsonOutPath: '.tmp/verify.json',
    })
  })

  it('keeps the npm shortcut from forcing local handoff mode', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(path.resolve('package.json'), 'utf-8'),
    ) as { scripts?: Record<string, string> }
    const script = packageJson.scripts?.['ops:render-deployment-verify'] ?? ''

    expect(script).toContain('scripts/ops/renderDeploymentVerify.ts')
    expect(script).not.toContain('--handoff-json')
  })

  it('passes when live readiness matches the handoff dataset hashes', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-verify-'))
    const handoffPath = path.join(base, 'handoff.json')
    await writeJson(handoffPath, {
      ready: true,
      release: {
        releaseId: 'release-a',
        tag: 'data-release-a',
      },
      expectedDatasets: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-xinyi',
        },
      ],
    })
    const server = await startJsonServer({
      status: 'ok',
      districts: [
        {
          district: 'xinyi',
          ready: true,
          datasetHash: 'hash-xinyi',
          latestDatasetHash: 'hash-xinyi',
        },
      ],
    })

    try {
      const result = await verifyRenderDeployment({
        appUrl: server.baseUrl,
        handoffJsonPath: handoffPath,
        timeoutMs: 1000,
      })

      expect(result.pass).toBe(true)
      expect(result.apiServices).toMatchObject({ failed: 0 })
      expect(result.remediation).toBeNull()
      expect(result.syncCors).toMatchObject({ pass: true, status: 403 })
      expect(result.proxyRuntime).toEqual([
        expect.objectContaining({
          service: 'geocode',
          pass: true,
          requestTimeoutMs: 5000,
        }),
        expect.objectContaining({
          service: 'routing',
          pass: true,
          requestTimeoutMs: 8000,
        }),
      ])
      expect(renderRenderDeploymentVerify(result)).toContain(
        '# Render Deployment Verify: PASS',
      )
      expect(renderRenderDeploymentVerify(result)).toContain('Mounted API Services')
      expect(renderRenderDeploymentVerify(result)).toContain('## Sync CORS')
      expect(renderRenderDeploymentVerify(result)).toContain('## Proxy Runtime Config')
    } finally {
      await server.close()
    }
  })

  it('fails when a live district serves a different dataset hash', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-verify-fail-'))
    const handoffPath = path.join(base, 'handoff.json')
    await writeJson(handoffPath, {
      ready: true,
      expectedDatasets: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-expected',
        },
      ],
    })
    const server = await startJsonServer({
      status: 'ok',
      districts: [
        {
          district: 'xinyi',
          ready: true,
          datasetHash: 'hash-live',
          latestDatasetHash: 'hash-live',
        },
      ],
    })

    try {
      const result = await verifyRenderDeployment({
        appUrl: server.baseUrl,
        handoffJsonPath: handoffPath,
        timeoutMs: 1000,
      })

      expect(result.pass).toBe(false)
      expect(result.districts[0]?.errors.join('\n')).toContain(
        'does not match expected hash-expected',
      )
    } finally {
      await server.close()
    }
  })

  it('fails when mounted live API service probes fail', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-verify-api-fail-'))
    const handoffPath = path.join(base, 'handoff.json')
    await writeJson(handoffPath, {
      ready: true,
      expectedDatasets: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-xinyi',
        },
      ],
    })
    const server = await startJsonServer(
      {
        status: 'ok',
        districts: [
          {
            district: 'xinyi',
            ready: true,
            datasetHash: 'hash-xinyi',
            latestDatasetHash: 'hash-xinyi',
          },
        ],
      },
      200,
      { failApiPaths: ['/api/route/ready'] },
    )

    try {
      const result = await verifyRenderDeployment({
        appUrl: server.baseUrl,
        handoffJsonPath: handoffPath,
        timeoutMs: 1000,
      })

      expect(result.pass).toBe(false)
      expect(result.apiServices?.failed).toBe(1)
      expect(result.errors.join('\n')).toContain('mounted API service smoke failed')
    } finally {
      await server.close()
    }
  })

  it('fails when live sync CORS allows an untrusted origin', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-verify-cors-fail-'))
    const handoffPath = path.join(base, 'handoff.json')
    await writeJson(handoffPath, {
      ready: true,
      expectedDatasets: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-xinyi',
        },
      ],
    })
    const server = await startJsonServer(
      {
        status: 'ok',
        districts: [
          {
            district: 'xinyi',
            ready: true,
            datasetHash: 'hash-xinyi',
            latestDatasetHash: 'hash-xinyi',
          },
        ],
      },
      200,
      { allowUntrustedSyncCors: true },
    )

    try {
      const result = await verifyRenderDeployment({
        appUrl: server.baseUrl,
        handoffJsonPath: handoffPath,
        timeoutMs: 1000,
      })

      expect(result.pass).toBe(false)
      expect(result.syncCors).toMatchObject({
        pass: false,
        status: 204,
        allowOrigin: '*',
      })
      expect(result.errors.join('\n')).toContain('sync CORS smoke failed')
      expect(result.remediation).toMatchObject({
        requiredRenderEnv: {
          PARKKING_SYNC_CORS_ORIGINS: 'https://parkking.onrender.com',
        },
      })
      expect(result.remediation?.verifyCommand).toContain('--handoff-json')
      const rendered = renderRenderDeploymentVerify(result)
      expect(rendered).toContain('## Runtime Remediation')
      expect(rendered).toContain(
        'PARKKING_SYNC_CORS_ORIGINS=https://parkking.onrender.com',
      )
    } finally {
      await server.close()
    }
  })

  it('fails when live proxy readiness omits request timeouts', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-verify-timeout-fail-'))
    const handoffPath = path.join(base, 'handoff.json')
    await writeJson(handoffPath, {
      ready: true,
      expectedDatasets: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-xinyi',
        },
      ],
    })
    const server = await startJsonServer(
      {
        status: 'ok',
        districts: [
          {
            district: 'xinyi',
            ready: true,
            datasetHash: 'hash-xinyi',
            latestDatasetHash: 'hash-xinyi',
          },
        ],
      },
      200,
      { omitProxyTimeouts: true },
    )

    try {
      const result = await verifyRenderDeployment({
        appUrl: server.baseUrl,
        handoffJsonPath: handoffPath,
        timeoutMs: 1000,
      })

      expect(result.pass).toBe(false)
      expect(result.proxyRuntime?.map((entry) => entry.pass)).toEqual([
        false,
        false,
      ])
      expect(result.errors.join('\n')).toContain(
        'proxy runtime config smoke failed',
      )
      expect(result.remediation?.requiredRenderEnv).toMatchObject({
        PARKKING_GEOCODER_REQUEST_TIMEOUT_MS: '5000',
        PARKKING_ROUTING_REQUEST_TIMEOUT_MS: '8000',
      })
      const rendered = renderRenderDeploymentVerify(result)
      expect(rendered).toContain('## Runtime Remediation')
      expect(rendered).toContain('PARKKING_GEOCODER_REQUEST_TIMEOUT_MS=5000')
      expect(rendered).toContain('PARKKING_ROUTING_REQUEST_TIMEOUT_MS=8000')
    } finally {
      await server.close()
    }
  })

  it('can verify against a release manifest contract without a handoff file', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-verify-manifest-'))
    const manifestPath = path.join(base, 'release_manifest.json')
    await writeJson(manifestPath, {
      releaseId: 'release-a',
      districts: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-xinyi',
          publishedAt: '2026-05-01T00:00:00Z',
        },
      ],
      files: [],
    })
    const server = await startJsonServer({
      status: 'ok',
      districts: [
        {
          district: 'xinyi',
          ready: true,
          datasetHash: 'hash-xinyi',
          latestDatasetHash: 'hash-xinyi',
        },
      ],
    })

    try {
      const result = await verifyRenderDeployment({
        appUrl: server.baseUrl,
        manifestPath,
        timeoutMs: 1000,
      })

      expect(result.pass).toBe(true)
      expect(result.contractSource).toBe(path.resolve(manifestPath))
      expect(result.releaseId).toBe('release-a')
    } finally {
      await server.close()
    }
  })

  it('does not run sync roundtrip when selected API services exclude sync', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-verify-geocode-'))
    const manifestPath = path.join(base, 'release_manifest.json')
    await writeJson(manifestPath, {
      releaseId: 'release-a',
      districts: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-xinyi',
          publishedAt: '2026-05-01T00:00:00Z',
        },
      ],
      files: [],
    })
    const server = await startJsonServer({
      status: 'ok',
      districts: [
        {
          district: 'xinyi',
          ready: true,
          datasetHash: 'hash-xinyi',
          latestDatasetHash: 'hash-xinyi',
        },
      ],
    })

    try {
      const result = await verifyRenderDeployment({
        appUrl: server.baseUrl,
        manifestPath,
        timeoutMs: 1000,
        apiServices: ['geocode'],
      })

      expect(result.pass).toBe(true)
      expect(result.apiServices?.results.map((probe) => probe.service)).toEqual([
        'geocode',
        'geocode',
      ])
      expect(result.apiServices?.actions).toEqual([])
    } finally {
      await server.close()
    }
  })

  it('writes markdown and JSON verification artifacts', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-verify-out-'))
    const outPath = path.join(base, 'verify.md')
    const jsonOutPath = path.join(base, 'verify.json')
    await writeRenderDeploymentVerifyOutputs(
      {
        pass: true,
        appUrl: 'https://parkking.onrender.com',
        readinessUrl: 'https://parkking.onrender.com/api/parking-answer/ready',
        contractSource: '.tmp/render-deployment-handoff.json',
        releaseId: 'release-a',
        releaseTag: 'data-release-a',
        status: 200,
        serviceStatus: 'ok',
        expectedDatasets: [{ districtId: 'xinyi', datasetHash: 'hash-xinyi' }],
        districts: [
          {
            districtId: 'xinyi',
            expectedDatasetHash: 'hash-xinyi',
            actualDatasetHash: 'hash-xinyi',
            latestDatasetHash: 'hash-xinyi',
            ready: true,
            pass: true,
            errors: [],
          },
        ],
        unexpectedDistricts: [],
        remediation: null,
        errors: [],
      },
      { outPath, jsonOutPath },
    )

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      '# Render Deployment Verify: PASS',
    )
    await expect(fs.readFile(jsonOutPath, 'utf-8')).resolves.toContain(
      '"pass": true',
    )
  })
})
