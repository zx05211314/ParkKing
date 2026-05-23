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
      force: true,
    })
  })

  it('keeps the published usage string stable', () => {
    expect(NEW_DISTRICT_USAGE).toContain('--districtId <id>')
    expect(NEW_DISTRICT_USAGE).toContain('--sourceRoot "data/raw/<id>"')
  })
})
