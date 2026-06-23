import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
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
      expectedDatasets: [{ districtId: 'xinyi', datasetHash: 'hash-xinyi' }],
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
          districts: [{ districtId: 'xinyi', datasetHash: 'hash-xinyi' }],
        }),
        { status: 200 },
      )
    }
    throw new Error(`Unexpected URL ${url}`)
  }) as typeof fetch

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
