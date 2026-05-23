import { describe, expect, it } from 'vitest'
import { parsePackageReleaseArgs } from './packageReleaseArgs'

describe('parsePackageReleaseArgs', () => {
  it('reads outDir, include, and registry flags', () => {
    expect(
      parsePackageReleaseArgs([
        'node',
        'packageRelease.ts',
        '--outDir',
        'dist/releases',
        '--include',
        'public/data/generated/**',
        '--registry',
        'public/data/generated/registry.json',
        '--district',
        'xinyi,daan',
      ]),
    ).toEqual({
      outDir: 'dist/releases',
      include: 'public/data/generated/**',
      registry: 'public/data/generated/registry.json',
      districtIds: ['xinyi', 'daan'],
    })
  })

  it('returns nulls when flags are absent', () => {
    expect(parsePackageReleaseArgs(['node', 'packageRelease.ts'])).toEqual({
      outDir: null,
      include: null,
      registry: null,
      districtIds: [],
    })
  })
})
