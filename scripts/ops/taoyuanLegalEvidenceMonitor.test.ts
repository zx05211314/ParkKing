import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  hashTaoyuanLocalSpatialContent,
  type TaoyuanLegalEvidenceProbeResult,
} from './probeTaoyuanLegalEvidence'
import {
  assessTaoyuanLegalEvidenceMonitor,
  parseTaoyuanLegalEvidenceBaseline,
  parseTaoyuanLegalEvidenceMonitorResult,
  renderTaoyuanLegalEvidenceMonitor,
  runTaoyuanLegalEvidenceMonitor,
  type TaoyuanLegalEvidenceBaseline,
} from './taoyuanLegalEvidenceMonitor'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  )
})

const baseline: TaoyuanLegalEvidenceBaseline = {
  schemaVersion: 1,
  regionId: 'taoyuan',
  approvedSourceSha256: 'a'.repeat(64),
  approvedSpatialSha256: 'b'.repeat(64),
  sourceUpdatedAt: '2026-07-18T00:00:00.000Z',
  sourceVersionId: 1,
  parkingSegmentCount: 944,
  parkingSpotCount: 0,
  spatialFeatureCount: 944,
  segmentGeometryCount: 0,
  representativePointCount: 944,
  legalAnswerEligible: false,
}

const makeProbe = (
  overrides: {
    probePass?: boolean
    segmentCount?: number
    parkingSpotCount?: number
    featureCount?: number
    segmentGeometryCount?: number
    representativePointCount?: number
    errors?: string[]
  } = {},
): TaoyuanLegalEvidenceProbeResult => ({
  schemaVersion: 1,
  probedAt: '2026-07-19T00:00:00.000Z',
  probePass: overrides.probePass ?? true,
  acquisitionMode: 'guest',
  endpoints: {
    parkingSegments: {
      id: 'parking-segments',
      url: 'https://example.test/segments',
      status: 200,
      count: overrides.segmentCount ?? 944,
      sampleFields: [],
      error: null,
    },
    parkingSpots: {
      id: 'parking-spots',
      url: 'https://example.test/spots',
      status: 200,
      count: overrides.parkingSpotCount ?? 0,
      sampleFields: [],
      error: null,
    },
  },
  localSpatial: {
    path: 'paid-curb.geojson',
    contentSha256: 'b'.repeat(64),
    sourceUpdateTime: '2026-07-18T00:00:00.000Z',
    versionId: 1,
    sourceRecordCount: overrides.segmentCount ?? 944,
    featureCount: overrides.featureCount ?? 944,
    segmentGeometryCount: overrides.segmentGeometryCount ?? 0,
    representativePointCount: overrides.representativePointCount ?? 944,
    legalAnswerEligible: false,
  },
  referenceAvailable: true,
  legalAnswerEligible: false,
  errors: overrides.errors ?? [],
  legalAnswerBlockers: [],
  nextActions: [],
})

