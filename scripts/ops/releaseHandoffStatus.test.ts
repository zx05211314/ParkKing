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
  } = {},
) => {
  const handoffJsonPath = path.join(base, 'handoff.json')
  const readinessJsonPath = path.join(base, 'readiness.json')
  await Promise.all([
    writeJson(handoffJsonPath, {
      ready: options.ready ?? true,
      repository: 'zx05211314/ParkKing',
      release: {
        releaseId: 'release-a',
        tag: 'data-release-a',
      },
      packageUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-release-a/park-king-data_release-a.zip',
      manifestUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-release-a/release_manifest_release-a.json',
    }),
    writeJson(readinessJsonPath, {
      pass: options.readinessPass ?? true,
    }),
  ])
  return { handoffJsonPath, readinessJsonPath }
}

const fetchResponse = (response: Response): typeof fetch =>
  (async () => response) as typeof fetch

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
        '--app-url',
        'https://parkking.onrender.com',
        '--skip-release-lookup',
      ]),
    ).toMatchObject({
      handoffJsonPath: '.tmp/render-deployment-handoff.json',
      readinessJsonPath: '.tmp/release-handoff-readiness.json',
      repository: 'owner/repo',
      ref: 'main',
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
    expect(result.blockers).toContain('GitHub Release data-release-a is not published yet')
    expect(result.nextActions.join('\n')).toContain(
      'npm run ops:release-data-dispatch -- --repo zx05211314/ParkKing --ref main --dry-run',
    )
    expect(result.commands.releasePublishEnv).toContain(
      '$env:GITHUB_REPOSITORY="zx05211314/ParkKing"',
    )
    expect(result.nextActions.join('\n')).toContain('npm run ops:release-data-publish')
    expect(renderReleaseHandoffStatus(result)).toContain(
      '# Release Handoff Status: READY FOR RELEASE PUBLISH',
    )
    expect(renderReleaseHandoffStatus(result)).toContain(
      '- Release publish: npm run ops:release-data-publish',
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
      fetchResponse(
        new Response(
          JSON.stringify({
            html_url: 'https://github.com/zx05211314/ParkKing/releases/tag/data-release-a',
          }),
          { status: 200 },
        ),
      ),
    )

    expect(result.readyForRenderLiveVerify).toBe(true)
    expect(result.releaseLookup.published).toBe(true)
    expect(result.commands.renderLiveVerifyDryRun).toContain(
      '--app-url https://parkking.onrender.com',
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
