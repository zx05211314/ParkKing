import { describe, expect, it } from 'vitest'
import { parseSignOverridePreflightArgs } from './signOverridePreflightArgs'

describe('parseSignOverridePreflightArgs', () => {
  it('parses config, input, json, and out flags', () => {
    expect(
      parseSignOverridePreflightArgs([
        'node',
        'test',
        '--config',
        'configs/prod/xinyi.json',
        '--input',
        'data/overrides/xinyi.jsonl',
        '--json',
        '--out',
        '.tmp/override-preflight.json',
      ]),
    ).toEqual({
      configPath: 'configs/prod/xinyi.json',
      inputPath: 'data/overrides/xinyi.jsonl',
      json: true,
      outPath: '.tmp/override-preflight.json',
    })
  })
})
