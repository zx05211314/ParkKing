import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseTaoyuanExpansionReadinessArgs,
  renderTaoyuanExpansionReadiness,
  runTaoyuanExpansionReadiness,
} from './taoyuanExpansionReadiness'

const TOWN_CODES = [
  '68000010',
  '68000020',
  '68000030',
  '68000040',
  '68000050',
  '68000060',
  '68000070',
  '68000080',
  '68000090',
  '68000100',
  '68000110',
  '68000120',
  '68000130',
]

const writeJson = async (targetPath: string, value: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const createFixture = async (options: {
  approved?: boolean
  spatial?: boolean
  unsafeSpatial?: boolean
}) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'taoyuan-expansion-readiness-'),
  )
  const boundaryPath = path.join(root, 'boundaries.geojson')
  const referencePath = path.join(root, 'reference.json')
  const reviewPath = path.join(root, 'review.csv')
  const reviewManifestPath = path.join(root, 'review.manifest.json')
  const spatialPath = path.join(root, 'spatial.geojson')
  const sourceSha256 = 'a'.repeat(64)

  await writeJson(boundaryPath, {
    type: 'FeatureCollection',
    features: TOWN_CODES.map((townCode, index) => ({
      type: 'Feature',
      properties: {
        COUNTYCODE: '68000',
        TOWNCODE: townCode,
        TOWNID: `H${index + 1}`,
        TOWNENG: `District ${index + 1}`,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [121.2, 24.9],
            [121.21, 24.9],
            [121.21, 24.91],
            [121.2, 24.9],
          ],
        ],
      },
    })),
  })
  await writeJson(referencePath, {
    schemaVersion: 1,
    regionId: 'taoyuan',
    evidenceKind: 'PAID_CURB_SEGMENT_TEXT',
    geometryAvailable: false,
    legalAnswerEligible: false,
    requiresHumanReview: true,
    source: {
      dataset: 'Taoyuan City curb parking segment list',
      relativePath: 'data/sources/taoyuan/paid_curb_segments.xml',
      sha256: sourceSha256,
      recordCount: 1,
    },
    districts: [
      {
        districtId: 'taoyuan-district',
        districtName: 'Taoyuan District',
        boundaryFeatureId: '68000010',
        recordCount: 1,
        records: [
          {
            parkingSegmentId: 'segment-1',
            description: 'Road A',
            fareDescription: 'Hourly fee',
            hasChargingPoint: false,
            sourceTownName: 'Taoyuan District',
          },
        ],
      },
    ],
  })
  await writeJson(reviewManifestPath, {
    schemaVersion: 1,
    districtId: 'taoyuan-district',
    sourceSha256,
    sourceRecordCount: 1,
    reviewRecordCount: 1,
    geometryAvailable: false,
    legalAnswerEligible: false,
    allowedStatuses: [
      'APPROVED_SOURCE_TEXT',
      'NEEDS_CORRECTION',
      'UNCLEAR',
    ],
  })
  await fs.writeFile(
    reviewPath,
    [
      'parking_segment_id,district_id,district_name,description,fare_description,has_charging_point,geometry_available,legal_answer_eligible,source_text_review_status,source_text_review_note',
      `segment-1,taoyuan-district,Taoyuan District,Road A,Hourly fee,false,false,false,${options.approved ? 'APPROVED_SOURCE_TEXT' : ''},`,
      '',
    ].join('\n'),
    'utf-8',
  )
  if (options.spatial) {
    await writeJson(spatialPath, {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [121.3, 24.99] },
          properties: {
            evidenceKind: 'PAID_CURB_SEGMENT',
            legalAnswerEligible: options.unsafeSpatial ? true : false,
            geometryPrecision: 'REPRESENTATIVE_POINT',
            parkingSegmentId: 'segment-1',
          },
        },
      ],
      metadata: {
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
        featureCount: 1,
        legalAnswerEligible: options.unsafeSpatial ? true : false,
      },
    })
  }

  return {
    boundaryPath,
    referencePath,
    reviewPath,
    reviewManifestPath,
    spatialPath,
  }
}

