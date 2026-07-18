import { describe, expect, it, vi } from 'vitest'
import type { GenerateBaselinesArgs, RegistryEntry } from './generateBaselineTypes'
import {
  runGenerateBaselineWorkflow,
} from './generateBaselineWorkflow'
import type { GenerateBaselineWorkflowDeps } from './generateBaselineWorkflow'

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
  generatedRoot: 'public/data/generated',
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
  const deps: GenerateBaselineWorkflowDeps = {
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
  }
  return { deps, log }
}

describe('runGenerateBaselineWorkflow', () => {
  it('writes a new baseline when seed mode is enabled', async () => {
    const { deps, log } = createDeps()

    const result = await runGenerateBaselineWorkflow(
      {
        args: { ...args, seed: true },
        entries: [entry],
        baselineDir: '/baselines',
      },
      deps,
    )

    expect(result).toEqual({
      skipped: [],
      written: ['xinyi'],
    })
    expect(deps.ensureDir).toHaveBeenCalled()
    expect(deps.findDatasetDir).toHaveBeenCalledWith('xinyi')
    expect(deps.runMedianBench).toHaveBeenNthCalledWith(1, '/datasets/xinyi', '13:00')
    expect(deps.runMedianBench).toHaveBeenNthCalledWith(2, '/datasets/xinyi', '21:00')
    expect(deps.writeBaseline).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Wrote baseline'))
  })

  it('skips existing outputs when force is disabled', async () => {
    const { deps, log } = createDeps({
      outputExists: vi.fn(async () => true),
    })

    const result = await runGenerateBaselineWorkflow(
      {
        args,
        entries: [entry],
        baselineDir: '/baselines',
      },
      deps,
    )

    expect(result).toEqual({
      skipped: ['xinyi'],
      written: [],
    })
    expect(deps.findDatasetDir).not.toHaveBeenCalled()
    expect(deps.writeBaseline).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(
      'Baseline exists for xinyi. Re-run with --force to overwrite.',
    )
  })

  it('skips missing outputs when seed and force are both disabled', async () => {
    const { deps, log } = createDeps()

    const result = await runGenerateBaselineWorkflow(
      {
        args,
        entries: [entry],
        baselineDir: '/baselines',
      },
      deps,
    )

    expect(result).toEqual({
      skipped: ['xinyi'],
      written: [],
    })
    expect(deps.findDatasetDir).not.toHaveBeenCalled()
    expect(deps.writeBaseline).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(
      'Baseline missing for xinyi. Re-run with --seed to create.',
    )
  })
})
