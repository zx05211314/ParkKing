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

const startJsonServer = async (payload: unknown, status = 200) => {
  const server = http.createServer((request, response) => {
    if (request.url !== '/api/parking-answer/ready') {
      response.statusCode = 404
      response.end('not found')
      return
    }
    response.statusCode = status
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(payload))
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
      outPath: '.tmp/verify.md',
      jsonOutPath: '.tmp/verify.json',
    })
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
      expect(renderRenderDeploymentVerify(result)).toContain(
        '# Render Deployment Verify: PASS',
      )
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
