import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { promoteTaoyuanSpatialReference } from './promoteTaoyuanSpatialReference'

const sha256 = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const writeJson = async (targetPath: string, value: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const buffer = Buffer.from(`${JSON.stringify(value)}\n`, 'utf-8')
  await fs.writeFile(targetPath, buffer)
  return buffer
}

const createFixture = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taoyuan-spatial-promote-'))
  const inputPath = path.join(root, 'source.geojson')
  const referencePath = path.join(root, 'reference.json')
  const reviewPath = path.join(root, 'review.csv')
  const reviewManifestPath = path.join(root, 'review.manifest.json')
  const coveragePath = path.join(root, 'coverage.json')
  const outputPath = path.join(root, 'public.geojson')
  const receiptPath = path.join(root, 'receipt.json')
  const sourceSha = 'a'.repeat(64)
  const records = [
    {
      parkingSegmentId: 'inside',
      description: 'Road A',
      fareDescription: '20 per hour',
      hasChargingPoint: false,
      sourceTownName: 'Taoyuan',
    },
    {
      parkingSegmentId: 'outside',
      description: 'Road B',
      fareDescription: null,
      hasChargingPoint: true,
      sourceTownName: 'Taoyuan',
    },
  ]
  await writeJson(referencePath, {
    schemaVersion: 1,
    regionId: 'taoyuan',
    evidenceKind: 'PAID_CURB_SEGMENT_TEXT',
    geometryAvailable: false,
    legalAnswerEligible: false,
    requiresHumanReview: true,
    source: {
      dataset: 'Taoyuan City curb parking segment list',
      relativePath: 'source.xml',
      sha256: sourceSha,
      recordCount: 2,
    },
    districts: [
      {
        districtId: 'taoyuan-district',
        districtName: 'Taoyuan',
        boundaryFeatureId: '68000010',
        recordCount: 2,
        records,
      },
    ],
  })
  const reviewBuffer = Buffer.from(
    [
      'parking_segment_id,district_id,district_name,description,fare_description,has_charging_point,geometry_available,legal_answer_eligible,source_text_review_status,source_text_review_note',
      'inside,taoyuan-district,Taoyuan,Road A,20 per hour,false,false,false,APPROVED_SOURCE_TEXT,reviewed',
      'outside,taoyuan-district,Taoyuan,Road B,,true,false,false,APPROVED_SOURCE_TEXT,reviewed',
      '',
    ].join('\n'),
    'utf-8',
  )
  await fs.writeFile(reviewPath, reviewBuffer)
  await writeJson(reviewManifestPath, {
    schemaVersion: 1,
    districtId: 'taoyuan-district',
    sourceSha256: sourceSha,
    sourceRecordCount: 2,
    reviewRecordCount: 2,
    geometryAvailable: false,
    legalAnswerEligible: false,
    allowedStatuses: [
      'APPROVED_SOURCE_TEXT',
      'NEEDS_CORRECTION',
      'UNCLEAR',
    ],
    reviewSha256: sha256(reviewBuffer),
    approvedRecordCount: 2,
  })
  await writeJson(coveragePath, {
    schemaVersion: 1,
    districts: [
      {
        regionId: 'taoyuan',
        regionName: 'Taoyuan City',
        districtId: 'taoyuan-district',
        districtName: 'Taoyuan',
        boundaryFeatureId: '68000010',
        publishStage: 'source-only',
        answerCapability: 'paid-curb-reference-only',
        requiresHumanReview: true,
        aliases: [],
        boundaryBBox: [121.2, 24.9, 121.4, 25.1],
        boundaryGeometry: {
          type: 'Polygon',
          coordinates: [
            [
              [121.2, 24.9],
              [121.4, 24.9],
              [121.4, 25.1],
              [121.2, 25.1],
              [121.2, 24.9],
            ],
          ],
        },
      },
    ],
  })
  const sourceFeatures = records.map((record, index) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: index === 0 ? [121.3, 25] : [121.5, 25],
    },
    properties: {
      evidenceKind: 'PAID_CURB_SEGMENT',
      legalAnswerEligible: false,
      geometryPrecision: 'REPRESENTATIVE_POINT',
      parkingSegmentId: record.parkingSegmentId,
      description: record.description,
      fareDescription: record.fareDescription,
      hasChargingPoint: record.hasChargingPoint,
      sourceDataset: 'TDX OnStreet ParkingSegment v1',
    },
  }))
  await writeJson(inputPath, {
    type: 'FeatureCollection',
    features: sourceFeatures,
    metadata: {
      sourceDataset: 'TDX OnStreet ParkingSegment v1',
      sourceRecordCount: 2,
      featureCount: 2,
      legalAnswerEligible: false,
    },
  })
  return {
    root,
    inputPath,
    referencePath,
    reviewPath,
    reviewManifestPath,
    coveragePath,
    outputPath,
    receiptPath,
  }
}

