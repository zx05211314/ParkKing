import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildSignOverridePreflight } from './signOverridePreflightState'

describe('buildSignOverridePreflight', () => {
  it('summarizes duplicate, foreign, matched, and missing override reports', async () => {
    const repoRoot = process.cwd()
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sign-override-preflight-'))
    const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
    const configPath = path.join(base, 'xinyi.json')
    const inputPath = path.join(base, 'xinyi-overrides.jsonl')

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

    const lines = [
      JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        note: 'first check',
        createdAt: '2026-04-01T00:00:00Z',
      }),
      JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'ILLEGAL',
        note: 'second check',
        createdAt: '2026-04-02T00:00:00Z',
      }),
      JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-missing',
        status: 'UNCLEAR',
        note: 'stale id',
        createdAt: '2026-04-03T00:00:00Z',
      }),
      JSON.stringify({
        schemaVersion: 1,
        districtId: 'daan',
        segmentId: 'seg-9',
        status: 'LEGAL',
        note: 'foreign district',
        createdAt: '2026-04-04T00:00:00Z',
      }),
      JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        status: 'LEGAL',
        note: 'missing segment',
        createdAt: '2026-04-05T00:00:00Z',
      }),
    ]

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    await fs.writeFile(inputPath, `${lines.join('\n')}\n`, 'utf-8')

    const result = await buildSignOverridePreflight(configPath, inputPath)

    expect(result.districtId).toBe('xinyi')
    expect(result.inputExists).toBe(true)
    expect(result.inputWarning).toBeNull()
    expect(result.knownSegments).toBe(4)
    expect(result.rawReports).toBe(5)
    expect(result.validReports).toBe(4)
    expect(result.skippedInvalidReports).toBe(1)
    expect(result.invalidReportIssues).toEqual([
      expect.objectContaining({
        reportNumber: 5,
        districtId: 'xinyi',
        segmentId: null,
        status: 'LEGAL',
        reasons: ['segmentId is required'],
      }),
    ])
    expect(result.skippedForeignDistrictReports).toBe(1)
    expect(result.effectiveOverrides).toBe(2)
    expect(result.duplicateSegmentsCollapsed).toBe(1)
    expect(result.matchedSegmentOverrides).toBe(1)
    expect(result.missingSegmentOverrides).toBe(1)
    expect(result.statusCounts).toEqual({
      LEGAL: 0,
      ILLEGAL: 1,
      UNCLEAR: 1,
    })
    expect(result.duplicateSegmentIds).toEqual(['seg-1'])
    expect(result.missingSegmentIds).toEqual(['seg-missing'])
    expect(result.missingIssues).toEqual([
      expect.objectContaining({
        segmentId: 'seg-missing',
        status: 'UNCLEAR',
      }),
    ])
  })

  it('reports zero overrides instead of failing when the input file is missing', async () => {
    const repoRoot = process.cwd()
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sign-override-preflight-'))
    const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
    const configPath = path.join(base, 'xinyi.json')
    const missingInputPath = path.join(base, 'missing-overrides.jsonl')

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

    const result = await buildSignOverridePreflight(configPath, missingInputPath)

    expect(result.inputExists).toBe(false)
    expect(result.inputWarning).toContain('Override input not found')
    expect(result.rawReports).toBe(0)
    expect(result.effectiveOverrides).toBe(0)
    expect(result.matchedSegmentOverrides).toBe(0)
    expect(result.missingSegmentOverrides).toBe(0)
    expect(result.statusCounts).toEqual({
      LEGAL: 0,
      ILLEGAL: 0,
      UNCLEAR: 0,
    })
  })

  it('uses PARKKING_OVERRIDE_REPORTS_DIR for the default override input path', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sign-override-preflight-'))
    const configPath = path.join(base, 'xinyi.json')
    const generatedDir = path.join(base, 'generated')
    const overrideReportsDir = path.join(base, 'env-overrides')
    const previousOverrideReportsDir = process.env.PARKKING_OVERRIDE_REPORTS_DIR

    const config = {
      districtId: 'xinyi',
      districtName: 'Xinyi Test',
      inputs: {
        districtBounds: path.join(base, 'missing-boundary.geojson'),
        redYellow: path.join(base, 'missing-red-yellow.geojson'),
        busStops: path.join(base, 'missing-bus-stops.geojson'),
        hydrants: path.join(base, 'missing-hydrants.geojson'),
      },
      outputs: {
        generatedDir,
        publicDir: path.join(base, 'public'),
      },
      crs: { default: 'EPSG:4326' },
    }
    const redYellow = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 'env-segment-1',
            color: 'yellow',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.56, 25.03],
              [121.561, 25.03],
            ],
          },
        },
      ],
    }
    const overrideReportsPath = path.join(overrideReportsDir, 'xinyi.jsonl')
    const overrideReport = {
      schemaVersion: 1,
      districtId: 'xinyi',
      segmentId: 'seg-1',
      status: 'LEGAL',
      note: 'env scoped review',
      createdAt: '2026-04-01T00:00:00Z',
    }

    await fs.mkdir(generatedDir, { recursive: true })
    await fs.mkdir(overrideReportsDir, { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    await fs.writeFile(config.inputs.districtBounds, '{}', 'utf-8')
    await fs.writeFile(config.inputs.redYellow, '{}', 'utf-8')
    await fs.writeFile(config.inputs.busStops, '{}', 'utf-8')
    await fs.writeFile(config.inputs.hydrants, '{}', 'utf-8')
    await fs.writeFile(
      path.join(generatedDir, 'red_yellow.geojson'),
      JSON.stringify(redYellow),
      'utf-8',
    )
    await fs.writeFile(overrideReportsPath, `${JSON.stringify(overrideReport)}\n`, 'utf-8')

    process.env.PARKKING_OVERRIDE_REPORTS_DIR = overrideReportsDir
    try {
      const result = await buildSignOverridePreflight(configPath)

      expect(result.inputPath).toBe(overrideReportsPath)
      expect(result.inputExists).toBe(true)
      expect(result.rawReports).toBe(1)
      expect(result.effectiveOverrides).toBe(1)
      expect(result.statusCounts).toEqual({
        LEGAL: 1,
        ILLEGAL: 0,
        UNCLEAR: 0,
      })
    } finally {
      if (previousOverrideReportsDir === undefined) {
        delete process.env.PARKKING_OVERRIDE_REPORTS_DIR
      } else {
        process.env.PARKKING_OVERRIDE_REPORTS_DIR = previousOverrideReportsDir
      }
    }
  })

  it('uses generated red_yellow.geojson when available for faster segment discovery', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sign-override-preflight-'))
    const configPath = path.join(base, 'xinyi.json')
    const generatedDir = path.join(base, 'generated')
    const missingInputPath = path.join(base, 'missing-overrides.jsonl')

    const config = {
      districtId: 'xinyi',
      districtName: 'Xinyi Test',
      inputs: {
        districtBounds: path.join(base, 'missing-boundary.geojson'),
        redYellow: path.join(base, 'missing-red-yellow.geojson'),
        busStops: path.join(base, 'missing-bus-stops.geojson'),
        hydrants: path.join(base, 'missing-hydrants.geojson'),
      },
      outputs: {
        generatedDir,
        publicDir: path.join(base, 'public'),
      },
      crs: { default: 'EPSG:4326' },
    }
    const redYellow = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 'generated-segment-1',
            color: 'yellow',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.56, 25.03],
              [121.561, 25.03],
            ],
          },
        },
      ],
    }

    await fs.mkdir(generatedDir, { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    await fs.writeFile(config.inputs.districtBounds, '{}', 'utf-8')
    await fs.writeFile(config.inputs.redYellow, '{}', 'utf-8')
    await fs.writeFile(config.inputs.busStops, '{}', 'utf-8')
    await fs.writeFile(config.inputs.hydrants, '{}', 'utf-8')
    await fs.writeFile(
      path.join(generatedDir, 'red_yellow.geojson'),
      JSON.stringify(redYellow),
      'utf-8',
    )

    const result = await buildSignOverridePreflight(configPath, missingInputPath)

    expect(result.knownSegments).toBe(1)
    expect(result.inputExists).toBe(false)
  })

  it('accepts exact-id override reports for generated inferred candidates', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sign-override-preflight-inferred-'))
    const configPath = path.join(base, 'daan.json')
    const generatedDir = path.join(base, 'generated')
    const inputPath = path.join(base, 'daan-overrides.jsonl')

    const config = {
      districtId: 'daan',
      districtName: 'Daan Test',
      inputs: {
        districtBounds: path.join(base, 'missing-boundary.geojson'),
        redYellow: path.join(base, 'missing-red-yellow.geojson'),
        busStops: path.join(base, 'missing-bus-stops.geojson'),
        hydrants: path.join(base, 'missing-hydrants.geojson'),
      },
      outputs: {
        generatedDir,
        publicDir: path.join(base, 'public'),
      },
      crs: { default: 'EPSG:4326' },
    }
    const redYellow = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'seg-1', color: 'yellow' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.56, 25.03],
              [121.561, 25.03],
            ],
          },
        },
      ],
    }
    const inferred = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'candidate-1-L' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.56, 25.031],
              [121.561, 25.031],
            ],
          },
        },
      ],
    }

    await fs.mkdir(generatedDir, { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    await fs.writeFile(config.inputs.districtBounds, '{}', 'utf-8')
    await fs.writeFile(config.inputs.redYellow, '{}', 'utf-8')
    await fs.writeFile(config.inputs.busStops, '{}', 'utf-8')
    await fs.writeFile(config.inputs.hydrants, '{}', 'utf-8')
    await fs.writeFile(
      path.join(generatedDir, 'red_yellow.geojson'),
      JSON.stringify(redYellow),
      'utf-8',
    )
    await fs.writeFile(
      path.join(generatedDir, 'candidates_inferred.geojson'),
      JSON.stringify(inferred),
      'utf-8',
    )
    await fs.writeFile(
      inputPath,
      `${JSON.stringify({
        schemaVersion: 1,
        districtId: 'daan',
        segmentId: 'candidate-1-L',
        status: 'LEGAL',
        note: 'reviewed inferred candidate',
        createdAt: '2026-04-01T00:00:00Z',
      })}\n`,
      'utf-8',
    )

    const result = await buildSignOverridePreflight(configPath, inputPath)

    expect(result.knownSegments).toBe(2)
    expect(result.matchedSegmentOverrides).toBe(1)
    expect(result.missingSegmentOverrides).toBe(0)
  })
})
