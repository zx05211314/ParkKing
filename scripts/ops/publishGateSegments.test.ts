import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildSegmentIdSet,
  normalizeOverrideSegmentId,
  parseSegmentId,
} from './publishGateSegments'

describe('publishGateSegments', () => {
  it('normalizes and reads segment ids from override metadata', () => {
    expect(normalizeOverrideSegmentId('xinyi-main-part-2')).toBe('xinyi-main')
    expect(
      parseSegmentId({
        segment_id: 'seg-1',
      }),
    ).toBe('seg-1')
    expect(
      parseSegmentId({
        segmentID: 'seg-2',
      }),
    ).toBe('seg-2')
    expect(parseSegmentId(null)).toBeNull()
  })

  it('builds segment ids from dataset geometry files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-segments-'))
    await fs.writeFile(
      path.join(base, 'red_yellow.geojson'),
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: 'curb-a' },
            geometry: {
              type: 'LineString',
              coordinates: [
                [121.5, 25.0],
                [121.5001, 25.0001],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { id: 'curb-b' },
            geometry: {
              type: 'MultiLineString',
              coordinates: [
                [
                  [121.6, 25.1],
                  [121.6001, 25.1001],
                ],
                [
                  [121.7, 25.2],
                  [121.7001, 25.2001],
                ],
              ],
            },
          },
        ],
      }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(base, 'candidates_inferred.geojson'),
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: 'inf-a' },
            geometry: {
              type: 'LineString',
              coordinates: [
                [121.8, 25.3],
                [121.8001, 25.3001],
              ],
            },
          },
        ],
      }),
      'utf-8',
    )

    await expect(buildSegmentIdSet(base)).resolves.toEqual(
      new Set(['curb-a', 'curb-b-p1', 'curb-b-p2', 'inf-a']),
    )
  })
})
