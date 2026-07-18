import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PaidCurbReferenceMapDetail } from './PaidCurbReferenceMapDetail'

describe('PaidCurbReferenceMapDetail', () => {
  it('shows source details without claiming curb geometry or legality', () => {
    const html = renderToStaticMarkup(
      <PaidCurbReferenceMapDetail
        selection={{
          parkingSegmentId: '169',
          districtId: 'taoyuan-district',
          description: 'Road A',
          fareDescription: '20 per hour',
          hasChargingPoint: false,
          coordinates: [121.30074, 24.99493],
        }}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('Official source reference')
    expect(html).toContain('Segment ID')
    expect(html).toContain('20 per hour')
    expect(html).toContain('24.994930, 121.300740')
    expect(html).toContain('not exact curb geometry')
    expect(html).toContain('Not listed in source')
    expect(html).toContain('parking legality answer')
    expect(html).toContain('Close paid-curb reference details')
  })
})
