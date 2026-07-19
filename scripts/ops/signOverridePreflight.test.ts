import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runSignOverridePreflight } from './signOverridePreflight'
import { buildSignOverridePreflight } from './signOverridePreflightState'

const writeFixtureConfig = async (base: string) => {
  const repoRoot = process.cwd()
  const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
  const configPath = path.join(base, 'xinyi.json')
  const config = {
    districtId: 'xinyi',
    districtName: 'Xinyi Test',
    inputs: {
      districtBounds: path.join(fixturesDir, 'xinyi_boundary.geojson'),
      redYellow: path.join(fixturesDir, 'red_yellow.geojson'),
      busStops: path.join(fixturesDir, 'bus_stops.geojson'),
      hydrants: path.join(fixturesDir, 'hydrants.geojson'),
    },
    outputs: {
      generatedDir: path.join(base, 'generated'),
      publicDir: path.join(base, 'public'),
    },
    crs: { default: 'EPSG:4326' },
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  return configPath
}

describe('runSignOverridePreflight', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes json output when requested', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sign-override-preflight-cli-'))
    const configPath = await writeFixtureConfig(base)
    const inputPath = path.join(base, 'xinyi-overrides.jsonl')
    const outPath = path.join(base, 'preflight.json')
    await fs.writeFile(
      inputPath,
      `${JSON.stringify({
        schemaVersion: 2,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        reviewedSegmentId: 'seg-1',
        reviewedHhmm: '21:00',
        status: 'LEGAL',
        note: 'field checked',
        createdAt: '2026-04-01T00:00:00Z',
      })}\n`,
      'utf-8',
    )

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runSignOverridePreflight([
      'node',
      'test',
      '--config',
      configPath,
      '--input',
      inputPath,
      '--json',
      '--out',
      outPath,
    ])

    const written = JSON.parse(await fs.readFile(outPath, 'utf-8')) as {
      districtId: string
      matchedSegmentOverrides: number
      knownSegments: number
    }

    expect(written.districtId).toBe('xinyi')
    expect(written.knownSegments).toBeGreaterThan(0)
    expect(typeof written.matchedSegmentOverrides).toBe('number')
    expect(logSpy).toHaveBeenCalled()
  })

  it('reports invalid override timestamps before ingesting sign overrides', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sign-override-preflight-invalid-time-'))
    const configPath = await writeFixtureConfig(base)
    const inputPath = path.join(base, 'xinyi-overrides.jsonl')

    await fs.writeFile(
      inputPath,
      `${JSON.stringify({
        schemaVersion: 2,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        reviewedSegmentId: 'seg-1',
        reviewedHhmm: '21:00',
        status: 'LEGAL',
        note: 'field checked',
        createdAt: 'not-a-date',
      })}\n`,
      'utf-8',
    )

    const result = await buildSignOverridePreflight(configPath, inputPath)

    expect(result.validReports).toBe(0)
    expect(result.invalidReportIssues).toMatchObject([
      {
        reportNumber: 1,
        reasons: ['createdAt must be an ISO timestamp with timezone'],
      },
    ])
  })
})
