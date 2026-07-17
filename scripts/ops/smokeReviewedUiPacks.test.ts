import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseSmokeReviewedUiPacksArgs,
  renderSmokeReviewedUiPacksResult,
  resolveSmokeReviewedUiPacksSuiteTimeoutMs,
  resolveSmokeReviewedUiPacksSummaryPath,
  runSmokeReviewedUiPacks,
  type SmokeReviewedUiPacksRunners,
} from './smokeReviewedUiPacks'
import type {
  SmokeUiParkingAnswersOptions,
  SmokeUiParkingAnswersSummary,
} from './smokeUiParkingAnswers'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'smoke-reviewed-ui-packs-'))

const writePackMeta = async (root: string, districtId: string) => {
  const districtDir = path.join(root, districtId)
  await fs.mkdir(districtDir, { recursive: true })
  await fs.writeFile(
    path.join(districtDir, 'dataset_meta.json'),
    JSON.stringify({ districtId, datasetHash: `${districtId}-hash` }, null, 2),
  )
}

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

const makeSummary = (
  options: SmokeUiParkingAnswersOptions,
): SmokeUiParkingAnswersSummary => ({
  appUrl: options.appUrl ?? 'http://127.0.0.1:4173',
  casesPath: options.casesPath ?? 'missing',
  district: options.district ?? 'xinyi',
  view: options.view ?? 'LIST',
  caseDatasetHash: 'hash-1',
  runtimeDatasetHash: 'hash-1',
  caseCount: 1,
  passCount: 1,
  results: [
    {
      id: 'case-1',
      label: null,
      url: 'http://127.0.0.1:4173',
      view: options.view ?? 'LIST',
      expectedKind: 'PARK',
      expectedEvidenceKind: 'MARKED_SPACE',
      requiredText: ['Pinned location answer'],
      pass: true,
      missingText: [],
    },
  ],
})

const makeRunners = (calls: SmokeUiParkingAnswersOptions[]): SmokeReviewedUiPacksRunners => ({
  runSmokeUiParkingAnswers: async (options) => {
    calls.push(options)
    return makeSummary(options)
  },
})

