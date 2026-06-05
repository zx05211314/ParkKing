import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseSignOverridePreflightBatchArgs,
  renderSignOverridePreflightBatchResult,
  resolveSignOverridePreflightConfigPaths,
  runSignOverridePreflightBatch,
} from './signOverridePreflightBatch'
import type { SignOverridePreflightResult } from './signOverridePreflightTypes'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'sign-override-preflight-batch-'))

const makeResult = (
  configPath: string,
  districtId = path.basename(configPath, '.json'),
): SignOverridePreflightResult => ({
  districtId,
  districtName: districtId,
  configPath,
  inputPath: path.join('data/overrides', `${districtId}.jsonl`),
  inputExists: false,
  inputWarning: null,
  knownSegments: 2,
  rawReports: 0,
  validReports: 0,
  skippedInvalidReports: 0,
  skippedForeignDistrictReports: 0,
  effectiveOverrides: 0,
  duplicateSegmentsCollapsed: 0,
  matchedSegmentOverrides: 0,
  missingSegmentOverrides: 0,
  statusCounts: {
    LEGAL: 0,
    ILLEGAL: 0,
    UNCLEAR: 0,
  },
  duplicateSegmentIds: [],
  missingSegmentIds: [],
  missingIssues: [],
  invalidReportIssues: [],
})

describe('signOverridePreflightBatch', () => {
  it('parses config glob, output directory, and local flags', () => {
    expect(
      parseSignOverridePreflightBatchArgs([
        'node',
        'signOverridePreflightBatch',
        '--configs',
        'configs/prod/*.json',
        '--out-dir',
        '.tmp/sign-override-preflight',
        '--json',
        '--allow-missing',
      ]),
    ).toEqual({
      configsGlob: 'configs/prod/*.json',
      outDir: '.tmp/sign-override-preflight',
      json: true,
      allowMissing: true,
    })
  })

  it('resolves matching config files deterministically', async () => {
    const root = await makeTempRoot()
    await fs.writeFile(path.join(root, 'xinyi.json'), '{}')
    await fs.writeFile(path.join(root, 'daan.json'), '{}')
    await fs.writeFile(path.join(root, 'xinyi.answer-cases.json'), '{}')

    await expect(
      resolveSignOverridePreflightConfigPaths(
        path.join(root, '*.json').replace(/\\/g, '/'),
      ),
    ).resolves.toEqual([
      path.join(root, 'daan.json').replace(/\\/g, '/'),
      path.join(root, 'xinyi.json').replace(/\\/g, '/'),
    ])
  })

  it('runs preflight for every matched config and writes markdown outputs', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    const xinyiConfig = path.join(root, 'xinyi.json')
    await fs.writeFile(xinyiConfig, '{}')
    const calls: string[] = []

    const result = await runSignOverridePreflightBatch(
      {
        configsGlob: path.join(root, '*.json').replace(/\\/g, '/'),
        outDir,
      },
      {
        buildPreflight: async (configPath) => {
          calls.push(configPath)
          return makeResult(configPath, 'xinyi')
        },
      },
    )

    const outputPath = path.join(outDir, 'xinyi.md')
    await expect(fs.readFile(outputPath, 'utf-8')).resolves.toContain(
      '# Sign Override Preflight: xinyi (xinyi)',
    )
    expect(calls).toEqual([xinyiConfig.replace(/\\/g, '/')])
    expect(result.hasErrors).toBe(false)
    expect(renderSignOverridePreflightBatchResult(result)).toContain(
      'Sign override preflight batch: PASS',
    )
  })

  it('writes JSON outputs when requested', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    const configPath = path.join(root, 'xinyi.json')
    await fs.writeFile(configPath, '{}')

    await runSignOverridePreflightBatch(
      {
        configsGlob: path.join(root, '*.json').replace(/\\/g, '/'),
        outDir,
        json: true,
      },
      {
        buildPreflight: async () => makeResult(configPath, 'xinyi'),
      },
    )

    await expect(fs.readFile(path.join(outDir, 'xinyi.json'), 'utf-8')).resolves.toContain(
      '"districtId": "xinyi"',
    )
  })

  it('fails when no configs match unless explicitly allowed', async () => {
    const root = await makeTempRoot()
    const configsGlob = path.join(root, '*.json').replace(/\\/g, '/')

    await expect(runSignOverridePreflightBatch({ configsGlob })).resolves.toMatchObject({
      hasErrors: true,
      errors: [`No configs matched: ${configsGlob}`],
    })
    await expect(
      runSignOverridePreflightBatch({ configsGlob, allowMissing: true }),
    ).resolves.toMatchObject({
      hasErrors: false,
      errors: [],
    })
  })
})
