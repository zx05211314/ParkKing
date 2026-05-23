import { describe, expect, it } from 'vitest'
import { parseValidateConfigArgs } from './validateConfigArgs'

describe('parseValidateConfigArgs', () => {
  it('reads dir, glob, and absolute flags', () => {
    expect(
      parseValidateConfigArgs([
        'node',
        'validateConfigs.ts',
        '--dir',
        'configs',
        '--configs',
        'configs/**/*.json',
        '--allowAbsolute',
      ]),
    ).toEqual({
      configsDir: 'configs',
      configsGlob: 'configs/**/*.json',
      allowAbsolute: true,
    })
  })

  it('returns nulls when optional flags are absent', () => {
    expect(parseValidateConfigArgs(['node', 'validateConfigs.ts'])).toEqual({
      configsDir: null,
      configsGlob: null,
      allowAbsolute: false,
    })
  })
})
