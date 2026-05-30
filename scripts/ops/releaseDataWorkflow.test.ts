import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import {
  buildReleaseAssetSmokeHeaders,
  buildReleaseDataUrls,
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
})
