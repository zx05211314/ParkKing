import { describe, expect, it, vi } from 'vitest'
import {
  resolveSampleQaCandidateDistrictIds,
  resolveSampleQaCandidateParams,
} from './sampleQaCandidateRequest'

describe('sampleQaCandidateRequest', () => {
  it('applies stable defaults for sampling params', () => {
    expect(resolveSampleQaCandidateParams({ districtId: 'xinyi' })).toMatchObject({
      all: false,
      districtId: 'xinyi',
      topN: 50,
      outPath: null,
      configRoot: 'configs/prod',
      riskMode: 'NEUTRAL',
      radiusMeters: 600,
      shuffle: false,
      seed: 1,
      strategy: 'ranked',
      hhmm: '13:00',
      requiredSegmentIds: [],
    })
  })

  it('keeps required segment ids in resolved sampling params', () => {
    expect(
      resolveSampleQaCandidateParams({
        districtId: 'songshan',
        requiredSegmentIds: ['candidate-a'],
      }).requiredSegmentIds,
    ).toEqual(['candidate-a'])
  })

  it('accepts review strategy and custom evaluation time', () => {
    expect(
      resolveSampleQaCandidateParams({
        districtId: 'xinyi',
        strategy: 'review',
        hhmm: '21:00',
      }),
    ).toMatchObject({
      strategy: 'review',
      hhmm: '21:00',
    })
  })

  it('resolves district ids through discovery when sampling all districts', async () => {
    const discover = vi.fn().mockResolvedValue(['songshan', 'daan'])

    await expect(
      resolveSampleQaCandidateDistrictIds({
        all: true,
        districtId: null,
        datasetRoots: ['root'],
        discoverDistrictIds: discover,
      }),
    ).resolves.toEqual(['daan', 'songshan'])
    expect(discover).toHaveBeenCalledWith(['root'])
  })

  it('throws when there is no explicit or discovered district id', async () => {
    await expect(
      resolveSampleQaCandidateDistrictIds({
        all: false,
        districtId: null,
        datasetRoots: [],
        discoverDistrictIds: async () => [],
      }),
    ).rejects.toThrow('No districts found to sample')
  })
})
