import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveOverrideReportsPath } from './overrideReportsPath'

describe('resolveOverrideReportsPath', () => {
  it('uses the default data/overrides directory', () => {
    expect(resolveOverrideReportsPath('xinyi', '/repo')).toBe(
      path.resolve('/repo', 'data', 'overrides', 'xinyi.jsonl'),
    )
  })

  it('can isolate override reports with a relative env directory', () => {
    expect(resolveOverrideReportsPath('xinyi', '/repo', '.tmp/ci-overrides')).toBe(
      path.resolve('/repo', '.tmp', 'ci-overrides', 'xinyi.jsonl'),
    )
  })

  it('can isolate override reports with an absolute env directory', () => {
    const overrideDir = path.resolve('/tmp', 'parkking-overrides')

    expect(resolveOverrideReportsPath('xinyi', '/repo', overrideDir)).toBe(
      path.resolve(overrideDir, 'xinyi.jsonl'),
    )
  })
})
