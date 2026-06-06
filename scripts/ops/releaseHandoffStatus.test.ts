import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildReleaseHandoffStatus,
  parseReleaseHandoffStatusArgs,
  renderReleaseHandoffStatus,
} from './releaseHandoffStatus'

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const writeStatusInputs = async (
  base: string,
  options: {
    ready?: boolean
    readinessPass?: boolean
    releaseId?: string
    tag?: string
    createAssetFiles?: boolean
    expectedDatasets?: Array<{ districtId: string; datasetHash: string }>
  } = {},
) => {
  const handoffJsonPath = path.join(base, 'handoff.json')
  const readinessJsonPath = path.join(base, 'readiness.json')
  const releaseId = options.releaseId ?? 'release-a'
  const tag = options.tag ?? `data-${releaseId}`
  const releaseDir = path.join(base, 'releases')
  const zipPath = path.join(releaseDir, `park-king-data_${releaseId}.zip`)
  const manifestPath = path.join(releaseDir, `release_manifest_${releaseId}.json`)
  if (options.createAssetFiles !== false) {
    await fs.mkdir(releaseDir, { recursive: true })
    await Promise.all([
      fs.writeFile(zipPath, 'zip', 'utf-8'),
      fs.writeFile(manifestPath, '{}', 'utf-8'),
    ])
  }
  await Promise.all([
    writeJson(handoffJsonPath, {
      ready: options.ready ?? true,
      repository: 'zx05211314/ParkKing',
      release: {
        releaseId,
        tag,
      },
      packageUrl:
        `https://github.com/zx05211314/ParkKing/releases/download/${tag}/park-king-data_${releaseId}.zip`,
      manifestUrl:
        `https://github.com/zx05211314/ParkKing/releases/download/${tag}/release_manifest_${releaseId}.json`,
      expectedDatasets: options.expectedDatasets ?? [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-xinyi',
        },
      ],
      releaseAssetPaths: [zipPath, manifestPath],
    }),
    writeJson(readinessJsonPath, {
      pass: options.readinessPass ?? true,
    }),
  ])
  return { handoffJsonPath, readinessJsonPath, releaseDir, zipPath, manifestPath }
}

const fetchResponse = (response: Response): typeof fetch =>
  (async () => response) as typeof fetch

const publishedReleaseFetch = (params: {
  releaseId?: string
  districts?: Array<{ districtId: string; datasetHash: string }>
} = {}): typeof fetch => {
  const releaseId = params.releaseId ?? 'release-a'
  const districts = params.districts ?? [
    {
      districtId: 'xinyi',
      datasetHash: 'hash-xinyi',
    },
  ]
  return (async (input) => {
    const url = String(input)
    if (url.includes('/api.github.com/repos/')) {
      return new Response(
        JSON.stringify({
          html_url: 'https://github.com/zx05211314/ParkKing/releases/tag/data-release-a',
        }),
        { status: 200 },
      )
    }
    if (url.includes('/releases/download/')) {
      return new Response(
        JSON.stringify({
          releaseId,
          districts,
        }),
        { status: 200 },
      )
    }
    throw new Error(`Unexpected URL ${url}`)
  }) as typeof fetch
}

