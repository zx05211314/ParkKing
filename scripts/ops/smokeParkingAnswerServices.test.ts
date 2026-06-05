import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  SmokeParkingAnswerServiceOptions,
  SmokeParkingAnswerServiceSummary,
} from './smokeParkingAnswerService'
import {
  parseSmokeParkingAnswerServicesArgs,
  renderSmokeParkingAnswerServicesResult,
  runSmokeParkingAnswerServices,
  type SmokeParkingAnswerServicesRunners,
} from './smokeParkingAnswerServices'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'smoke-parking-answer-services-'))

const writePackMeta = async (root: string, districtId: string) => {
  const districtDir = path.join(root, districtId)
  await fs.mkdir(districtDir, { recursive: true })
  await fs.writeFile(
    path.join(districtDir, 'dataset_meta.json'),
    JSON.stringify({ districtId, datasetHash: `${districtId}-hash` }, null, 2),
  )
  return districtDir
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
  options: SmokeParkingAnswerServiceOptions,
): SmokeParkingAnswerServiceSummary => ({
  endpoint: `http://127.0.0.1/${options.district ?? 'missing'}`,
  district: options.district ?? 'missing',
  casesPath: options.casesPath ?? `generated samples from ${options.datasetDir}`,
  datasetHash: `${options.district ?? 'missing'}-hash`,
  probes: options.skipHealthCheck ? [] : ['health', 'ready'],
  passed: 1,
  failed: 0,
  results: [
    {
      id: 'case-1',
      status: 200,
      pass: true,
      errors: [],
      expectedKind: 'PARK',
      answerKind: 'PARK',
      expectedEvidenceKind: null,
      evidenceKind: 'CURB_RULE',
      expectedPrimarySegmentId: null,
      primarySegmentId: 'seg-1',
      trustLabel: 'Sign check needed',
    },
  ],
})

const makeRunners = (calls: SmokeParkingAnswerServiceOptions[] = []): SmokeParkingAnswerServicesRunners => ({
  runSmokeParkingAnswerService: async (options) => {
    calls.push(options)
    return makeSummary(options)
  },
})

