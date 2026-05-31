import { describe, expect, it } from 'vitest'
import { hashBuffer } from './diffPackHashing'

describe('diffPackHashing', () => {
  it('hashes buffers deterministically', () => {
    expect(hashBuffer(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
