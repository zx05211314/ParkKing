import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import {
  buildRenderLiveVerifyDispatchRequest,
  dispatchRenderLiveVerifyWorkflow,
  preflightRenderLiveVerifyManifest,
  renderRenderLiveVerifyDispatchPlan,
  resolveRenderLiveVerifyDispatchOptions,
  type RenderLiveVerifyDispatchOptions,
} from './dispatchRenderLiveVerifyWorkflow'

const baseOptions: RenderLiveVerifyDispatchOptions = {
  repo: 'zx05211314/ParkKing',
  ref: 'main',
  workflow: 'render_live_verify.yml',
  appUrl: 'https://parkking.onrender.com',
  manifestUrl:
    'https://github.com/zx05211314/ParkKing/releases/download/data-1/release_manifest_1.json',
  useGithubToken: false,
  skipSyncIssueRoundtrip: false,
  allParkingAnswerCases: true,
  dryRun: true,
  token: null,
}

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

describe('dispatch render live verify workflow', () => {
  it('builds the GitHub workflow_dispatch request for Render Live Verify', () => {
    const request = buildRenderLiveVerifyDispatchRequest(baseOptions)

    expect(request).toEqual({
      url: 'https://api.github.com/repos/zx05211314/ParkKing/actions/workflows/render_live_verify.yml/dispatches',
      payload: {
        ref: 'main',
        inputs: {
          appUrl: 'https://parkking.onrender.com',
          manifestUrl:
            'https://github.com/zx05211314/ParkKing/releases/download/data-1/release_manifest_1.json',
          useGithubToken: 'false',
          skipSyncIssueRoundtrip: 'false',
          allParkingAnswerCases: 'true',
        },
      },
    })
  })

  it('resolves repo and manifest URL from handoff JSON', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-live-dispatch-'))
    const handoffPath = path.join(base, 'handoff.json')
    await writeJson(handoffPath, {
      repository: 'zx05211314/ParkKing',
      manifestUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-1/release_manifest_1.json',
    })

    const options = await resolveRenderLiveVerifyDispatchOptions([
      '--handoff-json',
      handoffPath,
      '--ref',
      'main',
      '--app-url',
      'https://parkking.onrender.com',
      '--use-github-token=true',
      '--skip-sync-issue-roundtrip',
      '--all-parking-answer-cases=false',
      '--dry-run',
    ])
    const plan = renderRenderLiveVerifyDispatchPlan({
      ...options,
      token: 'secret-token',
    })

    expect(options).toMatchObject({
      repo: 'zx05211314/ParkKing',
      ref: 'main',
      appUrl: 'https://parkking.onrender.com',
      useGithubToken: true,
      skipSyncIssueRoundtrip: true,
      allParkingAnswerCases: false,
      dryRun: true,
    })
    expect(options.manifestUrl).toContain('release_manifest_1.json')
    expect(plan).toContain('"useGithubToken": "true"')
    expect(plan).toContain('"allParkingAnswerCases": "false"')
    expect(plan).not.toContain('secret-token')
  })

  it('requires a live app URL', async () => {
    await expect(
      resolveRenderLiveVerifyDispatchOptions([
        '--repo',
        'zx05211314/ParkKing',
        '--ref',
        'main',
        '--manifest-url',
        baseOptions.manifestUrl,
        '--dry-run',
      ]),
    ).rejects.toThrow('Missing --app-url')
  })

  it('dry-runs without a GitHub token or network call', async () => {
    const fetchImpl = vi.fn()
    const result = await dispatchRenderLiveVerifyWorkflow(baseOptions, fetchImpl)

    expect(result).toMatchObject({
      dispatched: false,
      status: null,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('dispatches with token and treats HTTP 204 as success', async () => {
    const dispatchFetch = vi.fn().mockResolvedValue({
      status: 204,
      statusText: 'No Content',
      text: async () => '',
    })
    const manifestFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      text: async () => '{"releaseId":"data-1"}',
    })
    const result = await dispatchRenderLiveVerifyWorkflow(
      {
        ...baseOptions,
        dryRun: false,
        token: 'token',
      },
      dispatchFetch,
      manifestFetch,
    )

    expect(result).toMatchObject({
      dispatched: true,
      status: 204,
    })
    expect(manifestFetch).toHaveBeenCalledWith(
      baseOptions.manifestUrl,
      expect.objectContaining({
        method: 'GET',
        headers: expect.not.objectContaining({
          authorization: expect.anything(),
        }),
      }),
    )
    expect(dispatchFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/zx05211314/ParkKing/actions/workflows/render_live_verify.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer token',
          'x-github-api-version': '2022-11-28',
        }),
      }),
    )
  })

  it('blocks dispatch when the release manifest is not published', async () => {
    const dispatchFetch = vi.fn()
    const manifestFetch = vi.fn().mockResolvedValue({
      status: 404,
      statusText: 'Not Found',
      text: async () => 'not found',
    })

    await expect(
      dispatchRenderLiveVerifyWorkflow(
        {
          ...baseOptions,
          dryRun: false,
          token: 'token',
        },
        dispatchFetch,
        manifestFetch,
      ),
    ).rejects.toThrow('Release manifest preflight failed: HTTP 404 Not Found')
    expect(dispatchFetch).not.toHaveBeenCalled()
  })

  it('sends auth only when preflighting a private GitHub manifest', async () => {
    const manifestFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      text: async () => '{"releaseId":"data-1"}',
    })

    await preflightRenderLiveVerifyManifest(
      {
        ...baseOptions,
        dryRun: false,
        token: 'private-token',
        useGithubToken: true,
      },
      manifestFetch,
    )

    expect(manifestFetch).toHaveBeenCalledWith(
      baseOptions.manifestUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer private-token',
        }),
      }),
    )
  })
})