describe('releaseHandoffStatus', () => {
  it('parses default paths and status options', () => {
    expect(
      parseReleaseHandoffStatusArgs([
        'node',
        'releaseHandoffStatus.ts',
        '--repo',
        'owner/repo',
        '--ref',
        'main',
        '--target-sha',
        'abc1234def5678',
        '--app-url',
        'https://parkking.onrender.com',
        '--skip-release-lookup',
      ]),
    ).toMatchObject({
      handoffJsonPath: '.tmp/render-deployment-handoff.json',
      readinessJsonPath: '.tmp/release-handoff-readiness.json',
      releaseDir: 'dist/releases',
      repository: 'owner/repo',
      ref: 'main',
      targetSha: 'abc1234def5678',
      appUrl: 'https://parkking.onrender.com',
      skipReleaseLookup: true,
    })
  })

  it('reports the exact release publish blocker when the GitHub release is missing', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-missing-'))
    const paths = await writeStatusInputs(base)

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        ref: 'main',
      },
      fetchResponse(new Response('', { status: 404 })),
    )

    expect(result.readyForReleasePublish).toBe(true)
    expect(result.readyForRenderLiveVerify).toBe(false)
    expect(result.releaseLookup).toMatchObject({
      published: false,
      status: 404,
    })
    expect(result.release.localAssetsPresent).toBe(true)
    expect(result.blockers).toContain('GitHub Release data-release-a is not published yet')
    expect(result.nextActions.join('\n')).toContain(
      'npm run ops:release-data-dispatch -- --repo zx05211314/ParkKing --ref main --dry-run',
    )
    expect(result.nextActions.join('\n')).toContain(
      'npm run ops:release-data-publish-handoff -- --ref main',
    )
    expect(result.nextActions.join('\n')).toContain(
      'git tag data-release-a main; git push origin data-release-a',
    )
    expect(result.commands.releasePublishEnv).toContain(
      '$env:GITHUB_REPOSITORY="zx05211314/ParkKing"',
    )
    expect(result.nextActions.join('\n')).toContain('npm run ops:release-data-publish')
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: READY FOR RELEASE PUBLISH',
    )
    expect(renderReleaseHandoffStatus(result)).toContain('- Target SHA:')
    expect(renderReleaseHandoffStatus(result)).toContain('- Local assets present: yes')
    expect(renderReleaseHandoffStatus(result)).toContain(
      '- Release publish: npm run ops:release-data-publish',
    )
    expect(renderReleaseHandoffStatus(result)).toContain(
      '- Release publish from handoff: npm run ops:release-data-publish-handoff -- --ref main',
    )
    expect(renderReleaseHandoffStatus(result)).toContain(
      '- Release tag push: git tag data-release-a main; git push origin data-release-a',
    )
  })

  it('reports ready for live verify when release is published and app URL is available', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-ready-'))
    const paths = await writeStatusInputs(base)

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        ref: 'main',
        appUrl: 'https://parkking.onrender.com',
      },
      publishedReleaseFetch(),
    )

    expect(result.readyForRenderLiveVerify).toBe(true)
    expect(result.releaseLookup.published).toBe(true)
    expect(result.publishedManifest.pass).toBe(true)
    expect(result.commands.renderLiveVerifyDryRun).toContain(
      '--app-url https://parkking.onrender.com',
    )
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: READY FOR LIVE VERIFY',
    )
    expect(renderReleaseHandoffStatus(result)).toContain(
      '- Published manifest parity: yes',
    )
  })

  it('blocks live verify when the published manifest differs from the local handoff', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-drift-'))
    const paths = await writeStatusInputs(base)

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        ref: 'main',
        appUrl: 'https://parkking.onrender.com',
      },
      publishedReleaseFetch({
        districts: [
          {
            districtId: 'xinyi',
            datasetHash: 'published-hash-xinyi',
          },
        ],
      }),
    )

    expect(result.readyForReleasePublish).toBe(true)
    expect(result.readyForRenderLiveVerify).toBe(false)
    expect(result.publishedManifest.pass).toBe(false)
    expect(result.blockers.join('\n')).toContain(
      'Published release manifest does not match local handoff',
    )
    expect(result.publishedManifest.districts).toEqual([
      {
        districtId: 'xinyi',
        expectedDatasetHash: 'hash-xinyi',
        publishedDatasetHash: 'published-hash-xinyi',
        pass: false,
        error: 'dataset hash mismatch',
      },
    ])
    expect(result.nextActions).toEqual([
      'Do not set Render env vars from this local handoff yet.',
      'Use the handoff artifact from the successful Release Data Package workflow, or republish the local handoff assets after confirming the data source drift is intended.',
    ])
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: READY FOR RELEASE PUBLISH',
    )
    expect(renderReleaseHandoffStatus(result)).toContain(
      '| FAIL | xinyi | hash-xinyi | published-hash-xinyi | dataset hash mismatch |',
    )
  })

  it('blocks release publish when the local handoff release suffix does not match the target SHA', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-stale-'))
    const paths = await writeStatusInputs(base, {
      releaseId: '20260531_abc1234',
      tag: 'data-20260531_abc1234',
    })

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        ref: 'main',
        targetSha: 'def5678ffffeeee',
        skipReleaseLookup: true,
      },
      fetchResponse(new Response('', { status: 200 })),
    )

    expect(result.readyForReleasePublish).toBe(false)
    expect(result.targetSha).toBe('def5678ffffeeee')
    expect(result.blockers).toContain(
      'Local handoff release ID 20260531_abc1234 does not match main target SHA def5678ffffeeee',
    )
    expect(result.nextActions).toEqual([
      'Run local handoff gate: npm run ops:release-handoff-readiness',
    ])
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: BLOCKED',
    )
  })

  it('keeps release publish ready when the local handoff release suffix matches the target SHA', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-fresh-'))
    const paths = await writeStatusInputs(base, {
      releaseId: '20260531_abc1234',
      tag: 'data-20260531_abc1234',
    })

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        ref: 'main',
        targetSha: 'abc1234ffffeeee',
      },
      fetchResponse(new Response('', { status: 404 })),
    )

    expect(result.readyForReleasePublish).toBe(true)
    expect(result.readyForRenderLiveVerify).toBe(false)
    expect(result.targetSha).toBe('abc1234ffffeeee')
    expect(result.blockers).toEqual([
      'GitHub Release data-20260531_abc1234 is not published yet',
    ])
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: READY FOR RELEASE PUBLISH',
    )
  })

  it('allows remote live verify for a published matching release after the app ref advances', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-advanced-ref-'))
    const releaseId = '20260531_abc1234'
    const paths = await writeStatusInputs(base, {
      releaseId,
      tag: `data-${releaseId}`,
    })

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        ref: 'main',
        targetSha: 'def5678ffffeeee',
        appUrl: 'https://parkking.onrender.com',
      },
      publishedReleaseFetch({ releaseId }),
    )

    expect(result.readyForReleasePublish).toBe(false)
    expect(result.readyForRenderLiveVerify).toBe(true)
    expect(result.blockers).toEqual([])
    expect(result.warnings.join('\n')).toContain(
      'local republish is blocked, but remote live verify is unaffected because the published manifest matches',
    )
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: READY FOR LIVE VERIFY',
    )
  })

  it('blocks release publish when local handoff assets are missing', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-assets-'))
    const paths = await writeStatusInputs(base, {
      releaseId: '20260531_abc1234',
      tag: 'data-20260531_abc1234',
      createAssetFiles: false,
    })

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        ref: 'main',
        targetSha: 'abc1234ffffeeee',
        skipReleaseLookup: true,
      },
      fetchResponse(new Response('', { status: 200 })),
    )

    expect(result.readyForReleasePublish).toBe(false)
    expect(result.release.localAssetsPresent).toBe(false)
    expect(result.blockers.join('\n')).toContain(
      'Local handoff release assets are missing:',
    )
    expect(result.blockers.join('\n')).toContain(paths.zipPath)
    expect(result.blockers.join('\n')).toContain(paths.manifestPath)
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: BLOCKED',
    )
    expect(renderReleaseHandoffStatus(result)).toContain('- Local assets present: no')
  })

  it('allows remote live verify without local assets when the published manifest matches', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-remote-'))
    const paths = await writeStatusInputs(base, {
      createAssetFiles: false,
    })

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        ref: 'main',
        appUrl: 'https://parkking.onrender.com',
      },
      publishedReleaseFetch(),
    )

    expect(result.readyForReleasePublish).toBe(false)
    expect(result.readyForRenderLiveVerify).toBe(true)
    expect(result.release.localAssetsPresent).toBe(false)
    expect(result.blockers).toEqual([])
    expect(result.warnings.join('\n')).toContain(
      'local republish is unavailable, but remote live verify is unaffected',
    )
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: READY FOR LIVE VERIFY',
    )
  })

  it('blocks release publish when local handoff is not ready', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'handoff-status-blocked-'))
    const paths = await writeStatusInputs(base, { ready: false })

    const result = await buildReleaseHandoffStatus(
      {
        ...paths,
        skipReleaseLookup: true,
      },
      fetchResponse(new Response('', { status: 200 })),
    )

    expect(result.readyForReleasePublish).toBe(false)
    expect(result.blockers).toContain('Local Render deployment handoff is not READY')
    expect(result.nextActions).toEqual([
      'Run local handoff gate: npm run ops:release-handoff-readiness',
    ])
  })
})
