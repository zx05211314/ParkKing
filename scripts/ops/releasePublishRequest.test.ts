import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildReleasePublishRequest,
  parseReleasePublishRequestArgs,
  renderReleasePublishRequest,
  writeReleasePublishRequestOutputs,
  type ReleasePublishRequestEnvironment,
} from './releasePublishRequest'

const noToolsEnvironment: ReleasePublishRequestEnvironment = {
  ghTokenPresent: false,
  githubTokenPresent: false,
  githubRepository: null,
  ghCliAvailable: false,
  renderApiKeyPresent: false,
  renderCliAvailable: false,
}

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
  const handoffJsonPath = path.join(base, 'handoff.json')
  const readinessJsonPath = path.join(base, 'readiness.json')
  const readinessMarkdownPath = path.join(base, 'readiness.md')
  await fs.mkdir(releaseDir, { recursive: true })
  await fs.writeFile(zipPath, 'zip', 'utf-8')
  await fs.writeFile(
    manifestPath,
    JSON.stringify({ releaseId, districts: [{ districtId: 'xinyi', datasetHash: 'hash' }] }),
    'utf-8',
  )
  await Promise.all([
    writeJson(handoffJsonPath, {
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
      expectedDatasets: [{ districtId: 'xinyi', datasetHash: 'hash' }],
      releaseFileCount: 2,
      releaseTotalBytes: 5,
      installedFileCount: 2,
      releaseAssetPaths: [zipPath, manifestPath],
      blockers: [],
      renderEnv: {},
      externalSteps: [],
    }),
    writeJson(readinessJsonPath, {
      pass: true,
    }),
    fs.writeFile(readinessMarkdownPath, '# Ready\n', 'utf-8'),
  ])
  return {
    handoffJsonPath,
    readinessJsonPath,
    readinessMarkdownPath,
    releaseDir,
    releaseId,
    tag,
    zipPath,
    manifestPath,
  }
}

const fetchResponse = (response: Response): typeof fetch =>
  (async () => response) as typeof fetch

