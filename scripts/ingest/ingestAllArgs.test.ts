import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  expandConfigPaths,
  parseIngestAllArgs,
  resolveIngestAllConfigPaths,
} from './ingestAllArgs'

describe('ingestAllArgs', () => {
  it('parses ingest-all CLI flags', () => {
    expect(
      parseIngestAllArgs([
        'node',
        'ingestAll',
        '--configs',
        'configs/*.json',
        '--allowWarn',
        '--override',
        'manual review',
        '--dryRun',
        '--noCleanup',
      ]),
    ).toEqual({
      globPattern: 'configs/*.json',
      allowWarn: true,
      allowFail: false,
      overrideReason: 'manual review',
      dryRun: true,
      reportOnly: false,
      noCleanup: true,
    })
  })

  it('parses kebab-case aliases for ingest-all CLI flags', () => {
    expect(
      parseIngestAllArgs([
        'node',
        'ingestAll',
        '--configs',
        'configs/*.json',
        '--allow-warn',
        '--allow-fail',
        '--override',
        'manual review',
        '--dry-run',
        '--report-only',
        '--no-cleanup',
      ]),
    ).toEqual({
      globPattern: 'configs/*.json',
      allowWarn: true,
      allowFail: true,
      overrideReason: 'manual review',
      dryRun: true,
      reportOnly: true,
      noCleanup: true,
    })
  })

  it('expands includeConfigs and glob matches', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-args-'))
    const childPath = path.join(base, 'child.json')
    const parentPath = path.join(base, 'parent.json')
    const sidecarPath = path.join(base, 'xinyi.answer-cases.json')
    await fs.writeFile(
      childPath,
      JSON.stringify({
        districtId: 'child',
        inputs: {
          districtBounds: 'district_bounds.geojson',
          redYellow: 'red_yellow.geojson',
          busStops: 'bus_stops.geojson',
          hydrants: 'hydrants.geojson',
        },
      }),
      'utf-8',
    )
    await fs.writeFile(
      parentPath,
      JSON.stringify({ includeConfigs: ['./child.json'] }),
      'utf-8',
    )
    await fs.writeFile(
      sidecarPath,
      JSON.stringify({ districtId: 'xinyi', cases: [] }),
      'utf-8',
    )

    const expanded = await expandConfigPaths([parentPath])
    expect(expanded).toEqual([path.resolve(childPath)])

    const globbed = await resolveIngestAllConfigPaths(path.join(base, '*.json').replace(/\\/g, '/'))
    expect(globbed).toEqual([path.resolve(childPath)])
  })

  it('rejects globs that only match non-ingest sidecars', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-sidecars-'))
    await fs.writeFile(
      path.join(base, 'xinyi.answer-cases.json'),
      JSON.stringify({ districtId: 'xinyi', cases: [] }),
      'utf-8',
    )

    await expect(
      resolveIngestAllConfigPaths(path.join(base, '*.json')),
    ).rejects.toThrow('No ingest config files matched')
  })
})
