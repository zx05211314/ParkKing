import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  SmokeExactParkingAnswersOptions,
  SmokeExactParkingAnswersSummary,
} from './smokeExactParkingAnswers'
import {
  buildSmokeGeneratedPackPlan,
  discoverGeneratedPackDirs,
  parseSmokeGeneratedPacksArgs,
  renderSmokeGeneratedPacksResult,
  resolveGeneratedPackSource,
  resolveSmokeGeneratedPacksSummaryPath,
  runSmokeGeneratedPacks,
  type SmokeGeneratedPacksRunners,
} from './smokeGeneratedPacks'
import type {
  SmokeParkingAnswersOptions,
  SmokeParkingAnswersSummary,
} from './smokeParkingAnswers'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'smoke-generated-packs-'))

const writePackMeta = async (root: string, districtId: string) => {
  const districtDir = path.join(root, districtId)
  await fs.mkdir(districtDir, { recursive: true })
  await fs.writeFile(
    path.join(districtDir, 'dataset_meta.json'),
    JSON.stringify({ districtId, datasetHash: `${districtId}-hash` }, null, 2),
  )
  return districtDir
}

const makeParkingSummary = (
  options: SmokeParkingAnswersOptions,
): SmokeParkingAnswersSummary => ({
  datasetDir: options.datasetDir ?? 'missing',
  datasetHash: 'hash-1',
  dayHHMM: '13:00',
  nightHHMM: '21:00',
  segmentCount: 3,
  dayEvaluatedCount: 3,
  nightEvaluatedCount: 3,
  dayParkAnswers: 1,
  dayNoStopAnswers: 1,
  nightParkAnswers: 1,
  nightNoStopAnswers: 1,
  nightGreenParkAnswers: 1,
  nightYellowParkAnswers: 0,
  dayReasonCoveragePct: 100,
  nightReasonCoveragePct: 100,
})

const makeExactSummary = (
  options: SmokeExactParkingAnswersOptions,
): SmokeExactParkingAnswersSummary => ({
  datasetDir: options.datasetDir ?? 'missing',
  datasetHash: 'hash-1',
  hhmm: '21:00',
  searchRadiusMeters: 25,
  evaluatedCount: 3,
  samples: [],
  casesPath: options.casesPath,
  caseResults: options.casesPath
    ? [
        {
          id: 'case-1',
          label: null,
          hhmm: '21:00',
          location: [121.56, 25.03],
          searchRadiusMeters: 25,
          expectedKind: 'PARK',
          answerKind: 'PARK',
          expectedEvidenceKind: 'MARKED_SPACE',
          evidenceKind: 'MARKED_SPACE',
          expectedPrimarySegmentId: 'seg-1',
          primarySegmentId: 'seg-1',
          distanceMeters: 0,
          parkingSpaceCount: 1,
          pass: true,
          errors: [],
        },
      ]
    : [],
  counts: {
    parkAnswers: 1,
    noStopAnswers: 1,
    markedSpaceParkAnswers: 1,
  },
})

const makeRunners = (calls: {
  parking: SmokeParkingAnswersOptions[]
  exact: SmokeExactParkingAnswersOptions[]
}): SmokeGeneratedPacksRunners => ({
  runSmokeParkingAnswers: async (options) => {
    calls.parking.push(options)
    return makeParkingSummary(options)
  },
  runSmokeExactParkingAnswers: async (options) => {
    calls.exact.push(options)
    return makeExactSummary(options)
  },
})

