import { describe, expect, it } from 'vitest'
import * as path from 'node:path'
import { buildPackDiffReport } from './diffPackReport'

describe('diffPackReport', () => {
  const fixturesRoot = path.resolve('tests/fixtures/packs')

  it('builds a first-publish report from the next pack only', async () => {
    const nextDir = path.join(fixturesRoot, 'no-prev', 'next')

    const report = await buildPackDiffReport({ prevDir: null, nextDir })

    expect(report.firstPublish).toBe(true)
    expect(report.prevPath).toBeNull()
    expect(report.summary.districtsAdded).toEqual(['alpha'])
    expect(report.districts).toHaveLength(1)
  })
})