describe('smokeParkingAnswerServices', () => {
  it('parses multi-district API smoke options', () => {
    expect(
      parseSmokeParkingAnswerServicesArgs([
        'node',
        'smokeParkingAnswerServices',
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
        '--all-dirs',
        '--timeout-ms',
        '1234',
        '--max-cases',
        '2',
        '--hhmm',
        '13:00',
        '--radius',
        '35',
        '--skip-health-check',
        '--allow-mismatched-case-hash',
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
      requiredReviewedCaseDistricts: ['xinyi', 'daan'],
      requireGenerated: true,
      scanDirectories: true,
      timeoutMs: 1234,
      maxCases: 2,
      hhmm: '13:00',
      searchRadiusMeters: 35,
      skipHealthCheck: true,
      allowMismatchedCaseHash: true,
    })
  })

  it('discovers registry districts and ignores stale generated directories', async () => {
    const root = await makeTempRoot()
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'daan')
    await writePackMeta(root, 'stale')
    const registryPath = await writeRegistry(root, ['xinyi', 'daan'])
    const calls: SmokeParkingAnswerServiceOptions[] = []

    const result = await runSmokeParkingAnswerServices(
      { root, registryPath },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(result.packResults.map((pack) => pack.districtId)).toEqual([
      'daan',
      'xinyi',
    ])
    expect(calls.map((call) => call.district)).toEqual(['daan', 'xinyi'])
    expect(calls.every((call) => call.datasetDir)).toBe(true)
    expect(renderSmokeParkingAnswerServicesResult(result)).toContain(
      'Parking answer API pack smoke: PASS',
    )
  })

  it('applies fixture thresholds across discovered districts', async () => {
    const root = await makeTempRoot()
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'daan')
    const calls: SmokeParkingAnswerServiceOptions[] = []

    await runSmokeParkingAnswerServices(
      { root, fixtureThresholds: true },
      makeRunners(calls),
    )

    const daan = calls.find((call) => call.district === 'daan')
    const xinyi = calls.find((call) => call.district === 'xinyi')
    expect(daan).toMatchObject({
      minNoStopAnswers: 0,
      minMarkedSpaceParkAnswers: 0,
    })
    expect(xinyi).toMatchObject({
      minMarkedSpaceParkAnswers: 0,
    })
    expect(xinyi?.minNoStopAnswers).toBeUndefined()
  })

  it('uses reviewed cases when requested', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'zhongshan')
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    const calls: SmokeParkingAnswerServiceOptions[] = []

    const result = await runSmokeParkingAnswerServices(
      {
        root,
        answerCasesDir: casesDir,
        useReviewedCases: true,
        requiredReviewedCaseDistricts: ['xinyi'],
      },
      makeRunners(calls),
    )

    const xinyi = calls.find((call) => call.district === 'xinyi')
    const zhongshan = calls.find((call) => call.district === 'zhongshan')
    expect(result.hasErrors).toBe(false)
    expect(xinyi?.casesPath).toBe(path.join(casesDir, 'xinyi.answer-cases.json'))
    expect(zhongshan?.casesPath).toBeUndefined()
  })

  it('forwards the reviewed-case hash mismatch allowance to API smokes', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    const calls: SmokeParkingAnswerServiceOptions[] = []

    const result = await runSmokeParkingAnswerServices(
      {
        root,
        answerCasesDir: casesDir,
        useReviewedCases: true,
        allowMismatchedCaseHash: true,
      },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(calls[0]).toMatchObject({
      casesPath: path.join(casesDir, 'xinyi.answer-cases.json'),
      allowMismatchedCaseHash: true,
    })
  })

  it('discovers required reviewed API case districts when reviewed mode is requested', async () => {
    const root = await makeTempRoot()
    const casesDir = path.join(root, 'cases')
    await writePackMeta(root, 'xinyi')
    await writePackMeta(root, 'zhongshan')
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'xinyi.answer-cases.json'), '{}')
    await fs.writeFile(path.join(casesDir, 'zhongshan.answer-cases.json'), '{}')
    const calls: SmokeParkingAnswerServiceOptions[] = []

    const result = await runSmokeParkingAnswerServices(
      {
        root,
        answerCasesDir: casesDir,
        reviewed: true,
      },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(false)
    expect(calls.map((call) => [call.district, call.casesPath])).toEqual([
      ['xinyi', path.join(casesDir, 'xinyi.answer-cases.json')],
      ['zhongshan', path.join(casesDir, 'zhongshan.answer-cases.json')],
    ])
  })

  it('fails closed when required reviewed API cases are missing', async () => {
    const root = await makeTempRoot()
    await writePackMeta(root, 'xinyi')
    const calls: SmokeParkingAnswerServiceOptions[] = []

    const result = await runSmokeParkingAnswerServices(
      {
        root,
        answerCasesDir: path.join(root, 'missing-cases'),
        requiredReviewedCaseDistricts: ['xinyi'],
      },
      makeRunners(calls),
    )

    expect(result.hasErrors).toBe(true)
    expect(calls).toHaveLength(0)
    expect(renderSmokeParkingAnswerServicesResult(result)).toContain(
      'Reviewed API answer cases are required for generated district xinyi',
    )
  })

  it('fails when no generated packs are found unless explicitly allowed', async () => {
    const root = path.join(await makeTempRoot(), 'missing')

    await expect(runSmokeParkingAnswerServices({ root })).resolves.toMatchObject({
      hasErrors: true,
      errors: [`No generated district packs found under ${root}.`],
    })
    await expect(
      runSmokeParkingAnswerServices({ root, requireGenerated: false }),
    ).resolves.toMatchObject({
      hasErrors: false,
      errors: [],
    })
  })
})
