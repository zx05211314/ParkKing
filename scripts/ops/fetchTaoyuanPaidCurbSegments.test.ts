import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  normalizeTaoyuanPaidCurbSegments,
  resolveTdxAcquisitionMode,
  writeTaoyuanPaidCurbSegments,
} from './fetchTaoyuanPaidCurbSegments'

describe('fetchTaoyuanPaidCurbSegments', () => {
  it('normalizes exact and representative geometry without claiming legal evidence', () => {
    const collection = normalizeTaoyuanPaidCurbSegments({
      SrcUpdateTime: '2026-07-15T20:00:00+08:00',
      UpdateTime: '2026-07-15T20:05:00+08:00',
      AuthorityCode: 'TAO',
      VersionID: 7,
      Count: 2,
      Items: [
        {
          ParkingSegmentID: 'segment-point',
          ParkingSegmentName: { Zh_tw: 'Road A', En: 'Road A' },
          ParkingSegmentPosition: { PositionLon: 121.301, PositionLat: 24.993 },
          FareDescription: 'Hourly fee',
          City: 'Taoyuan',
          CityCode: 'TAO',
          TownName: 'Taoyuan District',
          TownID: 'H01',
        },
        {
          ParkingSegmentID: 'segment-line',
          ParkingSegmentName: { En: 'Road B' },
          ParkingSegmentPosition: { PositionLon: 121.302, PositionLat: 24.994 },
          Geometry: 'LINESTRING (121.302 24.994, 121.303 24.995)',
          RoadSection: { Start: 'A Street', End: 'B Street' },
          HasChargingPoint: 1,
        },
      ],
    })

    expect(collection.features).toHaveLength(2)
    expect(collection.features[0]?.geometry.type).toBe('Point')
    expect(collection.features[0]?.properties.geometryPrecision).toBe(
      'REPRESENTATIVE_POINT',
    )
    expect(collection.features[1]?.geometry.type).toBe('LineString')
    expect(collection.features[1]?.properties.geometryPrecision).toBe(
      'SEGMENT_GEOMETRY',
    )
    expect(collection.features.every(({ properties }) => !properties.legalAnswerEligible)).toBe(
      true,
    )
    expect(collection.features.every(({ properties }) => properties.evidenceKind === 'PAID_CURB_SEGMENT')).toBe(
      true,
    )
    expect(collection.metadata).toMatchObject({
      authorityCode: 'TAO',
      sourceRecordCount: 2,
      featureCount: 2,
      coordinateCorrectionCount: 0,
      droppedRecordCount: 0,
      legalAnswerEligible: false,
    })
  })

  it('repairs only an unambiguous swapped coordinate within the Taoyuan range', () => {
    const collection = normalizeTaoyuanPaidCurbSegments({
      Items: [
        {
          ParkingSegmentID: 'swapped',
          ParkingSegmentPosition: {
            PositionLon: 24.59564,
            PositionLat: 121.2123,
          },
        },
      ],
    })

    expect(collection.features[0]?.geometry).toEqual({
      type: 'Point',
      coordinates: [121.2123, 24.59564],
    })
    expect(collection.metadata).toMatchObject({
      featureCount: 1,
      coordinateCorrectionCount: 1,
      droppedRecordCount: 0,
    })
  })

  it('drops records that have neither usable geometry nor a representative point', () => {
    const collection = normalizeTaoyuanPaidCurbSegments({
      Items: [
        {
          ParkingSegmentID: 'invalid',
          ParkingSegmentPosition: { PositionLon: 'not-a-number', PositionLat: 24.99 },
        },
      ],
    })

    expect(collection.features).toEqual([])
    expect(collection.metadata.sourceRecordCount).toBe(1)
    expect(collection.metadata.coordinateCorrectionCount).toBe(0)
    expect(collection.metadata.droppedRecordCount).toBe(1)
  })

  it('selects guest access only when credentials are absent and guest mode is enabled', () => {
    expect(resolveTdxAcquisitionMode({})).toBe('guest')
    expect(
      resolveTdxAcquisitionMode({ TDX_ACCESS_TOKEN: 'token' }),
    ).toBe('access-token')
    expect(
      resolveTdxAcquisitionMode({
        TDX_CLIENT_ID: 'client',
        TDX_CLIENT_SECRET: 'secret',
      }),
    ).toBe('client-credentials')
    expect(() =>
      resolveTdxAcquisitionMode({ TDX_CLIENT_ID: 'client' }),
    ).toThrow('must be configured together')
    expect(() =>
      resolveTdxAcquisitionMode({ TDX_ALLOW_GUEST: 'false' }),
    ).toThrow('guest access is disabled')
  })

  it('downloads official segments through guest access without an authorization header', async () => {
    let authorizationHeader: string | undefined
    let userAgentHeader: string | undefined
    const server = http.createServer((request, response) => {
      authorizationHeader =
        typeof request.headers.authorization === 'string'
          ? request.headers.authorization
          : undefined
      userAgentHeader = request.headers['user-agent']
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify({
          Count: 1,
          Items: [
            {
              ParkingSegmentID: 'guest-segment',
              ParkingSegmentPosition: {
                PositionLon: 121.301,
                PositionLat: 24.993,
              },
            },
          ],
        }),
      )
    })
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    )
    const address = server.address() as AddressInfo
    const outputDir = await fs.mkdtemp(path.join(tmpdir(), 'tdx-guest-'))
    const outputPath = path.join(outputDir, 'paid-curb.geojson')

    try {
      const result = await writeTaoyuanPaidCurbSegments({
        outputPath,
        env: {
          TDX_PARKING_API_BASE_URL: `http://127.0.0.1:${address.port}`,
        },
      })

      expect(authorizationHeader).toBeUndefined()
      expect(userAgentHeader).toContain('ParkKing/1.0')
      expect(result.acquisitionMode).toBe('guest')
      expect(result.collection.metadata).toMatchObject({
        acquisitionMode: 'guest',
        featureCount: 1,
        legalAnswerEligible: false,
      })
      await expect(fs.readFile(outputPath, 'utf-8')).resolves.toContain(
        '"parkingSegmentId": "guest-segment"',
      )
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
})