describe('taoyuanExpansionReadiness', () => {
  it('runs the real-data report and preserves its artifacts in CI', async () => {
    const workflow = await fs.readFile(
      path.resolve('.github/workflows/ci.yml'),
      'utf-8',
    )
    const reportIndex = workflow.indexOf(
      'run: npm run ops:taoyuan-expansion-readiness:ci',
    )
    const summaryIndex = workflow.indexOf(
      'run: npm run ops:append-workflow-summary -- --append-file .tmp/taoyuan-expansion-readiness.md',
    )
    const uploadIndex = workflow.indexOf(
      'name: taoyuan-expansion-readiness',
    )

    expect(reportIndex).toBeGreaterThan(-1)
    expect(summaryIndex).toBeGreaterThan(reportIndex)
    expect(uploadIndex).toBeGreaterThan(summaryIndex)
    expect(workflow).toContain('.tmp/taoyuan-expansion-readiness.json')
  })

  it('keeps credentialed TDX acquisition manual, non-publishing, and artifact-only', async () => {
    const workflow = await fs.readFile(
      path.resolve('.github/workflows/taoyuan_spatial_reference.yml'),
      'utf-8',
    )

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s+push:/m)
    expect(workflow).toContain(
      'TDX_CLIENT_ID: ${{ secrets.TDX_CLIENT_ID }}',
    )
    expect(workflow).toContain(
      'TDX_CLIENT_SECRET: ${{ secrets.TDX_CLIENT_SECRET }}',
    )
    expect(workflow).toContain('npm run ops:fetch-taoyuan-paid-curb')
    expect(workflow).toContain('--require-spatial')
    expect(workflow).toContain('name: taoyuan-spatial-reference')
    expect(workflow).toContain('paid_curb_segments.geojson')
    expect(workflow).not.toContain('npm run ingest:')
    expect(workflow).not.toContain('npm run ops:release')
    expect(workflow).not.toContain('npm run ops:render')
  })

  it('parses report and strict options', () => {
    expect(
      parseTaoyuanExpansionReadinessArgs([
        'node',
        'readiness',
        '--district',
        'taoyuan-district',
        '--boundary',
        '.tmp/boundary.geojson',
        '--boundary-catalog',
        '.tmp/coverage.json',
        '--reference',
        '.tmp/reference.json',
        '--review',
        '.tmp/review.csv',
        '--review-manifest',
        '.tmp/review.manifest.json',
        '--spatial',
        '.tmp/spatial.geojson',
        '--tdx-input',
        '.tmp/tdx.json',
        '--require-ready',
        '--require-spatial',
        '--out',
        '.tmp/readiness.md',
        '--json-out',
        '.tmp/readiness.json',
        '--json',
      ]),
    ).toMatchObject({
      districtId: 'taoyuan-district',
      boundaryPath: '.tmp/boundary.geojson',
      boundaryCatalogPath: '.tmp/coverage.json',
      referencePath: '.tmp/reference.json',
      reviewPath: '.tmp/review.csv',
      reviewManifestPath: '.tmp/review.manifest.json',
      spatialPath: '.tmp/spatial.geojson',
      tdxInputPath: '.tmp/tdx.json',
      requireReady: true,
      requireSpatial: true,
      outPath: '.tmp/readiness.md',
      jsonOutPath: '.tmp/readiness.json',
      json: true,
    })
  })

  it('validates tracked runtime boundaries without an unpacked shapefile', async () => {
    const fixture = await createFixture({})
    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      boundaryPath: path.join(path.dirname(fixture.boundaryPath), 'missing.shp'),
      boundaryCatalogPath: path.resolve('public/data/coverage.json'),
      env: {},
    })

    expect(result.boundary).toMatchObject({
      valid: true,
      source: 'runtime-coverage-catalog',
      districtCount: 13,
    })
    expect(result.automationErrors).toEqual([])
  })

  it('rejects a runtime boundary promoted beyond reference-only evidence', async () => {
    const fixture = await createFixture({})
    const catalog = JSON.parse(
      await fs.readFile(path.resolve('public/data/coverage.json'), 'utf-8'),
    ) as {
      districts: Array<{ regionId: string; publishStage: string }>
    }
    const district = catalog.districts.find(
      ({ regionId }) => regionId === 'taoyuan',
    )
    if (!district) {
      throw new Error('Fixture catalog has no Taoyuan district')
    }
    district.publishStage = 'production'
    const boundaryCatalogPath = path.join(
      path.dirname(fixture.boundaryPath),
      'unsafe-coverage.json',
    )
    await writeJson(boundaryCatalogPath, catalog)

    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      boundaryCatalogPath,
      env: {},
    })

    expect(result.status).toBe('automation-error')
    expect(result.boundary.valid).toBe(false)
    expect(result.automationErrors.join('\n')).toContain(
      'runtime boundary must remain source-only',
    )
  })

  it('reports human and external input blockers without failing report mode', async () => {
    const fixture = await createFixture({})
    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      env: {},
    })

    expect(result).toMatchObject({
      status: 'human-and-external-input-required',
      gatePass: true,
      readyForSpatialReference: false,
      legalAnswerEligible: false,
      boundary: { valid: true, districtCount: 13 },
      reference: {
        valid: true,
        sourceRecordCount: 1,
        districtRecordCount: 1,
      },
      sourceTextReview: {
        structureValid: true,
        approved: false,
        pendingRows: 1,
      },
      spatial: {
        exists: false,
        acquisition: 'blocked',
        credentialsConfigured: false,
      },
    })
    expect(result.automationErrors).toEqual([])
    expect(result.nextActions.join('\n')).toContain('TDX_CLIENT_ID')
    expect(renderTaoyuanExpansionReadiness(result)).toContain(
      'Eligible for legal parking answers: no',
    )
  })

  it('fails strict mode while required evidence is missing', async () => {
    const fixture = await createFixture({})
    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      env: { TDX_CLIENT_ID: 'configured', TDX_CLIENT_SECRET: 'configured' },
      requireReady: true,
    })

    expect(result.gatePass).toBe(false)
    expect(result.spatial.acquisition).toBe('credentials')
    expect(result.nextActions).toContain('npm run ops:fetch-taoyuan-paid-curb')
  })

  it('gates a safe spatial artifact independently from local human-review files', async () => {
    const fixture = await createFixture({ spatial: true })
    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      env: {},
      requireSpatial: true,
    })

    expect(result).toMatchObject({
      status: 'human-review-required',
      gatePass: true,
      requireReady: false,
      requireSpatial: true,
      readyForSpatialReference: false,
      legalAnswerEligible: false,
      sourceTextReview: { approved: false },
      spatial: { valid: true, featureCount: 1 },
    })
    expect(renderTaoyuanExpansionReadiness(result)).toContain(
      'Spatial reference required: yes',
    )
  })

  it('fails the spatial-only gate when TDX geometry is missing', async () => {
    const fixture = await createFixture({ approved: true })
    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      env: {},
      requireSpatial: true,
    })

    expect(result.gatePass).toBe(false)
    expect(result.requireSpatial).toBe(true)
    expect(result.spatial.valid).toBe(false)
  })

  it('accepts reviewed text and safe TDX geometry as reference-only evidence', async () => {
    const fixture = await createFixture({ approved: true, spatial: true })
    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      env: {},
      requireReady: true,
    })

    expect(result).toMatchObject({
      status: 'spatial-reference-ready',
      gatePass: true,
      readyForSpatialReference: true,
      legalAnswerEligible: false,
      sourceTextReview: { approved: true, pendingRows: 0 },
      spatial: {
        valid: true,
        featureCount: 1,
        segmentGeometryCount: 0,
        representativePointCount: 1,
      },
    })
  })

  it('rejects a spatial artifact that claims legal-answer eligibility', async () => {
    const fixture = await createFixture({
      approved: true,
      spatial: true,
      unsafeSpatial: true,
    })
    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      env: {},
    })

    expect(result.status).toBe('automation-error')
    expect(result.gatePass).toBe(false)
    expect(result.spatial.valid).toBe(false)
    expect(result.automationErrors.join('\n')).toContain(
      'legalAnswerEligible false',
    )
  })

  it('rejects out-of-range TDX coordinates', async () => {
    const fixture = await createFixture({ approved: true, spatial: true })
    const spatial = JSON.parse(
      await fs.readFile(fixture.spatialPath, 'utf-8'),
    ) as {
      features: Array<{ geometry: { coordinates: number[] } }>
    }
    spatial.features[0].geometry.coordinates = [999, 24.99]
    await writeJson(fixture.spatialPath, spatial)

    const result = await runTaoyuanExpansionReadiness({
      ...fixture,
      env: {},
    })

    expect(result.status).toBe('automation-error')
    expect(result.spatial.valid).toBe(false)
    expect(result.automationErrors.join('\n')).toContain('invalid geometry')
  })
})
