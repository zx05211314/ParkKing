import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildReleaseHandoffReadinessSteps,
  parseReleaseHandoffReadinessArgs,
  renderReleaseHandoffReadiness,
  resolveReleaseHandoffReadinessInputs,
  runReleaseHandoffReadiness,
} from './releaseHandoffReadiness'

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const writeGateOutputs = async (
  base: string,
  params: {
    p3ReleaseId: string
    deployReleaseId: string
    handoffReleaseId: string
    handoffReady?: boolean
  },
) => {
  const p3JsonPath = path.join(base, 'p3.json')
  const deployJsonPath = path.join(base, 'deploy.json')
  const handoffJsonPath = path.join(base, 'handoff.json')

  await Promise.all([
    writeJson(p3JsonPath, {
      pass: true,
      releasePackage: {
        summary: {
          releaseId: params.p3ReleaseId,
        },
      },
    }),
    writeJson(deployJsonPath, {
      pass: true,
      release: {
        releaseId: params.deployReleaseId,
      },
    }),
    writeJson(handoffJsonPath, {
      ready: params.handoffReady ?? true,
      release: {
        releaseId: params.handoffReleaseId,
      },
    }),
  ])

  return { p3JsonPath, deployJsonPath, handoffJsonPath }
}

describe('releaseHandoffReadiness', () => {
  it('parses defaults and explicit dry-run options', () => {
    expect(
      parseReleaseHandoffReadinessArgs([
        'node',
        'releaseHandoffReadiness.ts',
        '--dry-run',
        '--skip-build',
        '--log-dir',
        '.tmp/logs',
      ]),
    ).toMatchObject({
      dryRun: true,
      skipBuild: true,
      logDir: '.tmp/logs',
      p3JsonPath: '.tmp/p3-release-readiness.json',
      deployJsonPath: '.tmp/deploy-readiness.json',
      handoffJsonPath: '.tmp/render-deployment-handoff.json',
    })
  })

  it('builds the guarded sequence in release-safe order', () => {
    const inputs = resolveReleaseHandoffReadinessInputs({
      logDir: '.tmp/logs',
      p3JsonPath: '.tmp/p3.json',
      deployJsonPath: '.tmp/deploy.json',
      handoffJsonPath: '.tmp/handoff.json',
    })

    const steps = buildReleaseHandoffReadinessSteps(inputs)

    expect(steps.map((step) => step.id)).toEqual([
      'build',
      'p3-release-readiness',
      'deploy-readiness',
      'render-deployment-handoff',
    ])
    expect(steps[1]?.args).toContain('scripts/ops/p3ReleaseReadiness.ts')
    expect(steps[2]?.args).toContain('scripts/ops/deployReadiness.ts')
    expect(steps[3]?.args).toContain('scripts/ops/renderDeploymentHandoff.ts')
    expect(steps[3]?.args).toContain('.tmp/p3.json')
    expect(steps[3]?.args).toContain('.tmp/deploy.json')
  })

  it('passes when all gates agree on the same release ID', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-handoff-pass-'))
    const gatePaths = await writeGateOutputs(base, {
      p3ReleaseId: 'release-a',
      deployReleaseId: 'release-a',
      handoffReleaseId: 'release-a',
    })
    const executed: string[] = []

    const result = await runReleaseHandoffReadiness(
      {
        skipBuild: true,
        logDir: path.join(base, 'logs'),
        ...gatePaths,
      },
      async (step) => {
        executed.push(step.id)
        return 0
      },
    )

    expect(result.pass).toBe(true)
    expect(executed).toEqual([
      'p3-release-readiness',
      'deploy-readiness',
      'render-deployment-handoff',
    ])
    expect(result.gates).toMatchObject({
      p3ReleaseId: 'release-a',
      deployReleaseId: 'release-a',
      handoffReleaseId: 'release-a',
    })
    expect(renderReleaseHandoffReadiness(result)).toContain(
      '# Release Handoff Readiness: PASS',
    )
  })

  it('fails when successful gates point at different release IDs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-handoff-mismatch-'))
    const gatePaths = await writeGateOutputs(base, {
      p3ReleaseId: 'release-a',
      deployReleaseId: 'release-b',
      handoffReleaseId: 'release-a',
    })

    const result = await runReleaseHandoffReadiness(
      {
        skipBuild: true,
        logDir: path.join(base, 'logs'),
        ...gatePaths,
      },
      async () => 0,
    )

    expect(result.pass).toBe(false)
    expect(result.blockers).toContain(
      'Gate release IDs do not match: release-a, release-b',
    )
  })

  it('stops after the first failed step', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-handoff-fail-'))
    const executed: string[] = []

    const result = await runReleaseHandoffReadiness(
      {
        skipBuild: true,
        logDir: path.join(base, 'logs'),
      },
      async (step) => {
        executed.push(step.id)
        return step.id === 'deploy-readiness' ? 2 : 0
      },
    )

    expect(result.pass).toBe(false)
    expect(executed).toEqual(['p3-release-readiness', 'deploy-readiness'])
    expect(result.blockers).toEqual([
      'Deploy readiness failed with exit code 2',
    ])
  })
})
