import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseGeneratedPackInventoryArgs,
  renderGeneratedPackInventory,
  resolveGeneratedPackInventorySummaryPath,
  runGeneratedPackInventory,
} from './generatedPackInventory'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'generated-pack-inventory-'))

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

const writeDistrict = async (
  root: string,
  districtId: string,
  options: {
    includeLatest?: boolean
    includeParkingSpaces?: boolean
    signOverrides?: number
    inferredCandidates?: number
    datasetHash?: string
  } = {},
) => {
  const districtDir = path.join(root, districtId)
  await fs.mkdir(districtDir, { recursive: true })
  await writeJson(path.join(districtDir, 'dataset_meta.json'), {
    districtId,
    datasetHash: options.datasetHash ?? `${districtId}-hash`,
    generatedAt: '2026-05-10T00:00:00.000Z',
    publishedAt: options.includeLatest ? '2026-05-10T00:01:00.000Z' : undefined,
    counts: {
      segments: 10,
      parkingSpaces: options.includeParkingSpaces === false ? 0 : 3,
      signOverrides: options.signOverrides ?? 1,
      inferredCandidates: options.inferredCandidates ?? 1,
    },
  })
  await fs.writeFile(path.join(districtDir, 'red_yellow.geojson'), '{}', 'utf-8')
  await fs.writeFile(path.join(districtDir, 'candidates_inferred.geojson'), '{}', 'utf-8')
  await fs.writeFile(path.join(districtDir, 'sign_overrides.geojson'), '{}', 'utf-8')
  if (options.includeParkingSpaces !== false) {
    await fs.writeFile(path.join(districtDir, 'parking_spaces.geojson'), '{}', 'utf-8')
  }
  if (options.includeLatest) {
    await writeJson(path.join(districtDir, 'LATEST.json'), {
      datasetHash: options.datasetHash ?? `${districtId}-hash`,
    })
  }
}

describe('generatedPackInventory', () => {
  it('parses inventory options', () => {
    expect(
      parseGeneratedPackInventoryArgs([
        'node',
        'generatedPackInventory',
        '--root',
        'public/data/generated',
        '--registry',
        'public/data/generated/registry.json',
        '--summary',
        '.tmp/summary.md',
        '--strict',
        '--json',
      ]),
    ).toEqual({
      root: 'public/data/generated',
      registryPath: 'public/data/generated/registry.json',
      summaryPath: '.tmp/summary.md',
      strict: true,
      json: true,
    })
  })

  it('uses GITHUB_STEP_SUMMARY when no explicit summary path is passed', () => {
    expect(
      resolveGeneratedPackInventorySummaryPath(
        {},
        { GITHUB_STEP_SUMMARY: '.tmp/workflow-summary.md' },
      ),
    ).toBe('.tmp/workflow-summary.md')
    expect(
      resolveGeneratedPackInventorySummaryPath(
        { summaryPath: '.tmp/explicit-summary.md' },
        { GITHUB_STEP_SUMMARY: '.tmp/workflow-summary.md' },
      ),
    ).toBe('.tmp/explicit-summary.md')
  })

  it('classifies published, stale, and missing published districts', async () => {
    const root = await makeTempRoot()
    await writeDistrict(root, 'xinyi', {
      includeLatest: true,
      datasetHash: 'xinyi-hash',
    })
    await writeDistrict(root, 'daan', {
      includeParkingSpaces: false,
      signOverrides: 0,
      inferredCandidates: 0,
    })
    await fs.mkdir(path.join(root, '_ops'))
    await writeJson(path.join(root, 'registry.json'), {
      districts: [
        { districtId: 'xinyi', datasetHash: 'xinyi-hash' },
        { districtId: 'zhongshan', datasetHash: 'zhongshan-hash' },
      ],
    })

    const result = await runGeneratedPackInventory({ root })

    expect(result.hasErrors).toBe(false)
    expect(result.hasWarnings).toBe(true)
    expect(result.entries.map((entry) => [entry.districtId, entry.status])).toEqual([
      ['daan', 'stale-unpublished'],
      ['xinyi', 'published'],
      ['zhongshan', 'missing-published-dir'],
    ])
    expect(result.warnings).toContain(
      '[daan] directory is not listed in registry.json; runtime loading ignores it',
    )
    expect(result.warnings).toContain('[daan] parking_spaces.geojson is missing')
    expect(result.warnings).toContain(
      '[zhongshan] registry lists this district, but the district directory is missing',
    )
  })

  it('renders a concise inventory report', async () => {
    const root = await makeTempRoot()
    await writeDistrict(root, 'xinyi', {
      includeLatest: true,
      datasetHash: 'xinyi-hash',
    })
    await writeJson(path.join(root, 'registry.json'), {
      districts: [{ districtId: 'xinyi', datasetHash: 'xinyi-hash' }],
    })

    const report = renderGeneratedPackInventory(await runGeneratedPackInventory({ root }))

    expect(report).toContain('Generated pack inventory: PASS')
    expect(report).toContain('Published districts: 1')
    expect(report).toContain('Stale unpublished dirs: none')
    expect(report).toContain('- PUBLISHED xinyi')
    expect(report).toContain('Critical files: ok')
  })
})
