import { describe, expect, it } from 'vitest'
import { parsePackageReleaseArgs } from './packageReleaseArgs'

describe('parsePackageReleaseArgs', () => {
  it('reads outDir, include, and registry flags', () => {
    expect(
      parsePackageReleaseArgs([
        'node',
        'packageRelease.ts',
        '--out-dir',
        'dist/releases',
        '--include',
        'public/data/generated/**',
        '--registry',
        'public/data/generated/registry.json',
        '--districts',
        'xinyi,daan',
        '--reviewed',
        '--answer-cases',
        'configs/prod/*.answer-cases.json',
        '--release-id',
        '20260605140713_21e282f',
      ]),
    ).toEqual({
      outDir: 'dist/releases',
      include: 'public/data/generated/**',
      registry: 'public/data/generated/registry.json',
      districtIds: ['xinyi', 'daan'],
      reviewed: true,
      answerCasesGlob: 'configs/prod/*.answer-cases.json',
      releaseId: '20260605140713_21e282f',
    })
  })

  it('returns nulls when flags are absent', () => {
    expect(parsePackageReleaseArgs(['node', 'packageRelease.ts'])).toEqual({
      outDir: null,
      include: null,
      registry: null,
      districtIds: [],
      reviewed: false,
      answerCasesGlob: null,
      releaseId: null,
    })
  })
})
