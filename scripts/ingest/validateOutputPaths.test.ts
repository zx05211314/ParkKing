import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveValidateOutputPaths } from './validateOutputPaths'

describe('validateOutputPaths', () => {
  it('resolves generated output file paths for a district', () => {
    const config = {
      districtId: 'xinyi',
      outputs: {
        generatedDir: path.resolve('data/generated/xinyi'),
      },
    } as const

    const paths = resolveValidateOutputPaths(config as never)
    expect(paths.boundaryFile).toBe('xinyi_boundary.geojson')
    expect(paths.redYellowPath).toMatch(/red_yellow\.geojson$/)
    expect(paths.metaPath).toMatch(/dataset_meta\.json$/)
    expect(paths.intersectionsReportPath).toMatch(/intersections_report\.json$/)
  })
})
