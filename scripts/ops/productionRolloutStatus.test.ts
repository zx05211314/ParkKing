import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import {
  buildProductionRolloutStatus,
  parseProductionRolloutStatusArgs,
  renderProductionRolloutStatus,
  type ProductionRolloutStatusOptions,
} from './productionRolloutStatus'
import type { ReleasePublishRequestEnvironment } from './releasePublishRequest'

const noCredentialsEnvironment: ReleasePublishRequestEnvironment = {
  ghTokenPresent: false,
  githubTokenPresent: false,
  githubRepository: null,
  ghCliAvailable: false,
  renderServiceIdPresent: false,
  renderApiKeyPresent: false,
  renderCliAvailable: false,
}

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const writeRolloutFixture = async (base: string) => {
  const releaseId = '20260531_abc1234'
  const tag = `data-${releaseId}`
  const handoffJsonPath = path.join(base, 'handoff.json')
  const readinessJsonPath = path.join(base, 'readiness.json')
  await Promise.all([
    writeJson(handoffJsonPath, {
      ready: true,
      repository: 'owner/repo',
      release: {
        releaseId,
        tag,
      },
      packageUrl:
        `https://github.com/owner/repo/releases/download/${tag}/park-king-data_${releaseId}.zip`,
      manifestUrl:
        `https://github.com/owner/repo/releases/download/${tag}/release_manifest_${releaseId}.json`,
      expectedDatasets: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-xinyi',
          publishedAt: '2026-05-31T00:00:00Z',
        },
      ],
      releaseAssetPaths: [
        path.join(base, 'missing.zip'),
        path.join(base, 'missing.json'),
      ],
    }),
    writeJson(readinessJsonPath, {
      pass: true,
    }),
  ])
  return { handoffJsonPath, readinessJsonPath, releaseId, tag }
}

const publishedReleaseFetch = (): typeof fetch =>
  (async (input) => {
    const url = String(input)
    if (url.includes('/api.github.com/repos/')) {
      return new Response(
        JSON.stringify({
          html_url: 'https://github.com/owner/repo/releases/tag/data-20260531_abc1234',
        }),
        { status: 200 },
      )
    }
    if (url.includes('/releases/download/')) {
      return new Response(
        JSON.stringify({
          releaseId: '20260531_abc1234',
          districts: [
            {
              districtId: 'xinyi',
              datasetHash: 'hash-xinyi',
              publishedAt: '2026-05-31T00:00:00Z',
            },
          ],
        }),
        { status: 200 },
      )
    }
    throw new Error(`Unexpected URL ${url}`)
  }) as typeof fetch

