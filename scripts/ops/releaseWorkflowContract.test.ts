import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const readWorkflow = async (name: string) =>
  await fs.readFile(path.resolve('.github/workflows', name), 'utf-8')

const readPackageJson = async () =>
  JSON.parse(await fs.readFile(path.resolve('package.json'), 'utf-8')) as {
    scripts?: Record<string, string>
  }

const expectCommandsInOrder = (content: string, commands: string[]) => {
  let cursor = 0
  const missing: string[] = []
  for (const command of commands) {
    const index = content.indexOf(command, cursor)
    if (index < 0) {
      missing.push(command)
      continue
    }
    cursor = index + command.length
  }
  expect(missing).toEqual([])
}

const expectWorkflowInputs = (content: string, inputs: string[]) => {
  expect(content).toContain('workflow_dispatch:')
  for (const input of inputs) {
    expect(content).toContain(`${input}:`)
  }
}

describe('release workflow contracts', () => {
  it('keeps Release Data Package guarded before publishing assets', async () => {
    const workflow = await readWorkflow('release_data.yml')

    expect(workflow).toContain('push:')
    expect(workflow).toContain("- 'data-*'")
    expect(workflow).toContain('PARKKING_INPUT_TAG: ${{ inputs.tag }}')
    expectCommandsInOrder(workflow, [
      'npm run ops:release-data-inputs',
      'npm run ops:render-blueprint-check',
      'npm run ops:release-data-prepare-sources',
      'npm run ops:release-data-preflight',
      'npm run ops:workflow-publish-ingest -- --configs-env RELEASE_CONFIGS_GLOB --allow-warn-env RELEASE_ALLOW_WARN --override-env RELEASE_OVERRIDE_REASON',
      'npm run build',
      'npm run ops:bundle-budget',
      'npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --timeout-ms 25000',
      'npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --view MAP --limit 1 --timeout-ms 25000',
      'npm run ops:release-handoff-readiness -- --skip-build',
      'npm run ops:release-data-publish',
      'npm run ops:release-data-url-smoke',
    ])
    expect(workflow).toContain('.tmp/release-handoff-readiness.md')
    expect(workflow).toContain('.tmp/release-handoff-readiness.json')
    expect(workflow).toContain(
      "PARKKING_RELEASE_DOWNLOAD_TOKEN: ${{ github.event.repository.private && github.token || '' }}",
    )
    expect(workflow).not.toContain(
      'PARKKING_RELEASE_DOWNLOAD_TOKEN: ${{ github.token }}',
    )
  })

  it('keeps Publish Packs guarded by reviewed UI smokes before release gates', async () => {
    const workflow = await readWorkflow('publish.yml')

    expectCommandsInOrder(workflow, [
      'npm run ops:render-blueprint-check',
      'npm run ops:workflow-publish-ingest',
      'npm run ops:smoke-generated-packs -- --root public/data/generated --registry public/data/generated/registry.json --use-reviewed-cases --reviewed',
      'npm run ops:smoke-parking-answer-apis -- --root public/data/generated --registry public/data/generated/registry.json --use-reviewed-cases --reviewed --timeout-ms 25000',
      'npm run build',
      'npm run ops:bundle-budget',
      'npm run ops:smoke-api-services -- --start-preview --timeout-ms 25000 --sync-issue-roundtrip',
      'npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --timeout-ms 25000',
      'npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --view MAP --limit 1 --timeout-ms 25000',
      'npm run ops:p1-release-readiness',
      'npm run ops:release-handoff-readiness -- --skip-build',
    ])
    expect(workflow).toContain('.tmp/release-handoff-readiness.md')
    expect(workflow).toContain('.tmp/release-handoff-readiness.json')
  })

  it('keeps Render Live Verify wired to live release inputs', async () => {
    const workflow = await readWorkflow('render_live_verify.yml')

    expect(workflow).toContain('PARKKING_RENDER_APP_URL: ${{ inputs.appUrl }}')
    expect(workflow).toContain(
      'PARKKING_RELEASE_MANIFEST_URL: ${{ inputs.manifestUrl }}',
    )
    expect(workflow).toContain(
      "PARKKING_RELEASE_DOWNLOAD_TOKEN: ${{ inputs.useGithubToken && github.token || '' }}",
    )
    expect(workflow).toContain(
      "run: npm run ops:render-deployment-verify -- ${{ inputs.skipSyncIssueRoundtrip && '--skip-sync-issue-roundtrip' || '' }}",
    )
    expect(workflow).toMatch(
      /- name: Summarize verification\s+if: always\(\)\s+run: npm run ops:append-workflow-summary -- --append-file \.tmp\/render-deployment-verify\.md/,
    )
    expect(workflow).toMatch(
      /- name: Upload verification artifacts\s+if: always\(\)\s+uses: actions\/upload-artifact@v4/,
    )
    expect(workflow).toContain('name: render-live-verify')
    expect(workflow).toContain('.tmp/render-deployment-verify.md')
    expect(workflow).toContain('.tmp/render-deployment-verify.json')
    expect(workflow).not.toContain('--skip-api-services')
  })

  it('keeps Render Runtime Env Sync wired to Render API credentials and artifacts', async () => {
    const workflow = await readWorkflow('render_runtime_env_sync.yml')

    expectWorkflowInputs(workflow, [
      'serviceId',
      'serviceName',
      'packageUrl',
      'manifestUrl',
      'execute',
      'deploy',
      'deployMode',
    ])
    expect(workflow).toContain('workflow_run:')
    expect(workflow).toContain('Release Data Package')
    expect(workflow).toContain("startsWith(github.event.workflow_run.head_branch, 'data-')")
    expect(workflow).toContain('RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}')
    expect(workflow).toContain(
      'PARKKING_RENDER_SERVICE_ID: ${{ secrets.PARKKING_RENDER_SERVICE_ID }}',
    )
    expect(workflow).toContain(
      'PARKKING_RENDER_SERVICE_NAME: ${{ secrets.PARKKING_RENDER_SERVICE_NAME }}',
    )
    expect(workflow).toContain(
      'PARKKING_WORKFLOW_EVENT_NAME: ${{ github.event_name }}',
    )
    expect(workflow).toContain(
      'PARKKING_WORKFLOW_RUN_HEAD_BRANCH: ${{ github.event.workflow_run.head_branch }}',
    )
    expect(workflow).toContain(
      'PARKKING_INPUT_SERVICE_ID: ${{ github.event.inputs.serviceId }}',
    )
    expect(workflow).toContain('npm run ops:render-runtime-env-sync-workflow')
    expect(workflow).toMatch(
      /- name: Summarize sync\s+if: always\(\)\s+run: npm run ops:append-workflow-summary -- --append-file \.tmp\/render-runtime-env-sync\.md/,
    )
    expect(workflow).toMatch(
      /- name: Upload sync artifact\s+if: always\(\)\s+uses: actions\/upload-artifact@v4/,
    )
    expect(workflow).toContain('name: render-runtime-env-sync')
    expect(workflow).toContain('.tmp/render-runtime-env-sync.md')
    expect(workflow).toContain('.tmp/render-runtime-env-sync.json')
  })

  it('keeps Production Rollout Status wired to release manifest inputs and artifacts', async () => {
    const workflow = await readWorkflow('production_rollout_status.yml')

    expectWorkflowInputs(workflow, [
      'appUrl',
      'manifestUrl',
      'packageUrl',
      'checkLive',
      'requireLivePass',
      'skipReleaseLookup',
    ])
    expect(workflow).toContain('npm run ops:production-rollout-status')
    expect(workflow).toContain('--app-url "${{ inputs.appUrl }}"')
    expect(workflow).toContain('--manifest-url "${{ inputs.manifestUrl }}"')
    expect(workflow).toContain('--package-url "${{ inputs.packageUrl }}"')
    expect(workflow).toContain("${{ inputs.checkLive && '--check-live' || '' }}")
    expect(workflow).toContain(
      "${{ inputs.requireLivePass && '--require-live-pass' || '' }}",
    )
    expect(workflow).toContain(
      "${{ inputs.skipReleaseLookup && '--skip-release-lookup' || '' }}",
    )
    expect(workflow).toContain('npm run ops:render-dashboard-env-packet')
    expect(workflow).toContain('--handoff-json .tmp/production-rollout-handoff.json')
    expect(workflow).toMatch(
      /- name: Summarize rollout status\s+if: always\(\)\s+run: npm run ops:append-workflow-summary -- --append-file \.tmp\/production-rollout-status\.md --append-file \.tmp\/render-dashboard-env-packet\.md/,
    )
    expect(workflow).toContain('name: production-rollout-status')
    expect(workflow).toContain('.tmp/production-rollout-status.md')
    expect(workflow).toContain('.tmp/production-rollout-status.json')
    expect(workflow).toContain('.tmp/production-rollout-handoff.json')
    expect(workflow).toContain('.tmp/render-dashboard-env-packet.md')
    expect(workflow).toContain('.tmp/render-dashboard-env-packet.json')
  })

  it('keeps Release Data Package dispatch helper aligned with workflow inputs', async () => {
    const [workflow, packageJson] = await Promise.all([
      readWorkflow('release_data.yml'),
      readPackageJson(),
    ])

    expect(packageJson.scripts?.['ops:release-data-dispatch']).toBe(
      'tsx scripts/ops/dispatchReleaseDataWorkflow.ts',
    )
    expect(packageJson.scripts?.['ops:release-data-inputs']).toBe(
      'tsx scripts/ops/releaseDataWorkflowInputs.ts',
    )
    expect(packageJson.scripts?.['ops:release-data-prepare-sources']).toBe(
      'tsx scripts/ops/releaseDataPrepareSources.ts',
    )
    expect(packageJson.scripts?.['ops:release-data-preflight']).toBe(
      'tsx scripts/ops/releaseDataPreflight.ts',
    )
    expectWorkflowInputs(workflow, [
      'configsGlob',
      'allowWarn',
      'overrideReason',
      'tag',
      'latest',
    ])
  })

  it('keeps Render Live Verify dispatch helper aligned with workflow inputs', async () => {
    const [workflow, packageJson] = await Promise.all([
      readWorkflow('render_live_verify.yml'),
      readPackageJson(),
    ])

    expect(packageJson.scripts?.['ops:render-live-verify-dispatch']).toBe(
      'tsx scripts/ops/dispatchRenderLiveVerifyWorkflow.ts',
    )
    expectWorkflowInputs(workflow, [
      'appUrl',
      'manifestUrl',
      'useGithubToken',
      'skipSyncIssueRoundtrip',
    ])
  })

  it('keeps Render Runtime Env Sync dispatch helper aligned with workflow inputs', async () => {
    const [workflow, packageJson] = await Promise.all([
      readWorkflow('render_runtime_env_sync.yml'),
      readPackageJson(),
    ])

    expect(packageJson.scripts?.['ops:render-runtime-env-sync-dispatch']).toBe(
      'tsx scripts/ops/dispatchRenderRuntimeEnvSyncWorkflow.ts',
    )
    expect(packageJson.scripts?.['ops:render-runtime-env-sync-workflow']).toBe(
      'tsx scripts/ops/renderRuntimeEnvSyncWorkflow.ts',
    )
    expectWorkflowInputs(workflow, [
      'serviceId',
      'serviceName',
      'packageUrl',
      'manifestUrl',
      'execute',
      'deploy',
      'deployMode',
    ])
  })

  it('keeps Production Rollout Status dispatch helper aligned with workflow inputs', async () => {
    const [workflow, packageJson] = await Promise.all([
      readWorkflow('production_rollout_status.yml'),
      readPackageJson(),
    ])

    expect(packageJson.scripts?.['ops:production-rollout-status-dispatch']).toBe(
      'tsx scripts/ops/dispatchProductionRolloutStatusWorkflow.ts',
    )
    expectWorkflowInputs(workflow, [
      'appUrl',
      'manifestUrl',
      'packageUrl',
      'checkLive',
      'requireLivePass',
      'skipReleaseLookup',
    ])
  })

  it('keeps local release handoff runner available for sequential gating', async () => {
    const packageJson = await readPackageJson()

    expect(packageJson.scripts?.['ops:release-handoff-readiness']).toBe(
      'tsx scripts/ops/releaseHandoffReadiness.ts',
    )
    expect(packageJson.scripts?.['ops:release-handoff-status']).toBe(
      'tsx scripts/ops/releaseHandoffStatus.ts',
    )
    expect(packageJson.scripts?.['ops:production-rollout-status']).toBe(
      'tsx scripts/ops/productionRolloutStatus.ts',
    )
    expect(packageJson.scripts?.['ops:render-dashboard-env-packet']).toBe(
      'tsx scripts/ops/renderDashboardEnvPacket.ts',
    )
    expect(packageJson.scripts?.['ops:release-data-publish-handoff']).toBe(
      'tsx scripts/ops/publishReleaseDataFromHandoff.ts',
    )
  })

  it('keeps generic and Songshan P2 candidate shortcuts pinned to safe entrypoints', async () => {
    const packageJson = await readPackageJson()
    const scripts = packageJson.scripts ?? {}
    const songshanShortcutNames = [
      'ops:p2-songshan-human-review-handoff',
      'ops:p2-songshan-review-intake',
      'ops:p2-songshan-review-gate-report',
      'ops:p2-songshan-review-gate',
      'ops:p2-songshan-finalize-ready',
      'ops:p2-songshan-finalize-ready:execute',
    ]

    expect(scripts['ops:p2-candidate-advance']).toBe(
      'tsx scripts/ops/p2CandidateAdvance.ts',
    )
    expect(scripts['ops:p2-candidate-advance:execute']).toBe(
      'tsx scripts/ops/p2CandidateAdvance.ts --execute',
    )

    expect(scripts['ops:p2-songshan-status']).toContain(
      '--expansion-district songshan',
    )
    expect(scripts['ops:p2-songshan-status']).toContain(
      '--configs "configs/prod/xinyi.json,configs/expansion/songshan.json"',
    )
    expect(scripts['ops:p2-songshan-status']).toContain(
      '--config-root configs/expansion',
    )
    expect(scripts['ops:p2-songshan-status']).toContain('--skip-p1')
    expect(scripts['ops:p2-songshan-review-diagnostics']).toContain(
      '--district songshan',
    )
    expect(scripts['ops:p2-songshan-promote']).toBe(
      'tsx scripts/ops/p2PromoteExpansion.ts --district songshan',
    )
    expect(scripts['ops:p2-songshan-promote:execute']).toBe(
      'tsx scripts/ops/p2PromoteExpansion.ts --district songshan --execute',
    )
    for (const shortcutName of songshanShortcutNames) {
      const script = scripts[shortcutName] ?? ''
      expect(script).toContain('--district songshan')
      expect(script).toContain('--config-root configs/expansion')
      expect(script).not.toContain('daan,zhongshan')
    }
  })

  it('keeps CI typechecking deploy ops helpers before build', async () => {
    const workflow = await readWorkflow('ci.yml')

    expectCommandsInOrder(workflow, [
      'npm run lint -- --max-warnings=0',
      'npm run ops:typecheck-deploy',
      'npm run build',
    ])
  })

  it('keeps CI P2 automation blockers visible while preserving artifact upload', async () => {
    const workflow = await readWorkflow('ci.yml')

    expectCommandsInOrder(workflow, [
      'npm run ops:p2-human-review-handoff -- --report-only',
      'npm run ops:p2-status -- --skip-p1 --report-only',
      'npm run ops:p2-review-diagnostics -- --report-only',
      'npm run ops:append-workflow-summary -- --append-file .tmp/p2-human-review-handoff.md --append-file .tmp/p2-status.md --append-file .tmp/p2-review-diagnostics.md',
    ])
    expect(workflow).not.toContain('ops:p2-human-review-handoff || true')
    expect(workflow).not.toContain('ops:p2-status -- --skip-p1 || true')
    expect(workflow).not.toContain('ops:p2-review-diagnostics || true')
  })
})
