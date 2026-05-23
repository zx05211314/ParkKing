import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildNotifyNightlyArgsFromRegistry,
  buildNotifyNightlyDiffInputsFromDistricts,
  loadNotifyNightlyRegistryDistricts,
  parseNotifyNightlyFromRegistryArgs,
  runNotifyNightlyFromRegistry,
} from './notifyNightlyFromRegistry'
import type { NotifyNightlyArgs } from './notifyNightlyTypes'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'notify-nightly-registry-'))

const writeRegistry = async (root: string, districtIds: string[]) => {
  const registryPath = path.join(root, 'registry.json')
  await fs.writeFile(
    registryPath,
    JSON.stringify(
      { districts: districtIds.map((districtId) => ({ districtId })) },
      null,
      2,
    ),
  )
  return registryPath
}

describe('notifyNightlyFromRegistry', () => {
  it('parses wrapper flags and preserves notify-nightly passthrough args', () => {
    expect(
      parseNotifyNightlyFromRegistryArgs([
        'node',
        'notifyNightlyFromRegistry.ts',
        '--registry',
        'public/data/generated/registry.json',
        '--root',
        'public/data/generated',
        '--issue-input',
        '.tmp/nightly-issue-artifacts/manifest.json',
        '--issue-limit',
        '3',
      ]),
    ).toEqual({
      registryPath: 'public/data/generated/registry.json',
      root: 'public/data/generated',
      notifyArgv: [
        '--issue-input',
        '.tmp/nightly-issue-artifacts/manifest.json',
        '--issue-limit',
        '3',
      ],
    })
  })

  it('loads safe district ids from the registry', async () => {
    const root = await makeTempRoot()
    const registryPath = await writeRegistry(root, ['xinyi', 'daan'])

    await expect(loadNotifyNightlyRegistryDistricts(registryPath)).resolves.toEqual([
      'xinyi',
      'daan',
    ])
  })

  it('rejects unsafe registry district ids', async () => {
    const root = await makeTempRoot()
    const registryPath = await writeRegistry(root, ['../xinyi'])

    await expect(loadNotifyNightlyRegistryDistricts(registryPath)).rejects.toThrow(
      'Invalid district id in registry',
    )
  })

  it('builds diff inputs and notify args from registry districts', () => {
    const diffInputs = buildNotifyNightlyDiffInputsFromDistricts(
      'public/data/generated',
      ['xinyi', 'daan'],
    )
    const args = buildNotifyNightlyArgsFromRegistry({
      diffInputs,
      notifyArgv: [
        '--issue-input',
        '.tmp/nightly-issue-artifacts/manifest.json',
        '--publish-gate-summary',
        'public/data/generated/_ops/publish_gate_summary.json',
      ],
    })

    expect(diffInputs).toEqual([
      path.join('public/data/generated', 'xinyi'),
      path.join('public/data/generated', 'daan'),
    ])
    expect(args).toMatchObject({
      diffPaths: diffInputs,
      issueInputPath: '.tmp/nightly-issue-artifacts/manifest.json',
      publishGateSummaryPath: 'public/data/generated/_ops/publish_gate_summary.json',
    })
  })

  it('calls notify-nightly with registry-scoped diff paths', async () => {
    const root = await makeTempRoot()
    const registryPath = await writeRegistry(root, ['xinyi'])
    const calls: NotifyNightlyArgs[] = []

    const result = await runNotifyNightlyFromRegistry(
      {
        registryPath,
        root,
        notifyArgv: ['--issue-limit', '2'],
      },
      {
        notifyNightly: async (args) => {
          calls.push(args)
        },
      },
    )

    expect(result).toMatchObject({
      districtIds: ['xinyi'],
      diffInputs: [path.join(root, 'xinyi')],
      skipped: false,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      diffPaths: [path.join(root, 'xinyi')],
      issueLimit: 2,
    })
  })

  it('skips cleanly when registry has no districts', async () => {
    const root = await makeTempRoot()
    const registryPath = await writeRegistry(root, [])
    const calls: NotifyNightlyArgs[] = []

    const result = await runNotifyNightlyFromRegistry(
      { registryPath, root },
      {
        notifyNightly: async (args) => {
          calls.push(args)
        },
      },
    )

    expect(result).toMatchObject({
      districtIds: [],
      diffInputs: [],
      skipped: true,
    })
    expect(calls).toEqual([])
  })
})
