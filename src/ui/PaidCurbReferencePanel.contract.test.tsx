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
          error: null,
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
})
