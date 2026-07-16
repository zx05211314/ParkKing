import { describe, expect, it } from 'vitest'
import type { PaidCurbReferenceDistrict } from '../data/paidCurbReference'
import {
  findPaidCurbReferenceMatches,
  suggestPaidCurbRoadQuery,
} from './paidCurbReferenceSearch'

const district: PaidCurbReferenceDistrict = {
  districtId: 'taoyuan-district',
  districtName: 'Taoyuan',
  boundaryFeatureId: '68000010',
  recordCount: 2,
  records: [
    {
      parkingSegmentId: '170',
      description: '中華路(中正路-三民路三段)',
      fareDescription: '20元/30分鐘',
      hasChargingPoint: false,
      sourceTownName: '桃園區',
    },
    {
      parkingSegmentId: '169',
      description: '縣府路園區(桃園區公所-民安路含調查局周邊)',
      fareDescription: '第一30分鐘收費20元',
      hasChargingPoint: false,
      sourceTownName: '桃園區',
    },
  ],
}

describe('paidCurbReferenceSearch', () => {
  it('suggests the local road name from a Chinese address label', () => {
    expect(suggestPaidCurbRoadQuery('桃園市桃園區縣府路1號')).toBe('縣府路')
    expect(suggestPaidCurbRoadQuery('桃園市桃園區中正路三段20號')).toBe(
      '中正路三段',
    )
  })

  it('matches normalized source descriptions without claiming spatial proximity', () => {
    expect(findPaidCurbReferenceMatches(district, ' 縣府路 ')).toEqual({
      total: 1,
      records: [district.records[1]],
    })
    expect(findPaidCurbReferenceMatches(district, '不存在路')).toEqual({
      total: 0,
      records: [],
    })
  })
})