describe('smokeReviewedUiPacks', () => {
  it('parses reviewed UI pack smoke options', () => {
    expect(
      parseSmokeReviewedUiPacksArgs([
        'node',
        'smokeReviewedUiPacks',
        '--root',
        'public/data/generated',
        '--registry',
        'public/data/generated/registry.json',
        '--answer-cases-dir',
        'configs/prod',
        '--summary',
        '.tmp/summary.md',
        '--reviewed',
        '--require-reviewed-cases',
        'xinyi,daan',
        '--app-url',
        'http://127.0.0.1:4173',
        '--chrome-path',
        'C:\\Chrome\\chrome.exe',
        '--timeout-ms',
        '5000',
        '--suite-timeout-ms',
        '12000',
        '--limit',
        '2',
        '--view',
        'MAP',
        '--no-start-preview',
        '--allow-mismatched-case-hash',
      ]),
    ).toEqual({
      root: 'public/data/generated',
      registryPath: 'public/data/generated/registry.json',
      reportPath: undefined,
      answerCasesDir: 'configs/prod',
      summaryPath: '.tmp/summary.md',
      requiredReviewedCaseDistricts: ['xinyi', 'daan'],
      reviewed: true,
      requireGenerated: true,
      scanDirectories: false,
      appUrl: 'http://127.0.0.1:4173',
      chromePath: 'C:\\Chrome\\chrome.exe',
      timeoutMs: 5000,
      suiteTimeoutMs: 12000,
      startPreview: false,
      limit: 2,
      view: 'MAP',
      allowMismatchedCaseHash: true,
    })
  })

  it('bounds the full multi-district suite by default', () => {
    expect(resolveSmokeReviewedUiPacksSuiteTimeoutMs(5000)).toBe(15000)
    expect(resolveSmokeReviewedUiPacksSuiteTimeoutMs(5000, undefined, 12)).toBe(
      60000,
    )
    expect(resolveSmokeReviewedUiPacksSuiteTimeoutMs(5000, 15000)).toBe(15000)
  })

  it('uses GITHUB_STEP_SUMMARY when no summary path is passed', () => {
    expect(
      resolveSmokeReviewedUiPacksSummaryPath(
        {},
        { GITHUB_STEP_SUMMARY: '.tmp/workflow-summary.md' },
      ),
    ).toBe('.tmp/workflow-summary.md')
    expect(
      resolveSmokeReviewedUiPacksSummaryPath(
        { summaryPath: '.tmp/explicit-summary.md' },
        { GITHUB_STEP_SUMMARY: '.tmp/workflow-summary.md' },
      ),
    ).toBe('.tmp/explicit-summary.md')
  })

  it('runs UI smoke for districts with reviewed case files', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'daan')
    const registryPath = await writeRegistry(root, ['xinyi', 'daan'])
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    const calls: SmokeUiParkingAnswersOptions[] = []

    const result = await runSmokeReviewedUiPacks(
      {
        root,
        registryPath,
        answerCasesDir: casesDir,
        requiredReviewedCaseDistricts: ['xinyi'],
        timeoutMs: 5000,
        view: 'MAP',
      },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(calls).toEqual([
      expect.objectContaining({
        casesPath: path.join(casesDir, 'xinyi.answer-cases.json'),
        district: 'xinyi',
        startPreview: true,
        timeoutMs: 5000,
        view: 'MAP',
      }),
    ])
    expect(renderSmokeReviewedUiPacksResult(result)).toContain(
      'UI cases: 1/1; view MAP',
    )
  })

  it('forwards the reviewed-case hash mismatch allowance to UI smokes', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    const registryPath = await writeRegistry(root, ['xinyi'])
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    const calls: SmokeUiParkingAnswersOptions[] = []

    const result = await runSmokeReviewedUiPacks(
      {
        root,
        registryPath,
        answerCasesDir: casesDir,
        allowMismatchedCaseHash: true,
      },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(calls[0]).toMatchObject({
      casesPath: path.join(casesDir, 'xinyi.answer-cases.json'),
      district: 'xinyi',
      allowMismatchedCaseHash: true,
    })
  })

  it('discovers required reviewed UI case districts when reviewed mode is requested', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'daan')
    const registryPath = await writeRegistry(root, ['xinyi', 'daan'])
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    const calls: SmokeUiParkingAnswersOptions[] = []

    const result = await runSmokeReviewedUiPacks(
      {
        root,
        registryPath,
        answerCasesDir: casesDir,
        reviewed: true,
      },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(result.packResults.map((pack) => ({
      districtId: pack.districtId,
      required: pack.reviewedCasesRequired,
      found: pack.reviewedCasesFound,
    }))).toEqual([
      { districtId: 'daan', required: false, found: false },
      { districtId: 'xinyi', required: true, found: true },
    ])
    expect(calls).toHaveLength(1)
  })

  it('uses the root registry by default and ignores stale generated directories', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'stale')
    await writeRegistry(root, ['xinyi'])
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    const calls: SmokeUiParkingAnswersOptions[] = []

    const result = await runSmokeReviewedUiPacks(
      { root, answerCasesDir: casesDir },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(result.registryPath).toBe(path.join(root, 'registry.json'))
    expect(result.packResults.map((pack) => pack.districtId)).toEqual(['xinyi'])
    expect(calls).toHaveLength(1)
  })

  it('fails closed when a required reviewed UI case file is missing', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    const registryPath = await writeRegistry(root, ['xinyi'])
    const calls: SmokeUiParkingAnswersOptions[] = []

    const result = await runSmokeReviewedUiPacks(
      {
        root,
        registryPath,
        answerCasesDir: casesDir,
        requiredReviewedCaseDistricts: ['xinyi'],
      },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(true)
    expect(calls).toEqual([])
    expect(renderSmokeReviewedUiPacksResult(result)).toContain(
      'Reviewed UI answer cases are required for generated district xinyi',
    )
  })

  it('reports a found case file when its UI smoke fails', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    const registryPath = await writeRegistry(root, ['xinyi'])
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')

    const result = await runSmokeReviewedUiPacks(
      {
        root,
        registryPath,
        answerCasesDir: casesDir,
        requiredReviewedCaseDistricts: ['xinyi'],
      },
      {
        runSmokeUiParkingAnswers: async () => {
          throw new Error('UI smoke timed out')
        },
      },
    )
    const rendered = renderSmokeReviewedUiPacksResult(result)

    expect(result.hasErrors).toBe(true)
    expect(rendered).toContain('found but UI smoke did not complete')
    expect(rendered).not.toContain('missing required')
  })

  it('passes when optional districts have no reviewed UI case file', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'daan')
    const registryPath = await writeRegistry(root, ['daan'])
    const calls: SmokeUiParkingAnswersOptions[] = []

    const result = await runSmokeReviewedUiPacks(
      { root, registryPath, answerCasesDir: casesDir },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(calls).toEqual([])
    expect(renderSmokeReviewedUiPacksResult(result)).toContain('not found; skipped')
  })

  it('fails when no generated packs are found unless explicitly allowed', async () => {
    const root = path.join(await makeTempRoot(), 'missing')
    const calls: SmokeUiParkingAnswersOptions[] = []

    await expect(
      runSmokeReviewedUiPacks({ root }, makeRunners(calls)),
    ).resolves.toMatchObject({
      hasErrors: true,
      errors: [`No generated district packs found under ${root}.`],
    })
    await expect(
      runSmokeReviewedUiPacks({ root, requireGenerated: false }, makeRunners(calls)),
    ).resolves.toMatchObject({
      hasErrors: false,
      errors: [],
    })
  })
})
