import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PaidCurbReferencePanel } from './PaidCurbReferencePanel'

describe('PaidCurbReferencePanel', () => {
  it('shows text matches with an explicit non-spatial safety boundary', () => {
    const html = renderToStaticMarkup(
      <PaidCurbReferencePanel
        addressLabel="桃園市桃園區縣府路1號"
        state={{
          status: 'ready',
          sourceUrl: '/data/reference/taoyuan-paid-curb.json',
          spatialSourceUrl: null,
          error: null,
          spatialReference: null,
          district: {
            districtId: 'taoyuan-district',
            districtName: 'Taoyuan',
            boundaryFeatureId: '68000010',
            recordCount: 1,
            records: [
              {
                parkingSegmentId: '169',
                description: '縣府路園區',
                fareDescription: '20元/30分鐘',
                hasChargingPoint: false,
                sourceTownName: '桃園區',
              },
            ],
          },
        }}
      />,
    )

    expect(html).toContain('縣府路園區')
    expect(html).toContain('road-description text matches, not spatial matches')
    expect(html).toContain('do not show that the pinned curb is legal')
    expect(html).toContain('value="縣府路"')
  })

  it('links reviewed points to the map without inventing excluded geometry', () => {
    const html = renderToStaticMarkup(
      <PaidCurbReferencePanel
        addressLabel="桃園市桃園區縣府路1號"
        selectedReferencePointId="169"
        onSelectReferencePoint={() => undefined}
        state={{
          status: 'ready',
          sourceUrl: '/data/reference/taoyuan-paid-curb.json',
          spatialSourceUrl:
            '/data/reference/taoyuan-district-paid-curb-points.geojson',
          error: null,
          district: {
            districtId: 'taoyuan-district',
            districtName: 'Taoyuan',
            boundaryFeatureId: '68000010',
            recordCount: 2,
            records: [
              {
                parkingSegmentId: '169',
                description: '縣府路園區',
                fareDescription: '20 per hour',
                hasChargingPoint: false,
                sourceTownName: '桃園區',
              },
              {
                parkingSegmentId: '177',
                description: '縣府路邊界資料',
                fareDescription: null,
                hasChargingPoint: false,
                sourceTownName: '桃園區',
              },
            ],
          },
          spatialReference: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [121.30074, 24.99493],
                },
                properties: {
                  evidenceKind: 'PAID_CURB_SEGMENT',
                  parkingSegmentId: '169',
                  districtId: 'taoyuan-district',
                  description: '縣府路園區',
                  fareDescription: '20 per hour',
                  hasChargingPoint: false,
                  geometryPrecision: 'REPRESENTATIVE_POINT',
                  legalAnswerEligible: false,
                  sourceDataset: 'TDX OnStreet ParkingSegment v1',
                },
              },
            ],
            metadata: {
              schemaVersion: 1,
              districtId: 'taoyuan-district',
              boundaryFeatureId: '68000010',
              evidenceKind: 'PAID_CURB_SEGMENT',
              sourceDataset: 'TDX OnStreet ParkingSegment v1',
              sourceSha256: 'a'.repeat(64),
              sourceFeatureCount: 2,
              reviewSha256: 'b'.repeat(64),
              reviewRecordCount: 2,
              featureCount: 1,
              excludedFeatureCount: 1,
              excluded: [
                {
                  parkingSegmentId: '177',
                  reason: 'OUTSIDE_OFFICIAL_DISTRICT_BOUNDARY',
                },
              ],
              geometryPrecision: 'REPRESENTATIVE_POINT',
              legalAnswerEligible: false,
            },
          },
        }}
      />,
    )

    expect(html).toContain('Highlighted on map')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain(
      'representative point was excluded by the official district-boundary review',
    )
    expect(html.match(/paid-curb-reference-map-action/g)).toHaveLength(1)
  })
})
