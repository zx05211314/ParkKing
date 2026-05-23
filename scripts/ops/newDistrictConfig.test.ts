import { describe, expect, it } from 'vitest'
import { buildNewDistrictConfig, ensureRelative } from './newDistrictConfig'

describe('newDistrictConfig', () => {
  it('normalizes sourceRoot separators and builds the district config payload', () => {
    const config = buildNewDistrictConfig({
      districtId: 'xinyi',
      districtName: 'Xinyi',
      sourceRoot: 'data\\raw\\xinyi',
      force: false,
    })

    expect(config).toMatchObject({
      districtId: 'xinyi',
      districtName: 'Xinyi',
      inputs: {
        districtBounds: 'data/raw/xinyi/district_bounds.shp',
        sign_overrides: 'data/raw/xinyi/sign_overrides.geojson',
      },
      outputs: {
        generatedDir: 'data/generated/xinyi',
        publicDir: 'public/data/generated/xinyi',
      },
    })
  })

  it('rejects absolute source roots', () => {
    expect(() => ensureRelative('C:/absolute/source')).toThrow(
      'sourceRoot must be a relative path',
    )
  })
})
