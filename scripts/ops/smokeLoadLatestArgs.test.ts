import { afterEach, describe, expect, it } from 'vitest'

import {
  normalizeSmokeLoadLatestOptions,
  parseExpectedDistrictsCsv,
  resolveSmokeLoadLatestName,
  smokeLoadLatestPointerFileName,
} from './smokeLoadLatestArgs'

describe('smokeLoadLatestArgs', () => {
  afterEach(() => {
    delete process.env.PARKKING_LATEST_NAME
  })

  it('deduplicates expected districts and strips blanks', () => {
    expect(parseExpectedDistrictsCsv('xinyi, daan, xinyi, , zhongshan')).toEqual([
      'xinyi',
      'daan',
      'zhongshan',
    ])
  })

  it('resolves latest name from input or env and normalizes pointer file names', () => {
    process.env.PARKKING_LATEST_NAME = 'LATEST_CI'

    expect(resolveSmokeLoadLatestName(' custom ')).toBe('custom')
    expect(resolveSmokeLoadLatestName()).toBe('LATEST_CI')
    expect(smokeLoadLatestPointerFileName('LATEST')).toBe('LATEST.json')
    expect(smokeLoadLatestPointerFileName('LATEST_CI.json')).toBe('LATEST_CI.json')
  })

  it('filters blank expected districts in normalized options', () => {
    expect(
      normalizeSmokeLoadLatestOptions({
        expectedDistricts: ['xinyi', ' ', 'daan'],
      }),
    ).toMatchObject({
      expectedDistricts: ['xinyi', 'daan'],
      latestName: 'LATEST',
    })
  })
})
