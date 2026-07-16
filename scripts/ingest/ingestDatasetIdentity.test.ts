import { describe, expect, it } from 'vitest'
import type { FileHashEntry } from './hashFiles'
import { buildDatasetIdentityFromHashes } from './ingestDatasetIdentity'

const entry = (sha256: string): FileHashEntry => ({ sha256, bytes: 10 })

describe('ingestDatasetIdentity', () => {
  it('is stable across input order and byte metadata', () => {
    const first = buildDatasetIdentityFromHashes({
      'red_yellow.geojson': entry('red'),
      'xinyi_boundary.geojson': entry('boundary'),
    })
    const second = buildDatasetIdentityFromHashes({
      'xinyi_boundary.geojson': { sha256: 'boundary', bytes: 999 },
      'red_yellow.geojson': { sha256: 'red', bytes: 1 },
    })

    expect(first).toEqual(second)
  })

  it('changes when any runtime file content changes', () => {
    const before = buildDatasetIdentityFromHashes({
      'red_yellow.geojson': entry('red-v1'),
      'xinyi_boundary.geojson': entry('boundary'),
    })
    const after = buildDatasetIdentityFromHashes({
      'red_yellow.geojson': entry('red-v2'),
      'xinyi_boundary.geojson': entry('boundary'),
    })

    expect(after.datasetHash).not.toBe(before.datasetHash)
  })
})
