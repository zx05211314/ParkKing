import { describe, expect, it } from 'vitest'
import {
  buildDiffPackUsageError,
  parseDiffPackArgs,
  resolveDiffPackReportPath,
} from './diffPackArgs'

describe('parseDiffPackArgs', () => {
  it('parses format and paths with json as the default format', () => {
    expect(
      parseDiffPackArgs([
        'tsx',
        'diffPacks.ts',
        '--next',
        'next-pack',
        '--prev',
        'prev-pack',
        '--out',
        'report.json',
      ]),
    ).toEqual({
      prev: 'prev-pack',
      next: 'next-pack',
      out: 'report.json',
      format: 'json',
    })
  })
})

describe('resolveDiffPackReportPath', () => {
  it('defaults the report path inside the next pack directory', () => {
    expect(resolveDiffPackReportPath('C:\\packs\\next', null)).toBe(
      'C:\\packs\\next\\diff_report.json',
    )
  })
})

describe('buildDiffPackUsageError', () => {
  it('returns the expected cli usage message', () => {
    expect(buildDiffPackUsageError().message).toContain('Usage: tsx diffPacks.ts --next <path>')
  })
})
