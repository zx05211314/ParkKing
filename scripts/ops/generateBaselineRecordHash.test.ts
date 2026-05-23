import { describe, expect, it } from 'vitest'
import { sha256Text } from './generateBaselineRecordHash'

describe('generateBaselineRecordHash', () => {
  it('hashes metadata text deterministically', () => {
    expect(sha256Text('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
