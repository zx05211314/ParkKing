import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  renderTaoyuanLegalEvidenceCandidate,
  runTaoyuanLegalEvidenceCandidateValidation,
} from './validateTaoyuanLegalEvidenceCandidate'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  )
})

const writeJson = async (targetPath: string, value: unknown) => {
  const body = `${JSON.stringify(value, null, 2)}\n`
  await fs.writeFile(targetPath, body, 'utf-8')
  return createHash('sha256').update(body).digest('hex')
}

const createFixture = async (options: {
  includeParking?: boolean
  includeCurbRules?: boolean
  unsafeParkingMetadata?: boolean
}) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'taoyuan-legal-candidate-'),
  )
  roots.push(root)
  const boundaryCatalogPath = path.join(root, 'coverage.json')
  await writeJson(boundaryCatalogPath, {
    districts: [
      {
        regionId: 'taoyuan',
        districtId: 'taoyuan-district',
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

  const datasetName = 'Official Taoyuan legal parking fixture'
  const sourcePath = path.join(root, 'official-source.json')
  const sourceBody = '{"official":true}\n'
  await fs.writeFile(sourcePath, sourceBody, 'utf-8')
  const sourceSha256 = createHash('sha256').update(sourceBody).digest('hex')
  const files: Array<{
    kind: string
    path: string
    sha256: string
    featureCount: number
  }> = []
  if (options.includeParking) {
    const fileName = 'parking-spaces.geojson'
    const sha256 = await writeJson(path.join(root, fileName), {
      type: 'FeatureCollection',
      metadata: {
        layerKind: 'PARKING_SPACES',
        datasetName,
        crs: 'EPSG:4326',
        legalAnswerEligible: options.unsafeParkingMetadata ? true : false,
        requiresHumanReview: true,
      },
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [121.3, 25] },
          properties: {
            sourceId: 'space-1',
            districtId: 'taoyuan-district',
            sourceDataset: datasetName,
            evidenceKind: 'OFFICIAL_PARKING_SPACE',
            geometryPrecision: 'OFFICIAL_SPOT_POSITION',
            parkingStatus: 'ACTIVE',
            legalAnswerEligible: false,
            requiresHumanReview: true,
            reviewStatus: 'PENDING',
          },
        },
      ],
    })
    files.push({
      kind: 'PARKING_SPACES',
      path: fileName,
      sha256,
      featureCount: 1,
    })
  }
  if (options.includeCurbRules) {
    const fileName = 'curb-rules.geojson'
    const sha256 = await writeJson(path.join(root, fileName), {
      type: 'FeatureCollection',
      metadata: {
        layerKind: 'CURB_RULES',
        datasetName,
        crs: 'EPSG:4326',
        legalAnswerEligible: false,
        requiresHumanReview: true,
      },
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.29, 25],
              [121.31, 25],
            ],
          },
          properties: {
            sourceId: 'rule-1',
            districtId: 'taoyuan-district',
            sourceDataset: datasetName,
            evidenceKind: 'OFFICIAL_CURB_RULE',
            geometryPrecision: 'EXACT_CURB_LINE',
            curbRule: 'RED_NO_STOP',
            timeWindows: [],
            legalAnswerEligible: false,
            requiresHumanReview: true,
            reviewStatus: 'PENDING',
          },
        },
      ],
    })
    files.push({
      kind: 'CURB_RULES',
      path: fileName,
      sha256,
      featureCount: 1,
    })
  }

  const manifestPath = path.join(root, 'manifest.json')
  await writeJson(manifestPath, {
    schemaVersion: 1,
    regionId: 'taoyuan',
    authority: 'Taoyuan City Government',
    datasetName,
    sourceUrl: 'https://data.tycg.gov.test/legal-parking',
    licenseUrl: 'https://data.gov.test/license',
    retrievedAt: '2026-07-19T00:00:00.000Z',
    sourceUpdatedAt: '2026-07-18T00:00:00.000Z',
    sourcePath: 'official-source.json',
    sourceSha256,
    crs: 'EPSG:4326',
    legalAnswerEligible: false,
    requiresHumanReview: true,
    files,
  })

  return { root, manifestPath, boundaryCatalogPath }
}

