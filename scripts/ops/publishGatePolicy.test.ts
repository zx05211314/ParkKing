import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  hasPublishedPack,
  isAdoptableDiffFail,
  isBootstrapOverride,
  isOverrideStatus,
  parseDiffSchemaVersion,
  parseSchemaVersion,
} from './publishGatePolicy'

describe('publishGatePolicy', () => {
  it('recognizes supported override statuses and schema versions', () => {
    expect(isOverrideStatus('LEGAL')).toBe(true)
    expect(isOverrideStatus('ILLEGAL')).toBe(true)
    expect(isOverrideStatus('UNCLEAR')).toBe(true)
    expect(isOverrideStatus('MAYBE')).toBe(false)

    expect(parseSchemaVersion(1)).toBe(1)
    expect(parseSchemaVersion('1')).toBe(1)
    expect(parseSchemaVersion(2)).toBe(2)
    expect(parseSchemaVersion('x')).toBeNull()

    expect(parseDiffSchemaVersion(1)).toBe(1)
    expect(parseDiffSchemaVersion('1')).toBe(1)
    expect(parseDiffSchemaVersion(undefined)).toBeNull()
  })

  it('detects bootstrap overrides and adoptable diff failures', () => {
    expect(isBootstrapOverride('taipei-real-bootstrap')).toBe(true)
    expect(isBootstrapOverride(' acknowledged ')).toBe(false)

    expect(
      isAdoptableDiffFail({
        severity: 'FAIL',
        code: 'DIFF_SEGMENT_COUNT_DELTA',
        message: 'diff fail',
      }),
    ).toBe(true)
    expect(
      isAdoptableDiffFail({
        severity: 'FAIL',
        code: 'TIER_DELTA',
        message: 'reviewed baseline metric drift',
      }),
    ).toBe(true)
    expect(
      isAdoptableDiffFail({
        severity: 'FAIL',
        code: 'PERF_REGRESSION',
        message: 'performance hard fail',
      }),
    ).toBe(false)
    expect(
      isAdoptableDiffFail({
        severity: 'FAIL',
        code: 'DIFF_SEGMENTS_ZERO',
        message: 'hard diff fail',
      }),
    ).toBe(false)
    expect(
      isAdoptableDiffFail({
        severity: 'WARN',
        code: 'DIFF_SEGMENT_COUNT_DELTA',
        message: 'warn only',
      }),
    ).toBe(false)
  })

  it('detects previously published packs from dataset metadata', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-policy-'))
    const publishedDir = path.join(base, 'xinyi')
    await fs.mkdir(publishedDir, { recursive: true })
    await fs.writeFile(
      path.join(publishedDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }),
      'utf-8',
    )

    await expect(hasPublishedPack(base, 'xinyi')).resolves.toBe(true)
    await expect(hasPublishedPack(base, 'daan')).resolves.toBe(false)
    await expect(hasPublishedPack(base, 'unknown')).resolves.toBe(false)
  })
})
