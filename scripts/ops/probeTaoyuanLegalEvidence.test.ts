import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assessTaoyuanLegalEvidence,
  renderTaoyuanLegalEvidenceProbe,
  runTaoyuanLegalEvidenceProbe,
} from './probeTaoyuanLegalEvidence'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  )
})

const endpoint = (
  id: 'parking-segments' | 'parking-spots',
  count: number,
) => ({
  id,
  url: `https://example.test/${id}`,
  status: 200,
  count,
  sampleFields: [],
  error: null,
})

const officialFetch = async (input: string | URL | Request) => {
  const url = String(input)
  const isSpot = url.includes('/ParkingSpot/')
  return new Response(
    JSON.stringify({
      Count: isSpot ? 0 : 3,
      [isSpot ? 'ParkingSegmentSpots' : 'ParkingSegments']: isSpot
        ? []
        : [{ ParkingSegmentID: 'segment-1' }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

describe('probeTaoyuanLegalEvidence', () => {
  it('keeps representative points and an empty spot endpoint out of legal answers', () => {
    const result = assessTaoyuanLegalEvidence({
      probedAt: '2026-07-19T00:00:00.000Z',
      acquisitionMode: 'guest',
      parkingSegments: endpoint('parking-segments', 944),
      parkingSpots: endpoint('parking-spots', 0),
      localSpatial: {
        path: 'paid-curb.geojson',
        contentSha256: 'a'.repeat(64),
        sourceUpdateTime: '2026-07-18T00:00:00.000Z',
        versionId: 1,
        sourceRecordCount: 944,
        featureCount: 944,
        segmentGeometryCount: 0,
        representativePointCount: 944,
        legalAnswerEligible: false,
      },
    })

    expect(result).toMatchObject({
      probePass: true,
      referenceAvailable: true,
      legalAnswerEligible: false,
    })
    expect(result.legalAnswerBlockers).toEqual([
      'The normalized TDX ParkingSegment source has no curb-line geometry; all 944 points are representative references.',
      'The official TDX ParkingSpot endpoint reports zero Taoyuan records.',
      'No official Taoyuan curb-restriction or sign-rule geometry layer is configured.',
    ])
    expect(renderTaoyuanLegalEvidenceProbe(result)).toContain(
      'Legal parking answers eligible: no',
    )
  })

  it('probes both official collections and fails on source-count drift', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'taoyuan-evidence-probe-'),
    )
    roots.push(root)
    const spatialPath = path.join(root, 'paid-curb.geojson')
    const reportPath = path.join(root, 'probe.md')
    const jsonReportPath = path.join(root, 'probe.json')
    await fs.writeFile(
      spatialPath,
      JSON.stringify({
        type: 'FeatureCollection',
        metadata: {
          sourceRecordCount: 2,
          legalAnswerEligible: false,
        },
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [121.3, 24.99] },
            properties: {
              geometryPrecision: 'REPRESENTATIVE_POINT',
              legalAnswerEligible: false,
            },
          },
        ],
      }),
    )

    const result = await runTaoyuanLegalEvidenceProbe({
      spatialPath,
      reportPath,
      jsonReportPath,
      env: { TDX_ALLOW_GUEST: 'true' },
      fetchImpl: officialFetch as typeof fetch,
      now: new Date('2026-07-19T00:00:00.000Z'),
    })

    expect(result.probePass).toBe(false)
    expect(result.errors).toContain(
      'TDX ParkingSegment count 3 does not match local sourceRecordCount 2.',
    )
    await expect(fs.readFile(reportPath, 'utf-8')).resolves.toContain(
      'ParkingSpot: HTTP 200; count=0',
    )
    await expect(fs.readFile(jsonReportPath, 'utf-8')).resolves.toContain(
      '"probePass": false',
    )
  })

  it('retries a rate-limited official endpoint before reporting failure', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'taoyuan-evidence-probe-'),
    )
    roots.push(root)
    const spatialPath = path.join(root, 'paid-curb.geojson')
    await fs.writeFile(
      spatialPath,
      JSON.stringify({
        type: 'FeatureCollection',
        metadata: {
          sourceRecordCount: 3,
          legalAnswerEligible: false,
        },
        features: [],
      }),
    )
    let parkingSpotAttempts = 0
    const rateLimitedFetch = async (input: string | URL | Request) => {
      const isSpot = String(input).includes('/ParkingSpot/')
      if (isSpot) {
        parkingSpotAttempts += 1
        if (parkingSpotAttempts === 1) {
          return new Response('', {
            status: 429,
            headers: { 'retry-after': '0' },
          })
        }
      }
      return officialFetch(input)
    }

    const result = await runTaoyuanLegalEvidenceProbe({
      spatialPath,
      reportPath: path.join(root, 'probe.md'),
      jsonReportPath: path.join(root, 'probe.json'),
      env: { TDX_ALLOW_GUEST: 'true' },
      fetchImpl: rateLimitedFetch as typeof fetch,
    })

    expect(parkingSpotAttempts).toBe(2)
    expect(result.endpoints.parkingSpots).toMatchObject({
      status: 200,
      count: 0,
      error: null,
    })
  })

  it('rejects a local artifact whose collection safety flag is not false', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'taoyuan-evidence-probe-'),
    )
    roots.push(root)
    const spatialPath = path.join(root, 'unsafe.geojson')
    await fs.writeFile(
      spatialPath,
      JSON.stringify({
        type: 'FeatureCollection',
        metadata: {
          sourceRecordCount: 3,
          legalAnswerEligible: true,
        },
        features: [],
      }),
    )

    await expect(
      runTaoyuanLegalEvidenceProbe({
        spatialPath,
        reportPath: path.join(root, 'probe.md'),
        jsonReportPath: path.join(root, 'probe.json'),
        env: { TDX_ALLOW_GUEST: 'true' },
        fetchImpl: officialFetch as typeof fetch,
      }),
    ).rejects.toThrow(
      'Local spatial metadata must keep legalAnswerEligible false.',
    )
  })
})
