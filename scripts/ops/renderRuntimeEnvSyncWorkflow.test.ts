import { describe, expect, it } from 'vitest'
import { resolveRenderRuntimeEnvSyncWorkflowOptions } from './renderRuntimeEnvSyncWorkflow'

describe('renderRuntimeEnvSyncWorkflow', () => {
  it('derives release URLs and execute/deploy flags for successful data-tag workflow runs', () => {
    const options = resolveRenderRuntimeEnvSyncWorkflowOptions({
      PARKKING_WORKFLOW_EVENT_NAME: 'workflow_run',
      PARKKING_WORKFLOW_RUN_HEAD_BRANCH: 'data-20260623185700_399b28a',
      GITHUB_REPOSITORY: 'zx05211314/ParkKing',
      RENDER_API_KEY: 'render-token',
    })

    expect(options).toMatchObject({
      serviceId: null,
      serviceName: 'parkking',
      execute: true,
      deploy: true,
      deployMode: 'build_and_deploy',
      token: 'render-token',
      packageUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-20260623185700_399b28a/park-king-data_20260623185700_399b28a.zip',
      manifestUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-20260623185700_399b28a/release_manifest_20260623185700_399b28a.json',
    })
  })

  it('preserves manual dispatch inputs', () => {
    const options = resolveRenderRuntimeEnvSyncWorkflowOptions({
      PARKKING_WORKFLOW_EVENT_NAME: 'workflow_dispatch',
      PARKKING_INPUT_SERVICE_ID: 'srv-123',
      PARKKING_INPUT_SERVICE_NAME: 'parkking-preview',
      PARKKING_INPUT_PACKAGE_URL: 'https://example.test/data.zip',
      PARKKING_INPUT_MANIFEST_URL: 'https://example.test/manifest.json',
      PARKKING_INPUT_EXECUTE: 'false',
      PARKKING_INPUT_DEPLOY: 'true',
      PARKKING_INPUT_DEPLOY_MODE: 'deploy_only',
      RENDER_TOKEN: 'fallback-token',
    })

    expect(options).toMatchObject({
      serviceId: 'srv-123',
      serviceName: 'parkking-preview',
      packageUrl: 'https://example.test/data.zip',
      manifestUrl: 'https://example.test/manifest.json',
      execute: false,
      deploy: true,
      deployMode: 'deploy_only',
      token: 'fallback-token',
    })
  })

  it('uses the exact release handoff artifact for default-branch workflow runs', () => {
    const options = resolveRenderRuntimeEnvSyncWorkflowOptions({
      PARKKING_WORKFLOW_EVENT_NAME: 'workflow_run',
      PARKKING_WORKFLOW_RUN_HEAD_BRANCH: 'main',
      PARKKING_WORKFLOW_RUN_HANDOFF_JSON:
        '.tmp/release-data-upstream/.tmp/render-deployment-handoff.json',
      GITHUB_REPOSITORY: 'zx05211314/ParkKing',
      RENDER_API_KEY: 'render-token',
    })

    expect(options).toMatchObject({
      serviceId: null,
      serviceName: 'parkking',
      handoffJsonPath:
        '.tmp/release-data-upstream/.tmp/render-deployment-handoff.json',
      execute: true,
      deploy: true,
      deployMode: 'build_and_deploy',
      token: 'render-token',
      packageUrl: null,
      manifestUrl: null,
    })
  })

  it('rejects non-data workflow_run refs', () => {
    expect(() =>
      resolveRenderRuntimeEnvSyncWorkflowOptions({
        PARKKING_WORKFLOW_EVENT_NAME: 'workflow_run',
        PARKKING_WORKFLOW_RUN_HEAD_BRANCH: 'main',
        GITHUB_REPOSITORY: 'zx05211314/ParkKing',
      }),
    ).toThrow('workflow_run head branch is not a data tag')
  })
})
