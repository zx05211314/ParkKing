import { describe, expect, it } from 'vitest'

import { parseGenerateBaselinesArgs } from './generateBaselineArgs'

describe('generateBaselineArgs', () => {
  it('parses force, seed, and district filter flags', () => {
    expect(
      parseGenerateBaselinesArgs([
        'node',
        'generateBaselines.ts',
        '--seed',
        '--force',
        '--districtId',
        'xinyi',
        '--root',
        '.tmp/published-release',
      ]),
    ).toEqual({
      force: true,
      seed: true,
      districtIdFilter: 'xinyi',
      generatedRoot: '.tmp/published-release',
    })
  })

  it('defaults to the published runtime root', () => {
    expect(parseGenerateBaselinesArgs(['node', 'generateBaselines.ts'])).toEqual({
      force: false,
      seed: false,
      districtIdFilter: null,
      generatedRoot: 'public/data/generated',
    })
  })

  it('rejects missing or empty generated roots', () => {
    expect(() =>
      parseGenerateBaselinesArgs(['node', 'generateBaselines.ts', '--root']),
    ).toThrow('--root requires a value')
    expect(() =>
      parseGenerateBaselinesArgs([
        'node',
        'generateBaselines.ts',
        '--generated-root',
        ' ',
      ]),
    ).toThrow('--root requires a non-empty value')
  })
})
