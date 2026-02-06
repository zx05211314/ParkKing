import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { diffPacks } from './diffPacks'
import { buildGateAnomalyReport, reportGateAnomalies } from './reportGateAnomalies'

const normalizeReport = (value: Record<string, unknown>) => {
  const copy = structuredClone(value)
  ;(copy as { generatedAt?: string }).generatedAt = '<generatedAt>'
  return copy
}

describe('reportGateAnomalies', () => {
  it('builds deterministic anomaly buckets from fixture packs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-anomaly-'))
    const packDir = path.join(base, 'next')
    const prevDir = path.join(base, 'prev')
    const sourcePrev = path.resolve('tests/fixtures/packs/meta-change/prev')
    const sourcePack = path.resolve('tests/fixtures/packs/meta-change/next')
    await fs.cp(sourcePrev, prevDir, { recursive: true })
    await fs.cp(sourcePack, packDir, { recursive: true })

    const csvPath = path.join(base, 'sources', 'hydrants.csv')
    await fs.mkdir(path.dirname(csvPath), { recursive: true })
    const csvBytes = Buffer.concat([
      Buffer.from([0xff]),
      Buffer.from('wgs_lat\tcoord_x\n1\t2\n', 'utf-8'),
    ])
    await fs.writeFile(csvPath, csvBytes)

    const shpPath = path.join(base, 'sources', 'road_centerlines.shp')
    await fs.writeFile(shpPath, Buffer.from('not-a-real-shp', 'utf-8'))

    const metaPath = path.join(packDir, 'dataset_meta.json')
    const rawMeta = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(rawMeta) as Record<string, unknown>
    meta.sourceFiles = [{ path: csvPath }, { path: shpPath }]
    meta.boundaryCenter = [10, 10]
    meta.publishedAt = '2026-02-02T00:00:00.000Z'
    await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8')

    const prevMetaPath = path.join(prevDir, 'dataset_meta.json')
    const rawPrevMeta = await fs.readFile(prevMetaPath, 'utf-8')
    const prevMeta = JSON.parse(rawPrevMeta) as Record<string, unknown>
    prevMeta.publishedAt = '2026-02-01T00:00:00.000Z'
    await fs.writeFile(prevMetaPath, `${JSON.stringify(prevMeta, null, 2)}\n`, 'utf-8')

    await fs.writeFile(
      path.join(packDir, 'bus_stops.geojson'),
      JSON.stringify(
        {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { id: 'bad-1' }, geometry: null }],
        },
        null,
        2,
      ),
      'utf-8',
    )

    const diff = await diffPacks({ prevDir, nextDir: packDir })
    diff.districts[0]?.issues.push({
      severity: 'WARN',
      code: 'DIFF_CURB_MARKING_DROP',
      message: 'curbMarkingKnownRate dropped',
      metric: { prev: 0.9, next: 0.6, drop: 0.3 },
      threshold: { maxDrop: 0.1 },
    })
    await fs.writeFile(
      path.join(packDir, 'diff_report.json'),
      `${JSON.stringify(diff, null, 2)}\n`,
      'utf-8',
    )

    const outPath = path.join(base, 'reports', 'gate_anomalies_beta.json')
    const reportA = await buildGateAnomalyReport({
      districtId: 'beta',
      packPath: packDir,
      outPath,
    })
    const reportB = await buildGateAnomalyReport({
      districtId: 'beta',
      packPath: packDir,
      outPath,
    })

    expect(normalizeReport(reportA as unknown as Record<string, unknown>)).toEqual(
      normalizeReport(reportB as unknown as Record<string, unknown>),
    )
    expect(reportA.parsingFallbacks.big5Fallback.used).toBe(true)
    expect(reportA.parsingFallbacks.tabDelimiter.used).toBe(true)
    expect(reportA.parsingFallbacks.headerMatchFallback.used).toBe(true)
    expect(reportA.parsingFallbacks.missingPrjHeuristic.used).toBe(true)
    expect(reportA.prevPackPath).toBe(path.resolve(prevDir))
    expect(reportA.nextPackPath).toBe(path.resolve(packDir))
    expect(reportA.prevPublishedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(reportA.nextPublishedAt).toBe('2026-02-02T00:00:00.000Z')
    expect(reportA.prevDistrictIds).toEqual(['beta'])
    expect(reportA.nextDistrictIds).toEqual(['beta'])

    const busStopsLayer = reportA.invalidGeometry.layers.find((entry) => entry.layer === 'bus_stops.geojson')
    expect(busStopsLayer?.totalInvalid).toBe(1)
    expect(reportA.thresholdDeltas.issues.map((issue) => issue.code)).toContain(
      'DIFF_CURB_MARKING_DROP',
    )
    expect(reportA.bboxCenterAnomalies.map((entry) => entry.code)).toContain(
      'BOUNDARY_CENTER_OUTSIDE_BBOX',
    )
    expect(reportA.topOffenders.biggestCountDelta?.field).toBe('segmentsCount')
    expect(reportA.topOffenders.metricTrigger?.code).toBe('DIFF_CURB_MARKING_DROP')

    const written = await reportGateAnomalies({
      districtId: 'beta',
      packPath: packDir,
      outPath,
    })
    const rawWritten = await fs.readFile(outPath, 'utf-8')
    const parsedWritten = JSON.parse(rawWritten) as Record<string, unknown>
    expect(normalizeReport(parsedWritten)).toEqual(
      normalizeReport(written as unknown as Record<string, unknown>),
    )
  })
})