describe('validateTaoyuanLegalEvidenceCandidate', () => {
  it('accepts a complete safe candidate only for human review', async () => {
    const fixture = await createFixture({
      includeParking: true,
      includeCurbRules: true,
    })
    const result = await runTaoyuanLegalEvidenceCandidateValidation({
      manifestPath: fixture.manifestPath,
      boundaryCatalogPath: fixture.boundaryCatalogPath,
      requireComplete: true,
      outPath: path.join(fixture.root, 'report.md'),
      jsonOutPath: path.join(fixture.root, 'report.json'),
    })

    expect(result).toMatchObject({
      status: 'READY_FOR_HUMAN_REVIEW',
      gatePass: true,
      candidateValid: true,
      readyForHumanReview: true,
      legalAnswerEligible: false,
      missingLayers: [],
    })
    expect(renderTaoyuanLegalEvidenceCandidate(result)).toContain(
      'Eligible for legal parking answers: no',
    )
    await expect(
      fs.readFile(path.join(fixture.root, 'report.json'), 'utf-8'),
    ).resolves.toContain('"legalAnswerEligible": false')
  })

  it('reports a valid partial candidate and fails only in complete mode', async () => {
    const fixture = await createFixture({ includeParking: true })
    const partial = await runTaoyuanLegalEvidenceCandidateValidation({
      manifestPath: fixture.manifestPath,
      boundaryCatalogPath: fixture.boundaryCatalogPath,
    })
    const strict = await runTaoyuanLegalEvidenceCandidateValidation({
      manifestPath: fixture.manifestPath,
      boundaryCatalogPath: fixture.boundaryCatalogPath,
      requireComplete: true,
    })

    expect(partial).toMatchObject({
      status: 'PARTIAL_CANDIDATE',
      gatePass: true,
      candidateValid: true,
      readyForHumanReview: false,
      missingLayers: ['CURB_RULES'],
    })
    expect(strict.gatePass).toBe(false)
  })

  it('rejects a layer that attempts to enable legal answers', async () => {
    const fixture = await createFixture({
      includeParking: true,
      includeCurbRules: true,
      unsafeParkingMetadata: true,
    })
    const result = await runTaoyuanLegalEvidenceCandidateValidation({
      manifestPath: fixture.manifestPath,
      boundaryCatalogPath: fixture.boundaryCatalogPath,
      requireComplete: true,
    })

    expect(result.status).toBe('INVALID')
    expect(result.gatePass).toBe(false)
    expect(result.errors).toContain(
      'PARKING_SPACES: Layer metadata legalAnswerEligible must remain false.',
    )
  })

  it('rejects source hash drift and geometry outside the declared district', async () => {
    const fixture = await createFixture({
      includeParking: true,
      includeCurbRules: true,
    })
    const manifest = JSON.parse(
      await fs.readFile(fixture.manifestPath, 'utf-8'),
    ) as {
      sourceSha256: string
      files: Array<{ kind: string; sha256: string }>
    }
    manifest.sourceSha256 = 'c'.repeat(64)
    const parking = manifest.files.find(
      ({ kind }) => kind === 'PARKING_SPACES',
    )
    if (!parking) {
      throw new Error('Fixture parking layer is missing.')
    }
    parking.sha256 = 'b'.repeat(64)
    await writeJson(fixture.manifestPath, manifest)
    const curbPath = path.join(fixture.root, 'curb-rules.geojson')
    const curb = JSON.parse(await fs.readFile(curbPath, 'utf-8')) as {
      features: Array<{ geometry: { coordinates: number[][] } }>
    }
    curb.features[0].geometry.coordinates = [
      [120, 23],
      [120.1, 23.1],
    ]
    const curbHash = await writeJson(curbPath, curb)
    const curbEntry = manifest.files.find(({ kind }) => kind === 'CURB_RULES')
    if (!curbEntry) {
      throw new Error('Fixture curb layer is missing.')
    }
    curbEntry.sha256 = curbHash
    await writeJson(fixture.manifestPath, manifest)

    const result = await runTaoyuanLegalEvidenceCandidateValidation({
      manifestPath: fixture.manifestPath,
      boundaryCatalogPath: fixture.boundaryCatalogPath,
    })

    expect(result.status).toBe('INVALID')
    expect(result.errors.join('\n')).toContain('SHA-256')
    expect(result.errors).toContain(
      'Source: SHA-256 does not match sourceSha256.',
    )
    expect(result.errors.join('\n')).toContain(
      'does not intersect its declared district',
    )
  })

  it('rejects malformed GeoJSON geometry before district matching', async () => {
    const fixture = await createFixture({
      includeParking: true,
      includeCurbRules: true,
    })
    const manifest = JSON.parse(
      await fs.readFile(fixture.manifestPath, 'utf-8'),
    ) as {
      files: Array<{ kind: string; sha256: string }>
    }
    const curbPath = path.join(fixture.root, 'curb-rules.geojson')
    const curb = JSON.parse(await fs.readFile(curbPath, 'utf-8')) as {
      features: Array<{ geometry: { coordinates: number[][] } }>
    }
    curb.features[0].geometry.coordinates = [[121.3, 25]]
    const curbHash = await writeJson(curbPath, curb)
    const curbEntry = manifest.files.find(({ kind }) => kind === 'CURB_RULES')
    if (!curbEntry) {
      throw new Error('Fixture curb layer is missing.')
    }
    curbEntry.sha256 = curbHash
    await writeJson(fixture.manifestPath, manifest)

    const result = await runTaoyuanLegalEvidenceCandidateValidation({
      manifestPath: fixture.manifestPath,
      boundaryCatalogPath: fixture.boundaryCatalogPath,
    })

    expect(result.status).toBe('INVALID')
    expect(result.errors).toContain(
      'CURB_RULES: CURB_RULES feature 1 has invalid coordinates.',
    )
  })
})
