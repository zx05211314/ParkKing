import { describe, expect, it, vi } from 'vitest'
import {
  buildReleaseDataDispatchRequest,
  dispatchReleaseDataWorkflow,
  parseReleaseDataDispatchArgs,
  renderReleaseDataDispatchPlan,
  type ReleaseDataDispatchOptions,
} from './dispatchReleaseDataWorkflow'

const baseOptions: ReleaseDataDispatchOptions = {
  repo: 'zx05211314/ParkKing',
  ref: 'main',
  workflow: 'release_data.yml',
  configsGlob: 'configs/prod/*.json',
  allowWarn: false,
  overrideReason: '',
  tag: '',
  latest: false,
  dryRun: true,
  token: null,
}

describe('dispatch release data workflow', () => {
  it('builds the GitHub workflow_dispatch request for Release Data Package', () => {
    const request = buildReleaseDataDispatchRequest(baseOptions)

    expect(request).toEqual({
      url: 'https://api.github.com/repos/zx05211314/ParkKing/actions/workflows/release_data.yml/dispatches',
      payload: {
        ref: 'main',
        inputs: {
          configsGlob: 'configs/prod/*.json',
          allowWarn: 'false',
          overrideReason: '',
          tag: '',
          latest: 'false',
        },
      },
    })
  })

  it('parses explicit workflow inputs and keeps token out of the rendered plan', () => {
    const options = parseReleaseDataDispatchArgs([
      '--repo',
      'zx05211314/ParkKing',
      '--ref',
      'codex/p1-p2-readiness-checkpoint',
      '--allow-warn',
      'true',
      '--override-reason',
      'reviewed by owner',
      '--tag',
      'data-custom',
      '--latest=true',
      '--dry-run',
    ])
    const plan = renderReleaseDataDispatchPlan({
      ...options,
      token: 'secret-token',
    })

    expect(options).toMatchObject({
      repo: 'zx05211314/ParkKing',
      ref: 'codex/p1-p2-readiness-checkpoint',
      allowWarn: true,
      overrideReason: 'reviewed by owner',
      tag: 'data-custom',
      latest: true,
      dryRun: true,
    })
    expect(plan).toContain('"allowWarn": "true"')
    expect(plan).toContain('"tag": "data-custom"')
    expect(plan).not.toContain('secret-token')
  })

  it('requires an override reason when warnings are allowed', () => {
    expect(() =>
      parseReleaseDataDispatchArgs([
        '--repo',
        'zx05211314/ParkKing',
        '--ref',
        'main',
        '--allow-warn',
      ]),
    ).toThrow('--override-reason is required')
  })

  it('dry-runs without a GitHub token or network call', async () => {
    const fetchImpl = vi.fn()
    const result = await dispatchReleaseDataWorkflow(baseOptions, fetchImpl)

    expect(result).toMatchObject({
      dispatched: false,
      status: null,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('dispatches with token and treats HTTP 204 as success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 204,
      statusText: 'No Content',
      text: async () => '',
    })
    const result = await dispatchReleaseDataWorkflow(
      {
        ...baseOptions,
        dryRun: false,
        token: 'token',
      },
      fetchImpl,
    )

    expect(result).toMatchObject({
      dispatched: true,
      status: 204,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repos/zx05211314/ParkKing/actions/workflows/release_data.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer token',
          'x-github-api-version': '2022-11-28',
        }),
      }),
    )
  })
})