describe('releasePublishRequest', () => {
  it('parses publish request defaults', () => {
    expect(
      parseReleasePublishRequestArgs([
        '--ref',
        'main',
        '--target-sha',
        'abc1234ffff',
        '--app-url',
        'https://parkking.onrender.com',
        '--skip-release-lookup',
      ]),
    ).toMatchObject({
      handoffJsonPath: '.tmp/render-deployment-handoff.json',
      readinessJsonPath: '.tmp/release-handoff-readiness.json',
      readinessMarkdownPath: '.tmp/p3-release-readiness.md',
      releaseDir: 'dist/releases',
      ref: 'main',
      targetSha: 'abc1234ffff',
      appUrl: 'https://parkking.onrender.com',
      skipReleaseLookup: true,
      outPath: '.tmp/release-publish-request.md',
      jsonOutPath: '.tmp/release-publish-request.json',
    })
  })

  it('builds a ready-for-publish request with exact local asset checksums', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-publish-request-'))
    const fixture = await writeHandoffFixture(base)

    const result = await buildReleasePublishRequest(
      {
        ...fixture,
        repository: 'owner/repo',
        ref: 'main',
        targetSha: 'abc1234ffff',
        appUrl: 'https://parkking.onrender.com',
      },
      fetchResponse(new Response('', { status: 404 })),
      noToolsEnvironment,
    )

    expect(result.state).toBe('ready_for_release_publish')
    expect(result.blockers).toEqual([])
    expect(result.status.blockers).toContain(
      'GitHub Release data-20260531_abc1234 is not published yet',
    )
    expect(result.externalRequirements).toContain(
      'Provide GH_TOKEN/GITHUB_TOKEN with contents:write, install/authenticate gh, push the matching data tag, or run the GitHub Actions workflow from the GitHub UI.',
    )
    expect(result.assets).toHaveLength(2)
    expect(result.assets[0]).toMatchObject({
      name: `park-king-data_${fixture.releaseId}.zip`,
      sha256: createHash('sha256').update('zip').digest('hex'),
    })
    expect(result.commands.exactLocalPublish).toBe(
      'npm run ops:release-data-publish-handoff -- --ref main',
    )
    expect(result.manualPublish).toMatchObject({
      githubNewReleaseUrl: 'https://github.com/owner/repo/releases/new',
      expectedReleaseUrl:
        'https://github.com/owner/repo/releases/tag/data-20260531_abc1234',
      releaseTag: 'data-20260531_abc1234',
      releaseTitle: 'ParkKing data 20260531_abc1234',
      assetDirectory: path.resolve(path.dirname(fixture.zipPath)),
      uploadAssetPaths: [
        path.resolve(fixture.zipPath),
        path.resolve(fixture.manifestPath),
      ],
    })
    const rendered = renderReleasePublishRequest(result)
    expect(rendered).toContain('# Release Publish Request: READY_FOR_RELEASE_PUBLISH')
    expect(rendered).toContain('## Exact Local Publish')
    expect(rendered).toContain('## Manual GitHub UI Publish')
    expect(rendered).toContain('## Tag Push Publish Alternative')
    expect(rendered).toContain(
      'git tag data-20260531_abc1234 main; git push origin data-20260531_abc1234',
    )
    expect(rendered).toContain('https://github.com/owner/repo/releases/new')
    expect(rendered).toContain('Tag: data-20260531_abc1234')
    expect(rendered).toContain('PARKKING_RELEASE_PACKAGE_URL=')
  })

  it('reports ready for Render live verify when release assets are already published', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-publish-published-'))
    const fixture = await writeHandoffFixture(base)

    const result = await buildReleasePublishRequest(
      {
        ...fixture,
        repository: 'owner/repo',
        ref: 'main',
        targetSha: 'abc1234ffff',
        appUrl: 'https://parkking.onrender.com',
      },
      fetchResponse(
        new Response(
          JSON.stringify({
            html_url: 'https://github.com/owner/repo/releases/tag/data-20260531_abc1234',
          }),
          { status: 200 },
        ),
      ),
      noToolsEnvironment,
    )

    expect(result.state).toBe('ready_for_render_live_verify')
    expect(result.externalRequirements.join('\n')).not.toContain(
      'Publish GitHub Release data-20260531_abc1234',
    )
    expect(renderReleasePublishRequest(result)).toContain(
      'npm run ops:render-deployment-verify -- --app-url https://parkking.onrender.com',
    )
  })

  it('blocks when the local handoff release suffix is stale', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-publish-stale-'))
    const fixture = await writeHandoffFixture(base)

    const result = await buildReleasePublishRequest(
      {
        ...fixture,
        repository: 'owner/repo',
        ref: 'main',
        targetSha: 'def5678ffff',
        skipReleaseLookup: true,
      },
      fetchResponse(new Response('', { status: 200 })),
      noToolsEnvironment,
    )

    expect(result.state).toBe('blocked')
    expect(result.blockers).toContain(
      'Local handoff release ID 20260531_abc1234 does not match main target SHA def5678ffff',
    )
  })

  it('writes markdown and JSON outputs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-publish-output-'))
    const fixture = await writeHandoffFixture(base)
    const outPath = path.join(base, 'request.md')
    const jsonOutPath = path.join(base, 'request.json')
    const result = await buildReleasePublishRequest(
      {
        ...fixture,
        repository: 'owner/repo',
        ref: 'main',
        targetSha: 'abc1234ffff',
      },
      fetchResponse(new Response('', { status: 404 })),
      noToolsEnvironment,
    )

    await writeReleasePublishRequestOutputs(result, { outPath, jsonOutPath })

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      '# Release Publish Request: READY_FOR_RELEASE_PUBLISH',
    )
    const parsed = JSON.parse(await fs.readFile(jsonOutPath, 'utf-8')) as {
      state?: string
      manualPublish?: {
        releaseTag?: string
      }
    }
    expect(parsed.state).toBe('ready_for_release_publish')
    expect(parsed.manualPublish?.releaseTag).toBe('data-20260531_abc1234')
  })
})
