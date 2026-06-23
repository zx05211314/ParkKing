import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import {
  buildProductionRolloutStatusDispatchRequest,
  dispatchProductionRolloutStatusWorkflow,
  renderProductionRolloutStatusDispatchPlan,
  resolveProductionRolloutStatusDispatchOptions,
  type ProductionRolloutStatusDispatchOptions,
} from './dispatchProductionRolloutStatusWorkflow'

const baseOptions: ProductionRolloutStatusDispatchOptions = {
  repo: 'zx05211314/ParkKing',
  ref: 'main',
  workflow: 'production_rollout_status.yml',
  appUrl: 'https://parkking.onrender.com',
  packageUrl:
    'https://github.com/zx05211314/ParkKing/releases/download/data-1/park-king-data_1.zip',
  manifestUrl:
    'https://github.com/zx05211314/ParkKing/releases/download/data-1/release_manifest_1.json',
  checkLive: true,
  requireLivePass: false,
  skipReleaseLookup: false,
  dryRun: true,
  token: null,
}

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

describe('dispatch production rollout status workflow', () => {
  it('builds the GitHub workflow_dispatch request', () => {
    const request = buildProductionRolloutStatusDispatchRequest(baseOptions)

    expect(request).toEqual({
      url: 'https://api.github.com/repos/zx05211314/ParkKing/actions/workflows/production_rollout_status.yml/dispatches',
      payload: {
        ref: 'main',
        inputs: {
          appUrl: 'https://parkking.onrender.com',
          manifestUrl:
            'https://github.com/zx05211314/ParkKing/releases/download/data-1/release_manifest_1.json',
          packageUrl:
            'https://github.com/zx05211314/ParkKing/releases/download/data-1/park-king-data_1.zip',
          checkLive: 'true',
          requireLivePass: 'false',
          skipReleaseLookup: 'false',
        },
      },
    })
  })

  it('resolves repository and release URLs from handoff JSON', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'rollout-dispatch-'))
    const handoffPath = path.join(base, 'handoff.json')
    await writeJson(handoffPath, {
      repository: 'zx05211314/ParkKing',
      packageUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-1/park-king-data_1.zip',
      manifestUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-1/release_manifest_1.json',
    })

    const options = await resolveProductionRolloutStatusDispatchOptions([
      '--handoff-json',
      handoffPath,
      '--ref',
      'main',
      '--app-url',
      'https://parkking.onrender.com',
      '--check-live=false',
      '--require-live-pass=true',
      '--skip-release-lookup=true',
      '--dry-run',
    ])
    const plan = renderProductionRolloutStatusDispatchPlan({
      ...options,
      token: 'secret-token',
    })

    expect(options).toMatchObject({
      repo: 'zx05211314/ParkKing',
      ref: 'main',
      appUrl: 'https://parkking.onrender.com',
      checkLive: false,
      requireLivePass: true,
      skipReleaseLookup: true,
      dryRun: true,
    })
    expect(options.packageUrl).toContain('park-king-data_1.zip')
    expect(options.manifestUrl).toContain('release_manifest_1.json')
    expect(plan).toContain('"checkLive": "false"')
    expect(plan).not.toContain('secret-token')
  })

  it('requires a live app URL', async () => {
    await expect(
      resolveProductionRolloutStatusDispatchOptions([
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
    const result = await dispatchProductionRolloutStatusWorkflow(
      baseOptions,
      fetchImpl,
    )

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
    const result = await dispatchProductionRolloutStatusWorkflow(
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
      'https://api.github.com/repos/zx05211314/ParkKing/actions/workflows/production_rollout_status.yml/dispatches',
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
