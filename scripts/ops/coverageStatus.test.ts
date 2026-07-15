import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  validateCoverageManifest,
  type CoverageManifest,
} from './coverageStatus'

const writeConfig = async (
  root: string,
  relativePath: string,
  districtId: string,
  featureId: string,
) => {
  const filePath = path.join(root, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(
    filePath,
    JSON.stringify({ districtId, boundary: { featureId } }),
    'utf-8',
  )
}

describe('coverageStatus', () => {
  it('validates configured, source-only, and parent-district coverage', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'coverage-status-'))
    await writeConfig(root, 'configs/expansion/beitou.json', 'beitou', '63012')
    await fs.writeFile(path.join(root, 'taoyuan-sources.json'), '{}', 'utf-8')

    const manifest: CoverageManifest = {
      schemaVersion: 1,
      regions: [
        {
          regionId: 'taipei',
          regionName: 'Taipei City',
          expectedDistrictCount: 1,
          answerCapability: 'full-rule-pipeline',
          districts: [
            {
              districtId: 'beitou',
              districtName: 'Beitou',
              boundaryFeatureId: '63012',
              publishStage: 'candidate',
              configPath: 'configs/expansion/beitou.json',
              requiresHumanReview: true,
            },
          ],
          aliases: [
            {
              areaId: 'shipai',
              areaName: 'Shipai',
              parentDistrictId: 'beitou',
              coverageMode: 'parent-district',
              standaloneBoundaryRequired: true,
            },
          ],
          blockers: [],
        },
        {
          regionId: 'taoyuan',
          regionName: 'Taoyuan City',
          expectedDistrictCount: 1,
          answerCapability: 'paid-curb-reference-only',
          sourceManifestPath: 'taoyuan-sources.json',
          districts: [
            {
              districtId: 'taoyuan-district',
              districtName: 'Taoyuan',
              boundaryFeatureId: '68000010',
              publishStage: 'source-only',
              requiresHumanReview: true,
            },
          ],
          aliases: [],
          blockers: ['Missing curb legality geometry.'],
        },
      ],
    }

    const result = await validateCoverageManifest(manifest, root)
    expect(result.valid).toBe(true)
    expect(result.rows).toHaveLength(2)
    expect(result.blockers).toContain('Taoyuan City: Missing curb legality geometry.')
  })

  it('rejects reference-only districts that claim a publishable config', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'coverage-invalid-'))
    await writeConfig(root, 'configs/prod/taoyuan.json', 'taoyuan', '68000010')
    const manifest: CoverageManifest = {
      schemaVersion: 1,
      regions: [
        {
          regionId: 'taoyuan',
          regionName: 'Taoyuan City',
          expectedDistrictCount: 1,
          answerCapability: 'paid-curb-reference-only',
          districts: [
            {
              districtId: 'taoyuan',
              districtName: 'Taoyuan',
              boundaryFeatureId: '68000010',
              publishStage: 'production',
              configPath: 'configs/prod/taoyuan.json',
              requiresHumanReview: false,
            },
          ],
          aliases: [],
          blockers: [],
        },
      ],
    }

    const result = await validateCoverageManifest(manifest, root)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'taoyuan: reference-only coverage cannot be publishable',
    )
  })
})