describe('taoyuanLegalEvidenceMonitor', () => {
  it('pins the approved review evidence and public reference to the baseline', async () => {
    const reviewManifestNames = (
      await fs.readdir('review-evidence/taoyuan')
    ).filter((name) => name.endsWith('-paid-curb-review.manifest.json'))
    const reviewSourceSha256 = await Promise.all(
      reviewManifestNames.map(async (name) => {
        const manifest = JSON.parse(
          await fs.readFile(`review-evidence/taoyuan/${name}`, 'utf-8'),
        ) as { sourceSha256?: unknown }
        return manifest.sourceSha256
      }),
    )
    const publicReference = JSON.parse(
      await fs.readFile(
        'public/data/reference/taoyuan-paid-curb.json',
        'utf-8',
      ),
    ) as {
      source: { sha256: string; recordCount: number }
      districts: unknown[]
    }
    const trackedBaseline = parseTaoyuanLegalEvidenceBaseline(
      JSON.parse(
        await fs.readFile(
          'review-evidence/taoyuan/legal-evidence-baseline.json',
          'utf-8',
        ),
      ) as unknown,
    )

    expect(reviewManifestNames).toHaveLength(11)
    expect(new Set(reviewSourceSha256)).toEqual(
      new Set([trackedBaseline.approvedSourceSha256]),
    )
    expect(trackedBaseline).toMatchObject({
      approvedSourceSha256: publicReference.source.sha256,
      parkingSegmentCount: publicReference.source.recordCount,
      spatialFeatureCount: publicReference.source.recordCount,
    })
    expect(publicReference.districts).toHaveLength(13)
  })

  it('accepts a safe pinned baseline and rejects unsafe eligibility', () => {
    expect(parseTaoyuanLegalEvidenceBaseline(baseline)).toEqual(baseline)
    expect(() =>
      parseTaoyuanLegalEvidenceBaseline({
        ...baseline,
        legalAnswerEligible: true,
      }),
    ).toThrow('Invalid Taoyuan legal evidence monitor baseline')
  })

  it('rejects unsafe monitor results before notification', () => {
    const result = assessTaoyuanLegalEvidenceMonitor({
      monitoredAt: '2026-07-19T00:00:00.000Z',
      baseline,
      probe: makeProbe(),
    })

    expect(parseTaoyuanLegalEvidenceMonitorResult(result)).toEqual(result)
    expect(() =>
      parseTaoyuanLegalEvidenceMonitorResult({
        ...result,
        legalAnswerEligible: true,
      }),
    ).toThrow('Invalid Taoyuan legal evidence monitor result')
  })

  it('reports no new evidence when the official source matches the baseline', () => {
    const result = assessTaoyuanLegalEvidenceMonitor({
      monitoredAt: '2026-07-19T00:00:00.000Z',
      baseline,
      probe: makeProbe(),
    })

    expect(result).toMatchObject({
      status: 'NO_NEW_LEGAL_EVIDENCE',
      attentionRequired: false,
      legalEvidenceCandidateDetected: false,
      sourceDriftDetected: false,
      legalAnswerEligible: false,
    })
    expect(renderTaoyuanLegalEvidenceMonitor(result)).toContain(
      'Eligible for legal parking answers: no',
    )
  })

  it('detects new official ParkingSpot or curb-line candidates without promoting them', () => {
    const spots = assessTaoyuanLegalEvidenceMonitor({
      monitoredAt: '2026-07-19T00:00:00.000Z',
      baseline,
      probe: makeProbe({ parkingSpotCount: 3 }),
    })
    const lines = assessTaoyuanLegalEvidenceMonitor({
      monitoredAt: '2026-07-19T00:00:00.000Z',
      baseline,
      probe: makeProbe({
        segmentGeometryCount: 2,
        representativePointCount: 942,
      }),
    })

    expect(spots).toMatchObject({
      status: 'LEGAL_EVIDENCE_CANDIDATE',
      attentionRequired: true,
      legalEvidenceCandidateDetected: true,
      legalAnswerEligible: false,
    })
    expect(lines.status).toBe('LEGAL_EVIDENCE_CANDIDATE')
    expect(lines.reasons.join('\n')).toContain(
      'Normalized curb-line geometries increased from 0 to 2.',
    )
  })

  it('separates ordinary source drift from legal-evidence candidates', () => {
    const result = assessTaoyuanLegalEvidenceMonitor({
      monitoredAt: '2026-07-19T00:00:00.000Z',
      baseline,
      probe: makeProbe({
        segmentCount: 945,
        featureCount: 945,
        representativePointCount: 945,
      }),
    })

    expect(result).toMatchObject({
      status: 'SOURCE_DRIFT',
      attentionRequired: true,
      legalEvidenceCandidateDetected: false,
      sourceDriftDetected: true,
    })
  })

  it('detects same-count spatial content drift', () => {
    const result = assessTaoyuanLegalEvidenceMonitor({
      monitoredAt: '2026-07-19T00:00:00.000Z',
      baseline,
      probe: {
        ...makeProbe(),
        localSpatial: {
          ...makeProbe().localSpatial,
          contentSha256: 'c'.repeat(64),
        },
      },
    })

    expect(result.status).toBe('SOURCE_DRIFT')
    expect(result.reasons.join('\n')).toContain(
      'Normalized spatial content SHA-256 changed',
    )
  })

  it('prioritizes probe failure over candidate and drift signals', () => {
    const result = assessTaoyuanLegalEvidenceMonitor({
      monitoredAt: '2026-07-19T00:00:00.000Z',
      baseline,
      probe: makeProbe({
        probePass: false,
        parkingSpotCount: 2,
        errors: ['endpoint unavailable'],
      }),
    })

    expect(result.status).toBe('PROBE_FAILED')
    expect(result.reasons).toContain('Probe error: endpoint unavailable')
  })

  it('runs the probe, writes monitor artifacts, and emits GitHub outputs', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'taoyuan-legal-monitor-'),
    )
    roots.push(root)
    const baselinePath = path.join(root, 'baseline.json')
    const spatialPath = path.join(root, 'spatial.geojson')
    const githubOutputPath = path.join(root, 'github-output.txt')
    const spatial = {
      type: 'FeatureCollection',
      metadata: {
        sourceUpdateTime: '2026-07-18T00:00:00.000Z',
        versionId: 1,
        sourceRecordCount: 2,
        legalAnswerEligible: false,
      },
      features: [1, 2].map((id) => ({
        type: 'Feature',
        id,
        geometry: { type: 'Point', coordinates: [121.3, 24.99] },
        properties: {
          geometryPrecision: 'REPRESENTATIVE_POINT',
          legalAnswerEligible: false,
        },
      })),
    }
    await fs.writeFile(
      baselinePath,
      JSON.stringify({
        ...baseline,
        approvedSpatialSha256: hashTaoyuanLocalSpatialContent({
          features: spatial.features,
          metadata: spatial.metadata,
        }),
        parkingSegmentCount: 2,
        spatialFeatureCount: 2,
        representativePointCount: 2,
      }),
    )
    await fs.writeFile(
      spatialPath,
      JSON.stringify(spatial),
    )
    await fs.writeFile(githubOutputPath, '')
    const fetchImpl = async (input: string | URL | Request) => {
      const spots = String(input).includes('/ParkingSpot/')
      return new Response(
        JSON.stringify({
          Count: spots ? 0 : 2,
          [spots ? 'ParkingSegmentSpots' : 'ParkingSegments']: spots
            ? []
            : [{ ParkingSegmentID: '1' }],
        }),
        { status: 200 },
      )
    }

    const result = await runTaoyuanLegalEvidenceMonitor({
      baselinePath,
      spatialPath,
      probeReportPath: path.join(root, 'probe.md'),
      probeJsonReportPath: path.join(root, 'probe.json'),
      reportPath: path.join(root, 'monitor.md'),
      jsonReportPath: path.join(root, 'monitor.json'),
      githubOutputPath,
      env: { TDX_ALLOW_GUEST: 'true' },
      fetchImpl: fetchImpl as typeof fetch,
      now: new Date('2026-07-19T00:00:00.000Z'),
    })

    expect(result.status).toBe('NO_NEW_LEGAL_EVIDENCE')
    await expect(fs.readFile(githubOutputPath, 'utf-8')).resolves.toContain(
      'attention_required=false',
    )
    await expect(
      fs.readFile(path.join(root, 'monitor.json'), 'utf-8'),
    ).resolves.toContain('"legalAnswerEligible": false')
  })
})
