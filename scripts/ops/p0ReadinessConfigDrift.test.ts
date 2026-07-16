import { describe, expect, it } from 'vitest'
import {
  buildP0ReviewConfigDriftWarnings,
  compareRuntimeSourceFiles,
} from './p0ReadinessConfigDrift'

const sourceFile = {
  path: 'C:\\repo\\data\\sources\\shared\\parking_spaces\\parking_spaces.shp',
  mtimeMs: 1767946144000,
  size: 45418932,
}

describe('p0ReadinessConfigDrift', () => {
  it('classifies hash drift with matching source files as non-source config drift', () => {
    const warnings = buildP0ReviewConfigDriftWarnings({
      manifest: {
        districtId: 'xinyi',
        configHash: 'runtime-config-hash',
        datasetHash: 'runtime-dataset-hash',
      },
      current: {
        districtId: 'xinyi',
        configHash: 'current-config-hash',
        datasetSourceHash: 'current-dataset-hash',
        generatorHash: 'generator-hash',
        sourceFiles: [sourceFile],
        signOverrides: {
          matchToleranceMeters: 15,
        },
      },
      runtime: {
        districtId: 'xinyi',
        configHash: 'runtime-config-hash',
        datasetSourceHash: 'runtime-dataset-hash',
        generatorHash: 'generator-hash',
        sourceFiles: [sourceFile],
        signOverrideMatchToleranceMeters: 15,
      },
    })

    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toContain('Current source files match the runtime pack')
    expect(warnings[0]).toContain('non-source config drift')
  })

  it('reports data-affecting source file drift', () => {
    const warnings = buildP0ReviewConfigDriftWarnings({
      manifest: {
        districtId: 'xinyi',
        configHash: 'runtime-config-hash',
      },
      current: {
        districtId: 'xinyi',
        configHash: 'current-config-hash',
        datasetHash: 'runtime-dataset-hash',
        generatorHash: 'generator-hash',
        sourceFiles: [{ ...sourceFile, size: sourceFile.size + 1 }],
        signOverrides: {
          matchToleranceMeters: 15,
        },
      },
      runtime: {
        sourceFiles: [sourceFile],
        signOverrideMatchToleranceMeters: 15,
      },
    })

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Current config can change data output')
    expect(warnings[0]).toContain('source file drift: changed 1')
  })

  it('detects added and missing source files', () => {
    expect(compareRuntimeSourceFiles([{ ...sourceFile, path: 'C:\\repo\\new.shp' }], [
      sourceFile,
    ])).toEqual({
      missing: [sourceFile.path],
      extra: ['C:\\repo\\new.shp'],
      changed: [],
    })
  })

  it('requires a new review packet when the generator changes', () => {
    const warnings = buildP0ReviewConfigDriftWarnings({
      manifest: {
        districtId: 'xinyi',
        generatorHash: 'reviewed-generator',
      },
      current: {
        districtId: 'xinyi',
        configHash: 'config-hash',
        datasetSourceHash: 'source-hash',
        generatorHash: 'current-generator',
        sourceFiles: [sourceFile],
        signOverrides: { matchToleranceMeters: 15 },
      },
      runtime: null,
    })

    expect(warnings).toEqual([
      expect.stringContaining('Ingest behavior changed; regenerate the review packet.'),
    ])
  })

  it('matches cross-platform source paths by stable key and content hash', () => {
    const contentHash = 'stable-source-hash'
    expect(
      compareRuntimeSourceFiles(
        [
          {
            ...sourceFile,
            sourceKey: 'parking_spaces',
            contentHash,
          },
        ],
        [
          {
            ...sourceFile,
            path: '/home/runner/work/ParkKing/data/sources/parking_spaces.shp',
            mtimeMs: sourceFile.mtimeMs + 10_000,
            sourceKey: 'parking_spaces',
            contentHash,
          },
        ],
      ),
    ).toEqual({
      missing: [],
      extra: [],
      changed: [],
    })
  })
})
