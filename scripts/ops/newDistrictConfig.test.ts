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
        districtBounds: '../../data/raw/xinyi/district_bounds.shp',
        sign_overrides: '../../data/raw/xinyi/sign_overrides.geojson',
      },
      outputs: {
        generatedDir: '../../data/generated/xinyi',
        publicDir: '../../public/data/generated/xinyi',
      },
    })
  })

  it('builds a Taipei shared-source expansion config payload', () => {
    const config = buildNewDistrictConfig({
      districtId: 'songshan',
      districtName: 'Songshan',
      sourceRoot: 'data/sources/shared',
      outputRoot: 'configs/expansion',
      sourcePreset: 'taipei-shared',
      boundaryFeatureId: '63001',
      force: false,
    })

    expect(config).toMatchObject({
      districtId: 'songshan',
      districtName: 'Songshan',
      boundary: {
        featureId: '63001',
      },
      inputs: {
        districtBounds: '../../data/sources/shared/district_bounds/district_bounds.shp',
        redYellow: '../../data/sources/shared/red_yellow/red_yellow.shp',
        busStops: '../../data/sources/shared/bus_stops/bus_stops.shp',
        hydrants: '../../data/sources/shared/hydrants.csv',
        parking_spaces:
          '../../data/sources/shared/parking_spaces/parking_spaces.shp',
        intersections: '../../data/sources/shared/signals.csv',
        road_centerlines:
          '../../data/sources/shared/road_centerlines_gt8m/road_centerlines_gt8m.shp',
        crosswalks: '../../data/sources/shared/crosswalks/crosswalks.shp',
      },
      outputs: {
        generatedDir: '../../data/generated/songshan',
        publicDir: '../../public/data/generated/songshan',
      },
    })
  })

  it('rejects absolute source roots', () => {
    expect(() => ensureRelative('C:/absolute/source')).toThrow(
      'sourceRoot must be a relative path',
    )
  })

  it('rejects absolute output roots', () => {
    expect(() =>
      buildNewDistrictConfig({
        districtId: 'xinyi',
        districtName: 'Xinyi',
        sourceRoot: 'data/raw/xinyi',
        outputRoot: 'C:/absolute/configs',
        force: false,
      }),
    ).toThrow('outputRoot must be a relative path')
  })
})
