import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { installTaoyuanSpatialReference } from './installTaoyuanSpatialReference'

const createSpatialArtifact = (legalAnswerEligible = false) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [121.3, 24.99] },
      properties: {
        evidenceKind: 'PAID_CURB_SEGMENT',
        legalAnswerEligible,
        geometryPrecision: 'REPRESENTATIVE_POINT',
        parkingSegmentId: 'segment-1',
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
      },
    },
  ],
  metadata: {
    sourceDataset: 'TDX OnStreet ParkingSegment v1',
    sourceRecordCount: 1,
    featureCount: 1,
    legalAnswerEligible,
  },
})

const writeJson = async (targetPath: string, value: unknown) => {
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, buffer)
  return buffer
}

describe('installTaoyuanSpatialReference', () => {
  it('validates and installs a downloaded artifact with a hash receipt', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taoyuan-install-'))
    const artifactDir = path.join(root, 'artifact')
    const inputPath = path.join(artifactDir, 'paid_curb_segments.geojson')
    const outputPath = path.join(root, 'sources', 'paid_curb_segments.geojson')
    const receiptPath = path.join(root, 'receipt.json')
    const buffer = await writeJson(inputPath, createSpatialArtifact())

    const result = await installTaoyuanSpatialReference({
      inputPath: artifactDir,
      outputPath,
      receiptPath,
      now: new Date('2026-07-18T00:00:00.000Z'),
    })

    const expectedSha256 = createHash('sha256').update(buffer).digest('hex')
    expect(await fs.readFile(outputPath)).toEqual(buffer)
    expect(JSON.parse(await fs.readFile(receiptPath, 'utf-8'))).toMatchObject({
      schemaVersion: 1,
      installedAt: '2026-07-18T00:00:00.000Z',
      source: { sha256: expectedSha256, bytes: buffer.length },
      destination: { sha256: expectedSha256 },
      validation: {
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
        legalAnswerEligible: false,
        featureCount: 1,
        segmentGeometryCount: 0,
        representativePointCount: 1,
      },
    })
    expect(result.receipt.source.sha256).toBe(expectedSha256)
  })

  it('rejects unsafe evidence before replacing an existing reference', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taoyuan-install-'))
    const inputPath = path.join(root, 'unsafe.geojson')
    const outputPath = path.join(root, 'paid_curb_segments.geojson')
    await writeJson(inputPath, createSpatialArtifact(true))
    await fs.writeFile(outputPath, 'existing-safe-reference', 'utf-8')

    await expect(
      installTaoyuanSpatialReference({
        inputPath,
        outputPath,
        receiptPath: path.join(root, 'receipt.json'),
      }),
    ).rejects.toThrow('legalAnswerEligible false')
    expect(await fs.readFile(outputPath, 'utf-8')).toBe(
      'existing-safe-reference',
    )
  })

  it('requires the canonical artifact file when input is a directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taoyuan-install-'))

    await expect(
      installTaoyuanSpatialReference({
        inputPath: root,
        outputPath: path.join(root, 'output.geojson'),
      }),
    ).rejects.toThrow('paid_curb_segments.geojson')
  })
})
