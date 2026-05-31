import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { writeDiffPackOutputs } from './diffPackOutputFiles'
import type { PackDiffReport } from './diffPackTypes'

describe('diffPackOutputFiles', () => {
  const tempDirs: string[] = []
  const report: PackDiffReport = {
    schemaVersion: 1,
    generatedAt: '2026-03-21T00:00:00.000Z',
    prevPath: null,
    nextPath: 'C:/packs/next',
    firstPublish: true,
    districts: [
      {
        districtId: 'alpha',
        status: 'ADDED',
        severity: 'OK',
        issues: [],
        meta: {
          segmentsCount: { prev: null, next: 10, delta: null, deltaPct: null },
          overridesAppliedCount: { prev: null, next: 0, delta: null, deltaPct: null },
          signOverridesCount: { prev: null, next: 0, delta: null, deltaPct: null },
          signOverrideUnmatchedNamedCount: {
            prev: null,
            next: 0,
            delta: null,
            deltaPct: null,
          },
          curbMarkingKnownRate: { prev: null, next: 1, delta: null, deltaPct: null },
          restrictionTriggeredRate: { prev: null, next: 0, delta: null, deltaPct: null },
          boundaryBBox: {
            prev: null,
            next: null,
            delta: null,
            area: { prev: null, next: null, delta: null, deltaPct: null },
          },
          boundaryCenter: { prev: null, next: null, delta: null, distance: null },
          provenanceFetchedAt: { prev: null, next: null, changed: false },
        },
        files: {
          added: ['dataset_meta.json'],
          removed: [],
          modified: [],
        },
      },
    ],
    summary: {
      districtsAdded: ['alpha'],
      districtsRemoved: [],
      totalChangedFiles: 1,
    },
  }

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await fs.rm(dir, { recursive: true, force: true })
      }),
    )
  })

  it('writes json and markdown outputs', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-output-'))
    tempDirs.push(dir)
    const outPath = path.join(dir, 'report.json')

    await writeDiffPackOutputs({ outPath, report, format: 'md' })

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain('"schemaVersion": 1')
    await expect(fs.readFile(path.join(dir, 'report.md'), 'utf-8')).resolves.toContain(
      '# Pack diff report',
    )
  })
})
