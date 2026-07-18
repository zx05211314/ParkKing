import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  parseReleaseRolloutWorkflowArgs,
  readReleaseRolloutHandoff,
  runReleaseRolloutWorkflow,
  type ReleaseRolloutCommandRunner,
} from './releaseRolloutWorkflow'

const validHandoff = {
  ready: true,
  release: {
    releaseId: '20260718185036_fda8323',
    tag: 'data-20260718185036_fda8323',
  },
  packageUrl: 'https://example.test/release.zip',
  manifestUrl: 'https://example.test/release.json',
  expectedDatasets: [
    {
      districtId: 'xinyi',
      datasetHash: 'hash-xinyi',
      publishedAt: '2026-07-18T18:46:26Z',
    },
  ],
}

describe('releaseRolloutWorkflow', () => {
  it('downloads the exact upstream artifact and validates its handoff', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-rollout-'))
    const downloadRoot = path.join(base, 'artifact')
    const handoffJsonPath = path.join(
      downloadRoot,
      '.tmp',
      'render-deployment-handoff.json',
    )
    await fs.mkdir(path.dirname(handoffJsonPath), { recursive: true })
    await fs.writeFile(
      handoffJsonPath,
      `${JSON.stringify(validHandoff)}\n`,
      'utf-8',
    )
    const commands: string[][] = []
    const runner: ReleaseRolloutCommandRunner = (command, args) => {
      commands.push([command, ...args])
      return { status: 0 }
    }

    const options = parseReleaseRolloutWorkflowArgs(
      [
        '--mode',
        'download-handoff',
        '--download-root',
        downloadRoot,
      ],
      {
        GITHUB_REPOSITORY: 'zx05211314/ParkKing',
        PARKKING_UPSTREAM_RUN_ID: '29655633970',
      },
    )
    const result = await runReleaseRolloutWorkflow(options, runner)

    expect(commands).toEqual([
      [
        'gh',
        'run',
        'download',
        '29655633970',
        '--repo',
        'zx05211314/ParkKing',
        '--name',
        'release-data-package',
        '--dir',
        downloadRoot,
      ],
    ])
    expect(result.handoff).toMatchObject({
      ready: true,
      releaseTag: 'data-20260718185036_fda8323',
      districtCount: 1,
    })
  })

  it('marks only the validated handoff release as latest', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-latest-'))
    const handoffJsonPath = path.join(base, 'handoff.json')
    await fs.writeFile(
      handoffJsonPath,
      `${JSON.stringify(validHandoff)}\n`,
      'utf-8',
    )
    const commands: string[][] = []

    const result = await runReleaseRolloutWorkflow(
      parseReleaseRolloutWorkflowArgs(
        [
          '--mode',
          'mark-latest',
          '--handoff-json',
          handoffJsonPath,
        ],
        {
          GITHUB_REPOSITORY: 'zx05211314/ParkKing',
        },
      ),
      (command, args) => {
        commands.push([command, ...args])
        return { status: 0 }
      },
    )

    expect(result.handoff.releaseId).toBe('20260718185036_fda8323')
    expect(commands).toEqual([
      [
        'gh',
        'release',
        'edit',
        'data-20260718185036_fda8323',
        '--repo',
        'zx05211314/ParkKing',
        '--latest',
      ],
    ])
  })

  it('rejects a handoff that is not ready for production rollout', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-invalid-'))
    const handoffJsonPath = path.join(base, 'handoff.json')
    await fs.writeFile(
      handoffJsonPath,
      `${JSON.stringify({
        ...validHandoff,
        ready: false,
      })}\n`,
      'utf-8',
    )

    await expect(readReleaseRolloutHandoff(handoffJsonPath)).rejects.toThrow(
      'handoff is not marked ready',
    )
  })

  it('rejects a handoff without complete district release identities', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-identity-'))
    const handoffJsonPath = path.join(base, 'handoff.json')
    await fs.writeFile(
      handoffJsonPath,
      `${JSON.stringify({
        ...validHandoff,
        expectedDatasets: [
          {
            districtId: 'xinyi',
            datasetHash: 'hash-xinyi',
          },
        ],
      })}\n`,
      'utf-8',
    )

    await expect(readReleaseRolloutHandoff(handoffJsonPath)).rejects.toThrow(
      'expectedDatasets has incomplete district identities: xinyi',
    )
  })
})
