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

    expectCommandsInOrder(workflow, [
      'npm run ops:render-blueprint-check',
      'npm run ops:workflow-publish-ingest',
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
    expect(workflow).not.toContain('--skip-api-services')
  })

  it('keeps Release Data Package dispatch helper aligned with workflow inputs', async () => {
    const [workflow, packageJson] = await Promise.all([
      readWorkflow('release_data.yml'),
      readPackageJson(),
    ])

    expect(packageJson.scripts?.['ops:release-data-dispatch']).toBe(
      'tsx scripts/ops/dispatchReleaseDataWorkflow.ts',
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

  it('keeps local release handoff runner available for sequential gating', async () => {
    const packageJson = await readPackageJson()

    expect(packageJson.scripts?.['ops:release-handoff-readiness']).toBe(
      'tsx scripts/ops/releaseHandoffReadiness.ts',
    )
    expect(packageJson.scripts?.['ops:release-handoff-status']).toBe(
      'tsx scripts/ops/releaseHandoffStatus.ts',
    )
    expect(packageJson.scripts?.['ops:release-data-publish-handoff']).toBe(
      'tsx scripts/ops/publishReleaseDataFromHandoff.ts',
    )
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
