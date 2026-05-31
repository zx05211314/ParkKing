import { describe, expect, it } from 'vitest'
import { hasZipExt, normalizeZipPath, stripZipExt } from './unpackSourceZipPath'

describe('unpackSourceZipPath', () => {
  it('normalizes paths and detects extensions', () => {
    expect(normalizeZipPath('.\\folder\\\\file.SHP')).toBe('folder/file.SHP')
    expect(hasZipExt('archive.ZIP', '.zip')).toBe(true)
    expect(stripZipExt('setA/main.shp')).toBe('setA/main')
  })
})
