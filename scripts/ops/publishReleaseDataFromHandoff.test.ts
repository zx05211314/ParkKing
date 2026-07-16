import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildPublishReleaseDataFromHandoffPlan,
  parsePublishReleaseDataFromHandoffArgs,
  publishReleaseDataFromHandoff,
  renderPublishReleaseDataFromHandoffPlan,
} from './publishReleaseDataFromHandoff'

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const writeHandoffFixture = async (base: string) => {
  const releaseId = '20260531_abc1234'
  const tag = `data-${releaseId}`
  const releaseDir = path.join(base, 'releases')
  const zipPath = path.join(releaseDir, `park-king-data_${releaseId}.zip`)
  const manifestPath = path.join(releaseDir, `release_manifest_${releaseId}.json`)
  await fs.mkdir(releaseDir, { recursive: true })
  await fs.writeFile(zipPath, 'zip', 'utf-8')
  await fs.writeFile(manifestPath, '{}', 'utf-8')

  const handoffJsonPath = path.join(base, 'handoff.json')
  await writeJson(handoffJsonPath, {
    ready: true,
    repository: 'owner/repo',
    release: {
      releaseId,
      tag,
    },
    packageUrl: `https://github.com/owner/repo/releases/download/${tag}/park-king-data_${releaseId}.zip`,
    manifestUrl: `https://github.com/owner/repo/releases/download/${tag}/release_manifest_${releaseId}.json`,
    p3ReadinessPass: true,
    deployReadinessPass: true,
    districts: ['xinyi'],
    expectedDatasets: [],
    releaseFileCount: 2,
    releaseTotalBytes: 5,
    installedFileCount: 2,
    releaseAssetPaths: [zipPath, manifestPath],
    blockers: [],
    renderEnv: {},
    externalSteps: [],
  })
  return { handoffJsonPath, releaseDir, releaseId, tag, zipPath, manifestPath }
}

describe('publishReleaseDataFromHandoff', () => {
  it('parses defaults for local handoff publishing', () => {
    expect(parsePublishReleaseDataFromHandoffArgs(['--dry-run'])).toMatchObject({
      handoffJsonPath: '.tmp/render-deployment-handoff.json',
      ref: 'main',
      releaseDir: 'dist/releases',
      readinessMarkdownPath: '.tmp/p3-release-readiness.md',
      latest: false,
      dryRun: true,
      smokeUrls: true,
      allowShaMismatch: false,
    })
  })

  it('builds a dry-run plan from handoff JSON without requiring a token', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-handoff-plan-'))
    const fixture = await writeHandoffFixture(base)

    const plan = await buildPublishReleaseDataFromHandoffPlan({
      handoffJsonPath: fixture.handoffJsonPath,
      ref: 'main',
      targetSha: 'abc1234ffff',
      releaseDir: fixture.releaseDir,
      readinessMarkdownPath: path.join(base, 'readiness.md'),
      latest: false,
      dryRun: true,
      smokeUrls: true,
      allowShaMismatch: false,
      timeoutMs: 1000,
      token: null,
    })

    expect(plan).toMatchObject({
      repository: 'owner/repo',
      releaseId: fixture.releaseId,
      tag: fixture.tag,
      targetSha: 'abc1234ffff',
      blockers: [],
    })
    expect(plan.assetPaths).toEqual([fixture.zipPath, fixture.manifestPath])
    expect(renderPublishReleaseDataFromHandoffPlan(plan)).toContain(
      '# Release Data Handoff Publish: DRY RUN',
    )
  })

  it('blocks when the target SHA does not match the release ID suffix', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-handoff-sha-'))
    const fixture = await writeHandoffFixture(base)

    const plan = await buildPublishReleaseDataFromHandoffPlan({
      handoffJsonPath: fixture.handoffJsonPath,
      ref: 'main',
      targetSha: 'def5678ffff',
      releaseDir: fixture.releaseDir,
      readinessMarkdownPath: path.join(base, 'readiness.md'),
      latest: false,
      dryRun: true,
      smokeUrls: true,
      allowShaMismatch: false,
      timeoutMs: 1000,
      token: null,
    })

    expect(plan.blockers).toContain(
      'Target SHA def5678ffff does not match release ID suffix abc1234',
    )
  })

  it('publishes the exact handoff assets through the REST API', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-handoff-api-'))
    const fixture = await writeHandoffFixture(base)
    const readinessMarkdownPath = path.join(base, 'readiness.md')
    await fs.writeFile(readinessMarkdownPath, '# Ready\n', 'utf-8')
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.endsWith('/repos/owner/repo/releases/latest')) {
        return new Response('not found', { status: 404 })
      }
      if (url.endsWith('/repos/owner/repo/releases/tags/data-20260531_abc1234')) {
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
      throw new Error(`Unexpected request ${init?.method ?? 'GET'} ${url}`)
    }

    const result = await publishReleaseDataFromHandoff(
      {
        handoffJsonPath: fixture.handoffJsonPath,
        ref: 'main',
        targetSha: 'abc1234ffff',
        releaseDir: fixture.releaseDir,
        readinessMarkdownPath,
        latest: false,
        dryRun: false,
        smokeUrls: false,
        allowShaMismatch: false,
        timeoutMs: 1000,
        token: 'token',
      },
      fetchImpl,
    )

    expect(result.published).toBe(true)
    expect(result.smokePass).toBeNull()
    expect(
      calls.filter((call) => call.url.startsWith('https://uploads.github.com/')),
    ).toHaveLength(2)
    expect(calls.map((call) => call.url).join('\n')).toContain(
      'park-king-data_20260531_abc1234.zip',
    )
    expect(calls.map((call) => call.url).join('\n')).toContain(
      'release_manifest_20260531_abc1234.json',
    )
  })
})
