import { describe, expect, it, vi } from 'vitest'
import type { GenerateBaselinesArgs, RegistryEntry } from './generateBaselineTypes'
import {
  resolveGenerateBaselineOutputAction,
  runGenerateBaselineEntryWorkflow,
} from './generateBaselineEntryWorkflow'
import type { GenerateBaselineWorkflowDeps } from './generateBaselineWorkflowTypes'

const entry: RegistryEntry = {
  districtId: 'xinyi',
  districtName: 'Xinyi',
  generatedAt: '2026-01-01T00:00:00.000Z',
  datasetHash: 'hash-a',
  schemaVersion: 1,
}

const args: GenerateBaselinesArgs = {
  force: false,
  seed: false,
  districtIdFilter: null,
}

const benchResult = {
  medianEvalFirstMs: 12,
  medianEvalSecondMs: 18,
  distribution: { ideal: 1 },
  reasonCodes: { coveragePct: 100, counts: { RULE_OK: 1 } },
  evaluatedCount: 1,
}

const createDeps = (overrides?: Partial<GenerateBaselineWorkflowDeps>) => {
  const log = vi.fn()
  return {
    deps: {
      ensureDir: vi.fn(async () => {}),
      outputExists: vi.fn(async () => false),
      findDatasetDir: vi.fn(async () => '/datasets/xinyi'),
      readDatasetMeta: vi.fn(async () => ({
        meta: {
          counts: {
            segments: 10,
            intersections: 2,
            inferredCandidates: 1,
            signOverrides: 0,
          },
        },
        metaRaw: '{"counts":{"segments":10}}',
      })),
      runMedianBench: vi.fn(async () => benchResult),
      writeBaseline: vi.fn(async () => {}),
      log,
      ...overrides,
    } satisfies GenerateBaselineWorkflowDeps,
    log,
  }
}

describe('resolveGenerateBaselineOutputAction', () => {
  it('skips existing outputs unless force is enabled', () => {
    expect(
      resolveGenerateBaselineOutputAction({
        outputExists: true,
        force: false,
        seed: false,
      }),
    ).toBe('skip-existing')
    expect(
      resolveGenerateBaselineOutputAction({
        outputExists: true,
        force: true,
        seed: false,
      }),
    ).toBe('write')
  })

  it('requires seed or force to create missing outputs', () => {
    expect(
      resolveGenerateBaselineOutputAction({
        outputExists: false,
        force: false,
        seed: false,
      }),
    ).toBe('skip-missing')
    expect(
      resolveGenerateBaselineOutputAction({
        outputExists: false,
        force: false,
        seed: true,
      }),
    ).toBe('write')
  })
})

describe('runGenerateBaselineEntryWorkflow', () => {
  it('skips existing outputs when not forced', async () => {
    const { deps, log } = createDeps({
      outputExists: vi.fn(async () => true),
    })

    await expect(
      runGenerateBaselineEntryWorkflow({
        args,
        entry,
        baselineDir: '/baselines',
        deps,
      }),
    ).resolves.toEqual({
      status: 'skipped',
      districtId: 'xinyi',
    })

    expect(deps.findDatasetDir).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(
      'Baseline exists for xinyi. Re-run with --force to overwrite.',
    )
  })

  it('writes a new baseline when allowed', async () => {
    const { deps, log } = createDeps()

    await expect(
      runGenerateBaselineEntryWorkflow({
        args: { ...args, seed: true },
        entry,
        baselineDir: '/baselines',
        deps,
      }),
    ).resolves.toEqual({
      status: 'written',
      districtId: 'xinyi',
    })

    expect(deps.runMedianBench).toHaveBeenNthCalledWith(1, '/datasets/xinyi', '13:00')
    expect(deps.runMedianBench).toHaveBeenNthCalledWith(2, '/datasets/xinyi', '21:00')
    expect(deps.writeBaseline).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Wrote baseline'))
  })
})
