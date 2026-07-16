import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import {
  buildReleaseDataConsoleLines,
  buildReleaseDataSummaryLines,
  buildReleaseAssetSmokeHeaders,
  buildReleaseDataUrls,
  publishReleaseDataAssets,
  resolveReleaseDataMetadata,
  smokeReleaseDataAssetUrls,
} from './releaseDataWorkflow'

describe('releaseDataWorkflow', () => {
  it('resolves release metadata from p3 readiness output', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-data-meta-'))
    const readinessJsonPath = path.join(base, 'p3.json')
    await fs.writeFile(
      readinessJsonPath,
      JSON.stringify({
        releasePackage: {
          summary: {
            releaseId: '20260529_abcd123',
          },
        },
      }),
      'utf-8',
    )

    await expect(
      resolveReleaseDataMetadata({ readinessJsonPath }),
    ).resolves.toEqual({
      releaseId: '20260529_abcd123',
      tag: 'data-20260529_abcd123',
    })
  })

  it('builds deterministic GitHub release asset URLs', () => {
    expect(
      buildReleaseDataUrls({
        repository: 'owner/repo',
        tag: 'data-release',
        releaseId: '20260529_abcd123',
      }),
    ).toEqual({
      packageUrl:
        'https://github.com/owner/repo/releases/download/data-release/park-king-data_20260529_abcd123.zip',
      manifestUrl:
        'https://github.com/owner/repo/releases/download/data-release/release_manifest_20260529_abcd123.json',
    })
  })

  it('builds release smoke auth headers', () => {
    expect(buildReleaseAssetSmokeHeaders({ downloadToken: 'token' })).toMatchObject({
      authorization: 'Bearer token',
    })
    expect(
      buildReleaseAssetSmokeHeaders({
        downloadAuthHeader: 'Basic abc',
        downloadToken: 'token',
      }),
    ).toMatchObject({
      authorization: 'Basic abc',
    })
  })

  it('summarizes Render live verification workflow inputs', () => {
    const lines = buildReleaseDataSummaryLines({
      packageUrl: 'https://example.test/data.zip',
      manifestUrl: 'https://example.test/release_manifest.json',
    }).join('\n')

    expect(lines).toContain('Render Live Verify')
    expect(lines).toContain('PARKKING_RELEASE_PACKAGE_URL=https://example.test/data.zip')
    expect(lines).toContain(
      'PARKKING_SYNC_CORS_ORIGINS=https://parkking.onrender.com',
    )
    expect(lines).toContain('PARKKING_GEOCODER_REQUEST_TIMEOUT_MS=5000')
    expect(lines).toContain('PARKKING_ROUTING_REQUEST_TIMEOUT_MS=8000')
    expect(lines).toContain(
      'manifestUrl=https://example.test/release_manifest.json',
    )
    expect(lines).toContain('useGithubToken=true only for private')
    expect(lines).toContain('skipSyncIssueRoundtrip=false unless')
    expect(lines).toContain('npm run ops:render-deployment-verify')
  })

  it('prints non-misleading Render workflow dispatch inputs', () => {
    const lines = buildReleaseDataConsoleLines({
      packageUrl: 'https://example.test/data.zip',
      manifestUrl: 'https://example.test/release_manifest.json',
    }).join('\n')

    expect(lines).toContain(
      'VERIFY_RENDER_DEPLOY_WORKFLOW_INPUTS=appUrl=<Render service URL>',
    )
    expect(lines).toContain('PARKKING_RELEASE_PACKAGE_URL=https://example.test/data.zip')
    expect(lines).toContain(
      'PARKKING_SYNC_CORS_ORIGINS=https://parkking.onrender.com',
    )
    expect(lines).toContain('PARKKING_GEOCODER_REQUEST_TIMEOUT_MS=5000')
    expect(lines).toContain('PARKKING_ROUTING_REQUEST_TIMEOUT_MS=8000')
    expect(lines).toContain(
      'manifestUrl=https://example.test/release_manifest.json',
    )
    expect(lines).toContain(
      'useGithubToken=<true for private release assets, false for public assets>',
    )
    expect(lines).toContain('skipSyncIssueRoundtrip=false')
    expect(lines).not.toContain('useGithubToken=false')
  })

  it('smokes package and manifest release URLs', async () => {
    const releaseId = '20260529_abcd123'
    const server = createServer((request, response) => {
      if (request.url === '/data.zip' && request.method === 'HEAD') {
        response.writeHead(200, {
          'content-length': '123',
          'content-type': 'application/zip',
        })
        response.end()
        return
      }
      if (request.url === '/manifest.json' && request.method === 'GET') {
        response.writeHead(200, {
          'content-type': 'application/json',
        })
        response.end(
          JSON.stringify({
            releaseId,
            districts: [
              {
                districtId: 'xinyi',
                datasetHash: 'hash-xinyi',
                publishedAt: '2026-05-01T00:00:00Z',
              },
            ],
            files: [],
          }),
        )
        return
      }
      response.writeHead(404)
      response.end()
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })

    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Test server did not bind to a TCP port')
      }
      const baseUrl = `http://127.0.0.1:${address.port}`
      await expect(
        smokeReleaseDataAssetUrls({
          releaseId,
          packageUrl: `${baseUrl}/data.zip`,
          manifestUrl: `${baseUrl}/manifest.json`,
          timeoutMs: 1000,
        }),
      ).resolves.toMatchObject({
        pass: true,
        errors: [],
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })

  it('falls back to a ranged package GET when package HEAD is rejected', async () => {
    const releaseId = '20260529_abcd123'
    const packageRequests: Array<{
      method: string | undefined
      range: string | undefined
    }> = []
    const server = createServer((request, response) => {
      if (request.url === '/data.zip') {
        packageRequests.push({
          method: request.method,
          range: request.headers.range,
        })
      }
      if (request.url === '/data.zip' && request.method === 'HEAD') {
        response.writeHead(401)
        response.end()
        return
      }
      if (
        request.url === '/data.zip' &&
        request.method === 'GET' &&
        request.headers.range === 'bytes=0-0'
      ) {
        response.writeHead(206, {
          'content-length': '1',
          'content-range': 'bytes 0-0/123',
          'content-type': 'application/zip',
        })
        response.end('x')
        return
      }
      if (request.url === '/manifest.json' && request.method === 'GET') {
        response.writeHead(200, {
          'content-type': 'application/json',
        })
        response.end(
          JSON.stringify({
            releaseId,
            districts: [
              {
                districtId: 'xinyi',
                datasetHash: 'hash-xinyi',
                publishedAt: '2026-05-01T00:00:00Z',
              },
            ],
            files: [],
          }),
        )
        return
      }
      response.writeHead(404)
      response.end()
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })

    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Test server did not bind to a TCP port')
      }
      const baseUrl = `http://127.0.0.1:${address.port}`
      const result = await smokeReleaseDataAssetUrls({
        releaseId,
        packageUrl: `${baseUrl}/data.zip`,
        manifestUrl: `${baseUrl}/manifest.json`,
        timeoutMs: 1000,
      })

      expect(result).toMatchObject({
        pass: true,
        errors: [],
      })
      expect(result.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'package',
            method: 'HEAD',
            ok: false,
            status: 401,
          }),
          expect.objectContaining({
            label: 'package-range',
            method: 'GET',
            ok: true,
            status: 206,
          }),
        ]),
      )
      expect(packageRequests).toEqual([
        { method: 'HEAD', range: undefined },
        { method: 'GET', range: 'bytes=0-0' },
      ])
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })

  it('fails release URL smoke when the manifest release ID mismatches', async () => {
    const server = createServer((request, response) => {
      if (request.url === '/data.zip' && request.method === 'HEAD') {
        response.writeHead(200)
        response.end()
        return
      }
      if (request.url === '/manifest.json' && request.method === 'GET') {
        response.writeHead(200, {
          'content-type': 'application/json',
        })
        response.end(JSON.stringify({ releaseId: 'wrong-release' }))
        return
      }
      response.writeHead(404)
      response.end()
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })

    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Test server did not bind to a TCP port')
      }
      const baseUrl = `http://127.0.0.1:${address.port}`
      const result = await smokeReleaseDataAssetUrls({
        releaseId: 'expected-release',
        packageUrl: `${baseUrl}/data.zip`,
        manifestUrl: `${baseUrl}/manifest.json`,
        timeoutMs: 1000,
      })

      expect(result.pass).toBe(false)
      expect(result.errors).toContain(
        'Manifest releaseId wrong-release does not match expected-release',
      )
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })

  it('publishes release assets through GitHub REST API when token and repository are provided', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-data-api-'))
    const notesPath = path.join(base, 'readiness.md')
    await fs.writeFile(notesPath, '# Ready\n', 'utf-8')
    await fs.writeFile(path.join(base, 'park-king-data_release-a.zip'), 'zip', 'utf-8')
    await fs.writeFile(
      path.join(base, 'release_manifest_release-a.json'),
      '{}',
      'utf-8',
    )

    const calls: Array<{ url: string; init?: RequestInit }> = []
    let latestLookupCount = 0
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.endsWith('/repos/owner/repo/releases/latest')) {
        latestLookupCount += 1
        return Response.json(
          latestLookupCount === 1
            ? { id: 122, tag_name: 'data-previous' }
            : { id: 123, tag_name: 'data-release-a' },
        )
      }
      if (url.endsWith('/repos/owner/repo/releases/tags/data-release-a')) {
        return new Response('not found', { status: 404 })
      }
      if (url.endsWith('/repos/owner/repo/releases') && init?.method === 'POST') {
        return Response.json({ id: 123 }, { status: 201 })
      }
      if (
        url.startsWith(
          'https://uploads.github.com/repos/owner/repo/releases/123/assets?',
        ) &&
        init?.method === 'POST'
      ) {
        return Response.json({ id: 456 }, { status: 201 })
      }
      if (url.endsWith('/repos/owner/repo/releases/122') && init?.method === 'PATCH') {
        return Response.json({ id: 122 })
      }
      throw new Error(`Unexpected request ${init?.method ?? 'GET'} ${url}`)
    }

    await publishReleaseDataAssets({
      releaseId: 'release-a',
      tag: 'data-release-a',
      targetSha: 'abc123',
      makeLatest: false,
      repository: 'owner/repo',
      token: 'token',
      releaseDir: base,
      readinessMarkdownPath: notesPath,
      fetchImpl,
    })

    const createCall = calls.find(
      (call) =>
        call.url.endsWith('/repos/owner/repo/releases') &&
        call.init?.method === 'POST',
    )
    expect(createCall).toBeDefined()
    expect(JSON.parse(String(createCall?.init?.body))).toMatchObject({
      tag_name: 'data-release-a',
      target_commitish: 'abc123',
      name: 'ParkKing data release-a',
      make_latest: 'false',
    })
    expect(
      calls.filter((call) => call.url.startsWith('https://uploads.github.com/')),
    ).toHaveLength(2)
    expect(latestLookupCount).toBe(2)
    expect(
      calls.find(
        (call) =>
          call.url.endsWith('/repos/owner/repo/releases/122') &&
          call.init?.method === 'PATCH',
      ),
    ).toMatchObject({
      init: expect.objectContaining({
        body: JSON.stringify({ make_latest: 'true' }),
      }),
    })
  })

  it('does not restore the prior latest release when another release won the race', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-data-latest-race-'))
    await fs.writeFile(path.join(base, 'park-king-data_release-a.zip'), 'zip', 'utf-8')
    await fs.writeFile(
      path.join(base, 'release_manifest_release-a.json'),
      '{}',
      'utf-8',
    )

    let latestLookupCount = 0
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.endsWith('/repos/owner/repo/releases/latest')) {
        latestLookupCount += 1
        return Response.json(
          latestLookupCount === 1
            ? { id: 122, tag_name: 'data-previous' }
            : { id: 124, tag_name: 'data-concurrent' },
        )
      }
      if (url.endsWith('/repos/owner/repo/releases/tags/data-release-a')) {
        return new Response('not found', { status: 404 })
      }
      if (url.endsWith('/repos/owner/repo/releases') && init?.method === 'POST') {
        return Response.json({ id: 123 }, { status: 201 })
      }
      if (url.startsWith('https://uploads.github.com/')) {
        return Response.json({ id: 456 }, { status: 201 })
      }
      throw new Error(`Unexpected request ${init?.method ?? 'GET'} ${url}`)
    }

    await publishReleaseDataAssets({
      releaseId: 'release-a',
      tag: 'data-release-a',
      targetSha: 'abc123',
      makeLatest: false,
      repository: 'owner/repo',
      token: 'token',
      releaseDir: base,
      fetchImpl,
    })

    expect(latestLookupCount).toBe(2)
    expect(calls.some((call) => call.init?.method === 'PATCH')).toBe(false)
  })

  it('clobbers existing GitHub release assets through the REST API', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-data-clobber-'))
    await fs.writeFile(path.join(base, 'park-king-data_release-a.zip'), 'zip', 'utf-8')
    await fs.writeFile(
      path.join(base, 'release_manifest_release-a.json'),
      '{}',
      'utf-8',
    )

    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.endsWith('/repos/owner/repo/releases/tags/data-release-a')) {
        return Response.json({ id: 123 })
      }
      if (
        url.endsWith('/repos/owner/repo/releases/123/assets?per_page=100')
      ) {
        return Response.json([
          { id: 1, name: 'park-king-data_release-a.zip' },
          { id: 2, name: 'release_manifest_release-a.json' },
        ])
      }
      if (url.endsWith('/repos/owner/repo/releases/assets/1')) {
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/repos/owner/repo/releases/assets/2')) {
        return new Response(null, { status: 204 })
      }
      if (
        url.startsWith(
          'https://uploads.github.com/repos/owner/repo/releases/123/assets?',
        ) &&
        init?.method === 'POST'
      ) {
        return Response.json({ id: 456 }, { status: 201 })
      }
      if (url.endsWith('/repos/owner/repo/releases/123') && init?.method === 'PATCH') {
        return Response.json({ id: 123 })
      }
      throw new Error(`Unexpected request ${init?.method ?? 'GET'} ${url}`)
    }

    await publishReleaseDataAssets({
      releaseId: 'release-a',
      tag: 'data-release-a',
      targetSha: 'abc123',
      makeLatest: true,
      repository: 'owner/repo',
      token: 'token',
      releaseDir: base,
      fetchImpl,
    })

    expect(
      calls.filter((call) => call.init?.method === 'DELETE').map((call) => call.url),
    ).toEqual([
      'https://api.github.com/repos/owner/repo/releases/assets/1',
      'https://api.github.com/repos/owner/repo/releases/assets/2',
    ])
    expect(calls.some((call) => call.init?.method === 'PATCH')).toBe(true)
    expect(
      calls.filter((call) => call.url.startsWith('https://uploads.github.com/')),
    ).toHaveLength(2)
  })
})
