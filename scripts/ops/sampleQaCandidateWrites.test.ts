import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { writeQaCandidates } from './sampleQaCandidateWrites'

describe('sampleQaCandidateWrites', () => {
  it('writes a district csv using the resolved qa candidate path rules', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-candidate-writes-'))
    const outPath = await writeQaCandidates({
      districtId: 'xinyi',
      all: true,
      outPath: path.join(base, '{districtId}.csv'),
      rows: [
        {
          districtId: 'xinyi',
          segmentId: 'seg-1',
          lat: '25.050000',
          lon: '121.500000',
          score: '0.8123',
          reviewBucket: 'ranked',
          tier: 'RED',
          allowedNow: 'NO_STOP',
          curbMarking: 'RED',
          sourceType: 'CURB',
          sourceReliability: 'HIGH',
          dataFreshnessDays: '',
          finalConfidence: 'HIGH',
          coverageConfidence: 'HIGH',
          overrideConfidence: 'HIGH',
          parkingSpaceCount: '0',
          topReasons: ['RULE_A'],
          flags: ['override'],
          riskTags: [],
          signOverrideStatus: '',
          signOverrideSource: '',
          signOverrideVerifiedAt: '',
          signOverrideNote: '',
          mapsUrl: 'https://www.google.com/maps?q=25.050000,121.500000',
          streetViewUrl:
            'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=25.050000,121.500000',
          reviewSource: '',
          reviewStatus: '',
          reviewNote: '',
          createdAt: '',
        },
      ],
    })

    expect(outPath).toMatch(/xinyi\.csv$/)
    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain('segmentId')
  })
})