const startDriftServer = async () => {
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
    if (url.pathname === '/api/parking-answer/ready') {
      sendJson(response, 200, {
        status: 'ok',
        districts: [
          {
            districtId: 'xinyi',
            ready: true,
            datasetHash: 'hash-live',
            latestDatasetHash: 'hash-live',
          },
        ],
      })
      return
    }
    if (['/api/geocode/health', '/api/geocode/ready'].includes(url.pathname)) {
      sendJson(response, 200, { status: 'ok' })
      return
    }
    if (['/api/route/health', '/api/route/ready'].includes(url.pathname)) {
      sendJson(response, 200, { status: 'ok' })
      return
    }
    if (url.pathname === '/api/sync/health') {
      sendJson(response, 200, {
        status: 'ok',
        mode: 'issue-upload-only',
        durability: 'ephemeral',
        capabilities: {
          savedPlansRead: false,
          savedPlansWrite: false,
          reportsRead: false,
          reportsWrite: false,
          issueReportsRead: false,
          issueReportsWrite: true,
        },
      })
      return
    }
    if (
      ['/api/sync/ready', '/api/parking-answer/health'].includes(url.pathname)
    ) {
      sendJson(response, 200, { status: 'ok' })
      return
    }
    if (
      ['/api/sync/saved-plans', '/api/sync/reports', '/api/sync/issues'].includes(
        url.pathname,
      ) &&
      request.method === 'GET'
    ) {
      sendJson(response, 403, {
        error: 'Sync resource is disabled in issue-upload-only mode.',
      })
      return
    }
    if (url.pathname === '/api/sync/issues' && request.method === 'POST') {
      sendJson(response, 201, { issue: {}, revision: 1 })
      return
    }
    if (url.pathname === '/api/sync/issues' && request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.statusCode = 204
      response.end()
      return
    }
    if (url.pathname === '/api/sync/status' && request.method === 'GET') {
      sendJson(response, 200, {
        issueReportsCount: 1,
        issueReportsRevision: 1,
      })
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

const buildFixtureStatus = async (
  options: Partial<ProductionRolloutStatusOptions> = {},
) => {
  const base = await fs.mkdtemp(path.join(tmpdir(), 'production-rollout-'))
  const fixture = await writeRolloutFixture(base)
  return buildProductionRolloutStatus(
    {
      ...fixture,
      repository: 'owner/repo',
      ref: 'main',
      targetSha: 'abc1234ffff',
      appUrl: 'https://parkking.onrender.com',
      ...options,
    },
    publishedReleaseFetch(),
    noCredentialsEnvironment,
  )
}

describe('productionRolloutStatus', () => {
  it('parses rollout status args', () => {
    expect(
      parseProductionRolloutStatusArgs([
        '--ref',
        'main',
        '--app-url',
        'https://parkking.onrender.com',
        '--manifest-url',
        'https://github.com/owner/repo/releases/download/data-20260531_abc1234/release_manifest_20260531_abc1234.json',
        '--check-live',
        '--require-live-pass',
      ]),
    ).toMatchObject({
      handoffJsonPath: '.tmp/render-deployment-handoff.json',
      readinessJsonPath: '.tmp/release-handoff-readiness.json',
      ref: 'main',
      appUrl: 'https://parkking.onrender.com',
      manifestUrl:
        'https://github.com/owner/repo/releases/download/data-20260531_abc1234/release_manifest_20260531_abc1234.json',
      checkLive: true,
      requireLivePass: true,
      outPath: '.tmp/production-rollout-status.md',
      jsonOutPath: '.tmp/production-rollout-status.json',
    })
  })

  it('reports ready for live verify before live checking production', async () => {
    const result = await buildFixtureStatus()

    expect(result.state).toBe('ready_for_live_verify')
    expect(result.liveVerify).toMatchObject({
      checked: false,
      pass: null,
    })
    expect(result.credentials).toMatchObject({
      renderApiKeyPresent: false,
      renderServiceIdPresent: false,
      canApplyDirectRenderSync: false,
    })
    expect(result.nextActions).toEqual([
      expect.stringContaining('Check live Render deployment'),
    ])
    const rendered = renderProductionRolloutStatus(result)
    expect(rendered).toContain('# Production Rollout Status: READY_FOR_LIVE_VERIFY')
    expect(rendered).toContain('Rollout status with live check')
    expect(rendered).toContain('--check-live')
  })

  it('can synthesize rollout handoff from a published manifest URL', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'production-rollout-manifest-'))
    const fixture = await writeRolloutFixture(base)
    const manifestUrl =
      `https://github.com/owner/repo/releases/download/${fixture.tag}/release_manifest_${fixture.releaseId}.json`

    const result = await buildProductionRolloutStatus(
      {
        readinessJsonPath: fixture.readinessJsonPath,
        ref: 'main',
        targetSha: 'abc1234ffff',
        appUrl: 'https://parkking.onrender.com',
        manifestUrl,
      },
      publishedReleaseFetch(),
      noCredentialsEnvironment,
    )

    expect(result.state).toBe('ready_for_live_verify')
    expect(result.releaseRequest.status.release.packageUrl).toBe(
      `https://github.com/owner/repo/releases/download/${fixture.tag}/park-king-data_${fixture.releaseId}.zip`,
    )
    expect(result.commands.renderEnvSyncServiceIdDryRun).toContain(
      '--handoff-json .tmp/production-rollout-handoff.json',
    )
    await expect(
      fs.readFile(path.resolve('.tmp/production-rollout-handoff.json'), 'utf-8'),
    ).resolves.toContain(fixture.releaseId)
  })

  it('points no-credential live drift remediation to the dashboard env packet', async () => {
    const server = await startDriftServer()
    try {
      const result = await buildFixtureStatus({
        appUrl: server.baseUrl,
        checkLive: true,
      })
      const rendered = renderProductionRolloutStatus(result)

      expect(result.state).toBe('needs_render_env_sync')
      expect(result.nextActions).toEqual([
        expect.stringContaining('ops:render-dashboard-env-packet'),
        expect.stringContaining('--check-live'),
      ])
      expect(rendered).toContain('Render dashboard env packet')
      expect(rendered).toContain('ops:render-dashboard-env-packet')
      expect(rendered).toContain('Render env sync/deploy cannot be applied')
    } finally {
      await server.close()
    }
  })

  it('reports live verify failure when live check lacks an app URL', async () => {
    const result = await buildFixtureStatus({
      appUrl: null,
      checkLive: true,
    })

    expect(result.state).toBe('blocked')
    expect(result.liveVerify).toMatchObject({
      checked: true,
      pass: false,
      error: 'Render app URL is required for --check-live',
    })
    expect(renderProductionRolloutStatus(result)).toContain(
      'Render app URL is required for --check-live',
    )
  })
})
