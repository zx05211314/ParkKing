import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { validateConfigs } from './validateConfigs'

describe('validateConfigs', () => {
  it('flags invalid configs and accepts ciSafe fixtures', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'configs-test-'))
    const configsDir = path.join(base, 'configs')
    await fs.mkdir(configsDir, { recursive: true })

    const valid = {
      districtId: 'xinyi',
      districtName: 'Xinyi',
      ciSafe: true,
      inputs: {
        districtBounds: 'tests/fixtures/xinyi/xinyi_boundary.geojson',
        redYellow: 'tests/fixtures/xinyi/red_yellow.geojson',
        busStops: 'tests/fixtures/xinyi/bus_stops.geojson',
        hydrants: 'tests/fixtures/xinyi/hydrants.geojson',
      },
    }

    const invalid = {
      districtId: 'bad',
      inputs: {
        districtBounds: '/abs/path.geojson',
      },
    }
    const sourceManifest = {
      districtId: 'xinyi',
      configPath: './prod/xinyi.json',
      sources: [
        {
          url: 'https://example.test/source.zip',
          dest: '../data/sources/shared/source.zip',
        },
      ],
    }
    const answerCases = {
      schemaVersion: 1,
      districtId: 'xinyi',
      datasetHash: 'hash-1',
      cases: [],
    }

    await fs.writeFile(
      path.join(configsDir, 'valid.json'),
      JSON.stringify(valid, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      path.join(configsDir, 'invalid.json'),
      JSON.stringify(invalid, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      path.join(configsDir, 'sources.prod.taipei.json'),
      JSON.stringify(sourceManifest, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      path.join(configsDir, 'xinyi.answer-cases.json'),
      JSON.stringify(answerCases, null, 2),
      'utf-8',
    )

    const result = await validateConfigs({ configsDir })
    const issueByFile = new Map(
      result.issues.map((issue) => [path.basename(issue.configPath), issue]),
    )

    expect(issueByFile.get('valid.json')?.errors.length).toBe(0)
    expect(issueByFile.get('invalid.json')?.errors.length).toBeGreaterThan(0)
    expect(issueByFile.has('sources.prod.taipei.json')).toBe(false)
    expect(issueByFile.has('xinyi.answer-cases.json')).toBe(false)
    expect(result.hasErrors).toBe(true)
  })
})
