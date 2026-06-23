import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
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
  handoffJsonPath: '',
  packageUrl: '',
  manifestUrl: '',
  execute: false,
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
          packageUrl: '',
          manifestUrl: '',
          execute: 'false',
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
      handoffJsonPath: '',
      packageUrl: '',
      manifestUrl: '',
      execute: false,
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
      '--package-url',
      'https://example.test/data.zip',
      '--manifest-url',
      'https://example.test/manifest.json',
      '--deploy=false',
      '--execute',
      '--deploy-mode',
      'deploy_only',
      '--dry-run',
    ])

    expect(options).toMatchObject({
      serviceId: 'srv-test',
      serviceName: 'parkking-prod',
      handoffJsonPath: '',
      packageUrl: 'https://example.test/data.zip',
      manifestUrl: 'https://example.test/manifest.json',
      execute: true,
      deploy: false,
      deployMode: 'deploy_only',
    })
  })

  it('reads release URLs from handoff JSON for workflow inputs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-env-dispatch-'))
    const handoffPath = path.join(base, 'handoff.json')
    await fs.writeFile(
      handoffPath,
      `${JSON.stringify({
        packageUrl: 'https://example.test/data.zip',
        manifestUrl: 'https://example.test/manifest.json',
      })}\n`,
      'utf-8',
    )

    const options = resolveRenderRuntimeEnvSyncDispatchOptions([
      '--repo',
      'zx05211314/ParkKing',
      '--ref',
      'main',
      '--handoff-json',
      handoffPath,
      '--dry-run',
    ])
    const request = buildRenderRuntimeEnvSyncDispatchRequest(options)

    expect(options).toMatchObject({
      handoffJsonPath: handoffPath,
      packageUrl: 'https://example.test/data.zip',
      manifestUrl: 'https://example.test/manifest.json',
    })
    expect(request.payload.inputs).toMatchObject({
      packageUrl: 'https://example.test/data.zip',
      manifestUrl: 'https://example.test/manifest.json',
    })
  })

  it('requires a repository', () => {
    const originalRepository = process.env.GITHUB_REPOSITORY
    delete process.env.GITHUB_REPOSITORY

    try {
      expect(() =>
        resolveRenderRuntimeEnvSyncDispatchOptions(['--ref', 'main', '--dry-run']),
      ).toThrow('Missing --repo')
    } finally {
      if (originalRepository === undefined) {
        delete process.env.GITHUB_REPOSITORY
      } else {
        process.env.GITHUB_REPOSITORY = originalRepository
      }
    }
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
