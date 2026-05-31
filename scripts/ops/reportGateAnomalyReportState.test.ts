import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadGateAnomalyReportState } from './reportGateAnomalyReportState'

describe('reportGateAnomalyReportState', () => {
  it('loads anomaly report state sections from a pack', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'gate-anomaly-report-state-'))
    const prevDir = path.join(baseDir, 'prev')
    const packDir = path.join(baseDir, 'next')
    await fs.mkdir(prevDir, { recursive: true })
    await fs.mkdir(packDir, { recursive: true })

    await fs.writeFile(
      path.join(prevDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'beta', publishedAt: '2026-02-01T00:00:00.000Z' }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(packDir, 'dataset_meta.json'),
      JSON.stringify({
        districtId: 'beta',
        publishedAt: '2026-02-02T00:00:00.000Z',
        boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        boundaryCenter: [10, 10],
      }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(packDir, 'bus_stops.geojson'),
      JSON.stringify({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: null }],
      }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(packDir, 'diff_report.json'),
      JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-02-02T00:00:00.000Z',
        prevPath: prevDir,
        nextPath: packDir,
        firstPublish: false,
        summary: {
          districtsAdded: [],
          districtsRemoved: [],
          totalChangedFiles: 1,
        },
        districts: [
          {
            districtId: 'beta',
            status: 'UPDATED',
            severity: 'WARN',
            issues: [],
            meta: {},
            files: { added: [], removed: [], modified: [] },
          },
        ],
      }),
      'utf-8',
    )

    const state = await loadGateAnomalyReportState({
      districtId: 'beta',
      packPath: packDir,
      outPath: path.join(baseDir, 'report.json'),
    })

    expect(state.context.districtId).toBe('beta')
    expect(state.invalidGeometry.totalInvalid).toBe(1)
    expect(state.bboxCenterAnomalies.map((entry) => entry.code)).toContain(
      'BOUNDARY_CENTER_OUTSIDE_BBOX',
    )
  })
})