describe('smokeGeneratedPacks', () => {
  it('parses generated-pack smoke options', () => {
    expect(
      parseSmokeGeneratedPacksArgs([
        'node',
        'smokeGeneratedPacks',
        '--root',
        'data/generated',
        '--registry',
        'data/generated/registry.json',
        '--report',
        'data/generated/ingest_all_report_dry.json',
        '--answer-cases-dir',
        'configs/prod',
        '--summary',
        '.tmp/summary.md',
        '--fixture-thresholds',
        '--use-reviewed-cases',
        '--reviewed',
        '--require-reviewed-cases',
        'xinyi,daan',
        '--require-reviewed-cases',
        'zhongshan',
      ]),
    ).toEqual({
      root: 'data/generated',
      registryPath: 'data/generated/registry.json',
      reportPath: 'data/generated/ingest_all_report_dry.json',
      answerCasesDir: 'configs/prod',
      summaryPath: '.tmp/summary.md',
      fixtureThresholds: true,
      useReviewedCases: true,
      reviewed: true,
      requiredReviewedCaseDistricts: ['xinyi', 'daan', 'zhongshan'],
      requireGenerated: true,
      scanDirectories: false,
    })
  })

  it('uses GITHUB_STEP_SUMMARY when no summary path is passed', () => {
    expect(
      resolveSmokeGeneratedPacksSummaryPath(
        {},
        { GITHUB_STEP_SUMMARY: '.tmp/workflow-summary.md' },
      ),
    ).toBe('.tmp/workflow-summary.md')
    expect(
      resolveSmokeGeneratedPacksSummaryPath(
        { summaryPath: '.tmp/explicit-summary.md' },
        { GITHUB_STEP_SUMMARY: '.tmp/workflow-summary.md' },
      ),
    ).toBe('.tmp/explicit-summary.md')
  })

  it('discovers generated pack directories from dataset metadata', async () => {
    const root = await makeTempRoot()
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'daan')

    await expect(discoverGeneratedPackDirs(root)).resolves.toEqual([
      path.join(root, 'daan'),
      path.join(root, 'xinyi'),
    ])
    await expect(discoverGeneratedPackDirs(path.join(root, 'missing'))).resolves.toEqual(
      [],
    )
  })

  it('discovers generated pack directories from a registry when provided', async () => {
    const root = await makeTempRoot()
    const registryPath = path.join(root, 'registry.json')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'daan')
    await writePackMeta(root, 'stale')
    await fs.writeFile(
      registryPath,
      JSON.stringify(
        {
          districts: [{ districtId: 'xinyi' }, { districtId: 'daan' }],
        },
        null,
        2,
      ),
    )

    await expect(discoverGeneratedPackDirs(root, registryPath)).resolves.toEqual([
      path.join(root, 'daan'),
      path.join(root, 'xinyi'),
    ])
  })

  it('defaults to the root registry when present unless scanning directories is requested', async () => {
    const root = await makeTempRoot()
    const registryPath = await writePackMeta(root, 'xinyi').then(async () => {
      const out = path.join(root, 'registry.json')
      await fs.writeFile(
        out,
        JSON.stringify({ districts: [{ districtId: 'xinyi' }] }, null, 2),
      )
      return out
    })

    await expect(resolveGeneratedPackSource({ root })).resolves.toEqual({
      registryPath,
      reportPath: null,
    })
    await expect(
      resolveGeneratedPackSource({ root, scanDirectories: true }),
    ).resolves.toEqual({
      registryPath: null,
      reportPath: null,
    })
  })

  it('uses the root registry by default and ignores stale generated directories', async () => {
    const root = await makeTempRoot()
    const registryPath = path.join(root, 'registry.json')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'stale')
    await fs.writeFile(
      registryPath,
      JSON.stringify({ districts: [{ districtId: 'xinyi' }] }, null, 2),
    )
    const calls = { parking: [] as SmokeParkingAnswersOptions[], exact: [] as SmokeExactParkingAnswersOptions[] }

    const result = await runSmokeGeneratedPacks(
      { root },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(result.registryPath).toBe(registryPath)
    expect(result.packResults.map((pack) => pack.districtId)).toEqual(['xinyi'])
    expect(calls.parking).toHaveLength(1)
  })

  it('applies fixture thresholds without requiring reviewed cases', async () => {
    const root = await makeTempRoot()
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'daan')
    const calls = { parking: [] as SmokeParkingAnswersOptions[], exact: [] as SmokeExactParkingAnswersOptions[] }

    const result = await runSmokeGeneratedPacks(
      { root, fixtureThresholds: true },
      makeRunners(calls),
    )

    const daanParking = calls.parking.find((call) =>
      call.datasetDir?.endsWith(`${path.sep}daan`),
    )
    const daanExact = calls.exact.find((call) =>
      call.datasetDir?.endsWith(`${path.sep}daan`),
    )
    const xinyiExact = calls.exact.find((call) =>
      call.datasetDir?.endsWith(`${path.sep}xinyi`),
    )

    expect(result.hasErrors).toBe(false)
    expect(daanParking).toMatchObject({ minNoStopAnswers: 0 })
    expect(daanExact).toMatchObject({
      minNoStopAnswers: 0,
      minMarkedSpaceParkAnswers: 0,
    })
    expect(xinyiExact).toMatchObject({ minMarkedSpaceParkAnswers: 0 })
    expect(xinyiExact?.casesPath).toBeUndefined()
  })

  it('uses reviewed cases when requested and enforces required districts', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'zhongshan')
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    const calls = { parking: [] as SmokeParkingAnswersOptions[], exact: [] as SmokeExactParkingAnswersOptions[] }

    const result = await runSmokeGeneratedPacks(
      {
        root,
        answerCasesDir: casesDir,
        useReviewedCases: true,
        requiredReviewedCaseDistricts: ['xinyi'],
      },
      makeRunners(calls),
    )

    const xinyiExact = calls.exact.find((call) =>
      call.datasetDir?.endsWith(`${path.sep}xinyi`),
    )
    const zhongshanExact = calls.exact.find((call) =>
      call.datasetDir?.endsWith(`${path.sep}zhongshan`),
    )

    expect(result.hasErrors).toBe(false)
    expect(xinyiExact?.casesPath).toBe(path.join(casesDir, 'xinyi.answer-cases.json'))
    expect(zhongshanExact?.casesPath).toBeUndefined()
    expect(renderSmokeGeneratedPacksResult(result)).toContain(
      `Reviewed cases: used ${path.join(casesDir, 'xinyi.answer-cases.json')}`,
    )
  })

  it('discovers required reviewed districts when reviewed mode is requested', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'zhongshan')
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    await fs.writeFile(path.join(casesDir, 'zhongshan.answer-cases.json'), '{}')
    const calls = { parking: [] as SmokeParkingAnswersOptions[], exact: [] as SmokeExactParkingAnswersOptions[] }

    const result = await runSmokeGeneratedPacks(
      {
        root,
        answerCasesDir: casesDir,
        reviewed: true,
      },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(result.packResults.map((pack) => ({
      districtId: pack.districtId,
      required: pack.reviewedCasesRequired,
      used: pack.reviewedCasesUsed,
    }))).toEqual([
      { districtId: 'xinyi', required: true, used: true },
      { districtId: 'zhongshan', required: true, used: true },
    ])
  })

  it('fails closed when a required reviewed case file is missing', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    const calls = { parking: [] as SmokeParkingAnswersOptions[], exact: [] as SmokeExactParkingAnswersOptions[] }

    const plan = await buildSmokeGeneratedPackPlan(path.join(root, 'xinyi'), {
      answerCasesDir: casesDir,
      requiredReviewedCaseDistricts: ['xinyi'],
    })
    const result = await runSmokeGeneratedPacks(
      {
        root,
        answerCasesDir: casesDir,
        requiredReviewedCaseDistricts: ['xinyi'],
      },
      makeRunners(calls),
    )

    expect(plan.skipExact).toBe(true)
    expect(result.hasErrors).toBe(true)
    expect(calls.parking).toHaveLength(1)
    expect(calls.exact).toHaveLength(0)
    expect(renderSmokeGeneratedPacksResult(result)).toContain(
      'Reviewed exact answer cases are required for generated district xinyi',
    )
  })

  it('fails when no generated packs are found unless explicitly allowed', async () => {
    const root = path.join(await makeTempRoot(), 'missing')
    const calls = { parking: [] as SmokeParkingAnswersOptions[], exact: [] as SmokeExactParkingAnswersOptions[] }

    await expect(
      runSmokeGeneratedPacks({ root }, makeRunners(calls)),
    ).resolves.toMatchObject({
      hasErrors: true,
      errors: [`No generated district packs found under ${root}.`],
    })
    await expect(
      runSmokeGeneratedPacks({ root, requireGenerated: false }, makeRunners(calls)),
    ).resolves.toMatchObject({
      hasErrors: false,
      errors: [],
    })
  })
})
