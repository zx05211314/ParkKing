import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  isP0DistrictPublishGatePass,
  resolveP0DefaultReviewPath,
  resolveP0ReadinessInputs,
} from './p0ReadinessState'
import type { PublishGateRunSummary } from './publishGateRunSummary'

describe('p0ReadinessState input resolution', () => {
  it('prefers the current merged review CSV when present', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'p0-readiness-'))
    const tmp = path.join(base, '.tmp')
    await fs.mkdir(tmp, { recursive: true })
    await fs.writeFile(path.join(tmp, 'xinyi-review.csv'), 'source\n', 'utf-8')
    await fs.writeFile(path.join(tmp, 'xinyi-review.merged.csv'), 'merged\n', 'utf-8')
    await fs.writeFile(
      path.join(tmp, 'xinyi-current-review.merged.csv'),
      'current\n',
      'utf-8',
    )

    await expect(resolveP0DefaultReviewPath('xinyi', base)).resolves.toBe(
      path.join('.tmp', 'xinyi-current-review.merged.csv'),
    )
    await expect(resolveP0ReadinessInputs({ districtId: 'xinyi' }, base)).resolves.toEqual(
      expect.objectContaining({
        reviewPath: path.resolve(base, '.tmp', 'xinyi-current-review.merged.csv'),
      }),
    )
  })

  it('falls back to merged review CSV before source review CSV', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'p0-readiness-'))
    const tmp = path.join(base, '.tmp')
    await fs.mkdir(tmp, { recursive: true })
    await fs.writeFile(path.join(tmp, 'xinyi-review.csv'), 'source\n', 'utf-8')
    await fs.writeFile(path.join(tmp, 'xinyi-review.merged.csv'), 'merged\n', 'utf-8')

    await expect(resolveP0DefaultReviewPath('xinyi', base)).resolves.toBe(
      path.join('.tmp', 'xinyi-review.merged.csv'),
    )
  })

  it('keeps an explicit review path', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'p0-readiness-'))

    await expect(
      resolveP0ReadinessInputs(
        {
          districtId: 'xinyi',
          reviewPath: '.tmp/manual-review.csv',
        },
        base,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        reviewPath: path.resolve(base, '.tmp', 'manual-review.csv'),
      }),
    )
  })

  it('passes publish readiness for the selected district when only other districts warn', () => {
    const summary = {
      allowWarn: false,
      allowFail: false,
      districts: [
        { districtId: 'xinyi', warn: 0, fail: 0 },
        { districtId: 'daan', warn: 1, fail: 0 },
      ],
    } as PublishGateRunSummary

    expect(isP0DistrictPublishGatePass(summary, 'xinyi')).toBe(true)
    expect(isP0DistrictPublishGatePass(summary, 'daan')).toBe(false)
  })

  it('requires the selected district to exist in the publish report', () => {
    const summary = {
      allowWarn: true,
      allowFail: true,
      districts: [{ districtId: 'daan', warn: 0, fail: 0 }],
    } as PublishGateRunSummary

    expect(isP0DistrictPublishGatePass(summary, 'xinyi')).toBe(false)
  })
})
