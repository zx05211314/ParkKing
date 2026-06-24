import { describe, expect, it } from 'vitest'
import { NEW_DISTRICT_USAGE, parseArgs } from './newDistrictArgs'

describe('newDistrictArgs', () => {
  it('parses district options and force flag', () => {
    expect(
      parseArgs([
        'node',
        'script',
        '--districtId',
        'xinyi',
        '--districtName',
        'Xinyi',
        '--sourceRoot',
        'data/raw/xinyi',
        '--force',
      ]),
    ).toEqual({
      districtId: 'xinyi',
      districtName: 'Xinyi',
      sourceRoot: 'data/raw/xinyi',
      outputRoot: null,
      sourcePreset: null,
      boundaryFeatureId: null,
      boundaryName: null,
      force: true,
    })
  })

  it('parses expansion output and Taipei shared source preset', () => {
    expect(
      parseArgs([
        'node',
        'script',
        '--districtId',
        'songshan',
        '--districtName',
        'Songshan',
        '--sourceRoot',
        'data/sources/shared',
        '--outputRoot',
        'configs/expansion',
        '--sourcePreset',
        'taipei-shared',
        '--boundaryFeatureId',
        '63001',
      ]),
    ).toEqual({
      districtId: 'songshan',
      districtName: 'Songshan',
      sourceRoot: 'data/sources/shared',
      outputRoot: 'configs/expansion',
      sourcePreset: 'taipei-shared',
      boundaryFeatureId: '63001',
      boundaryName: null,
      force: false,
    })
  })

  it('rejects unsupported source presets', () => {
    expect(() => parseArgs(['--sourcePreset', 'unknown'])).toThrow(
      'Unsupported source preset: unknown',
    )
  })

  it('keeps the published usage string stable', () => {
    expect(NEW_DISTRICT_USAGE).toContain('--districtId <id>')
    expect(NEW_DISTRICT_USAGE).toContain('--sourceRoot "data/raw/<id>"')
    expect(NEW_DISTRICT_USAGE).toContain('--outputRoot configs/expansion')
  })
})
