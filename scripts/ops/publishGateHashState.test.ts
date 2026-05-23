import { describe, expect, it } from 'vitest'
import { getPublishGateMetaFiles } from './publishGateHashState'

describe('publishGateHashState', () => {
  it('returns a failure when the files map is missing', () => {
    expect(getPublishGateMetaFiles('xinyi', {})).toEqual({
      files: null,
      warnings: [
        expect.objectContaining({
          code: 'META_FILES_MISSING',
          severity: 'FAIL',
        }),
      ],
    })
  })

  it('flags required pack files missing from the metadata map', () => {
    const result = getPublishGateMetaFiles('xinyi', {
      files: {
        'red_yellow.geojson': {
          sha256: 'abc',
          bytes: 1,
        },
      },
    })

    expect(result.files).not.toBeNull()
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'META_FILE_ENTRY_MISSING',
          severity: 'FAIL',
        }),
      ]),
    )
  })
})