describe('promoteTaoyuanSpatialReference', () => {
  it('publishes reviewed in-boundary points and records exclusions', async () => {
    const fixture = await createFixture()
    const result = await promoteTaoyuanSpatialReference({
      ...fixture,
      now: new Date('2026-07-18T00:00:00.000Z'),
    })

    expect(result.pack.metadata).toMatchObject({
      districtId: 'taoyuan-district',
      reviewRecordCount: 2,
      featureCount: 1,
      excludedFeatureCount: 1,
      legalAnswerEligible: false,
      excluded: [
        {
          parkingSegmentId: 'outside',
          reason: 'OUTSIDE_OFFICIAL_DISTRICT_BOUNDARY',
        },
      ],
    })
    expect(result.pack.features[0]?.properties).toMatchObject({
      parkingSegmentId: 'inside',
      geometryPrecision: 'REPRESENTATIVE_POINT',
      legalAnswerEligible: false,
    })
    const receipt = JSON.parse(
      await fs.readFile(fixture.receiptPath, 'utf-8'),
    ) as Record<string, unknown>
    expect(receipt).toMatchObject({
      promotedAt: '2026-07-18T00:00:00.000Z',
      destination: { featureCount: 1, excludedFeatureCount: 1 },
      safety: {
        geometryPrecision: 'REPRESENTATIVE_POINT',
        legalAnswerEligible: false,
      },
    })
  })

  it('rejects spatial text drift before replacing an existing public pack', async () => {
    const fixture = await createFixture()
    const source = JSON.parse(
      await fs.readFile(fixture.inputPath, 'utf-8'),
    ) as { features: Array<{ properties: { description: string } }> }
    source.features[0]!.properties.description = 'Changed'
    await writeJson(fixture.inputPath, source)
    await fs.writeFile(fixture.outputPath, 'existing-safe-pack')

    await expect(
      promoteTaoyuanSpatialReference(fixture),
    ).rejects.toThrow('spatial/text fields differ')
    expect(await fs.readFile(fixture.outputPath, 'utf-8')).toBe(
      'existing-safe-pack',
    )
  })

  it('ignores source-artifact provenance drift when runtime content matches', async () => {
    const fixture = await createFixture()
    await promoteTaoyuanSpatialReference(fixture)
    const expectedPath = path.join(fixture.root, 'expected.geojson')
    await fs.copyFile(fixture.outputPath, expectedPath)
    const source = JSON.parse(
      await fs.readFile(fixture.inputPath, 'utf-8'),
    ) as Record<string, unknown>
    await fs.writeFile(
      fixture.inputPath,
      `${JSON.stringify(source, null, 2)}\n`,
      'utf-8',
    )

    const result = await promoteTaoyuanSpatialReference({
      ...fixture,
      expectedPath,
    })

    expect(result.receipt).toMatchObject({
      expectedRuntimePack: {
        runtimeContentMatches: true,
        ignoredProvenanceFields: ['metadata.sourceSha256'],
      },
    })
  })

  it('writes review artifacts and fails when tracked runtime content drifts', async () => {
    const fixture = await createFixture()
    await promoteTaoyuanSpatialReference(fixture)
    const expectedPath = path.join(fixture.root, 'expected.geojson')
    await fs.copyFile(fixture.outputPath, expectedPath)
    const source = JSON.parse(
      await fs.readFile(fixture.inputPath, 'utf-8'),
    ) as {
      features: Array<{ geometry: { coordinates: [number, number] } }>
    }
    source.features[0]!.geometry.coordinates = [121.31, 25]
    await writeJson(fixture.inputPath, source)

    await expect(
      promoteTaoyuanSpatialReference({
        ...fixture,
        expectedPath,
      }),
    ).rejects.toThrow('runtime reference differs')
    const receipt = JSON.parse(
      await fs.readFile(fixture.receiptPath, 'utf-8'),
    ) as Record<string, unknown>
    expect(receipt).toMatchObject({
      expectedRuntimePack: {
        runtimeContentMatches: false,
      },
    })
  })
})
