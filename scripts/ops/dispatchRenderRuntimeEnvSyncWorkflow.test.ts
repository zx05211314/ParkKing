import { describe, expect, it, vi } from 'vitest'
import {
  buildRenderRuntimeEnvSyncDispatchRequest,
  dispatchRenderRuntimeEnvSyncWorkflow,
  renderRenderRuntimeEnvSyncDispatchPlan,
  resolveRenderRuntimeEnvSyncDispatchOptions,
  type RenderRuntimeEnvSyncDispatchOptions,
} from './dispatchRenderRuntimeEnvSyncWorkflow'

const baseOptions: RenderRuntimeEnvSyncDispatchOptions = {
  repo: 'zx05211314/ParkKing',
  ref: 'main',
  workflow: 'render_runtime_env_sync.yml',
  serviceId: '',
  serviceName: 'parkking',
  deploy: true,
  deployMode: 'build_and_deploy',
  dryRun: true,
  token: null,
}

describe('dispatch render runtime env sync workflow', () => {
  it('builds the GitHub workflow_dispatch request for Render Runtime Env Sync', () => {
    const request = buildRenderRuntimeEnvSyncDispatchRequest(baseOptions)

    expect(request).toEqual({
      url: 'https://api.github.com/repos/zx05211314/ParkKing/actions/workflows/render_runtime_env_sync.yml/dispatches',
      payload: {
        ref: 'main',
        inputs: {
          serviceId: '',
          serviceName: 'parkking',
          deploy: 'true',
          deployMode: 'build_and_deploy',
        },
      },
    })
  })

  it('resolves defaults and renders a token-safe plan', () => {
    const options = resolveRenderRuntimeEnvSyncDispatchOptions([
      '--repo',
      'zx05211314/ParkKing',
      '--ref',
      'main',
      '--dry-run',
    ])
    const plan = renderRenderRuntimeEnvSyncDispatchPlan({
      ...options,
      token: 'secret-token',
    })

    expect(options).toMatchObject({
      repo: 'zx05211314/ParkKing',
      ref: 'main',
      serviceName: 'parkking',
      deploy: true,
      deployMode: 'build_and_deploy',
      dryRun: true,
    })
    expect(plan).toContain('"serviceName": "parkking"')
    expect(plan).toContain('"deploy": "true"')
    expect(plan).not.toContain('secret-token')
  })

  it('supports service id, deploy false, and deploy_only mode', () => {
    const options = resolveRenderRuntimeEnvSyncDispatchOptions([
      '--repo',
      'zx05211314/ParkKing',
      '--ref',
      'main',
      '--service-id',
      'srv-test',
      '--service-name',
      'parkking-prod',
      '--deploy=false',
      '--deploy-mode',
      'deploy_only',
      '--dry-run',
    ])

    expect(options).toMatchObject({
      serviceId: 'srv-test',
      serviceName: 'parkking-prod',
      deploy: false,
      deployMode: 'deploy_only',
    })
  })

  it('requires a repository', () => {
    expect(() =>
      resolveRenderRuntimeEnvSyncDispatchOptions(['--ref', 'main', '--dry-run']),
    ).toThrow('Missing --repo')
  })

  it('dry-runs without a GitHub token or network call', async () => {
    const fetchImpl = vi.fn()
    const result = await dispatchRenderRuntimeEnvSyncWorkflow(baseOptions, fetchImpl)

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
    const result = await dispatchRenderRuntimeEnvSyncWorkflow(
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
      'https://api.github.com/repos/zx05211314/ParkKing/actions/workflows/render_runtime_env_sync.yml/dispatches',
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
