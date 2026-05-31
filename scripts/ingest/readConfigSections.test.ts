import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveBoundaryConfig,
  resolveDerivedConfigSections,
  resolveDistrictIdentity,
  resolveOpsConfig,
  resolveOutputConfig,
  resolveValidationConfig,
} from './readConfigSections'

describe('readConfigSections', () => {
  it('resolves district, boundary, outputs, defaults, ops, and validation', () => {
    expect(resolveDistrictIdentity({ districtId: 'Xin Yi' } as never)).toEqual({
      districtId: 'xin-yi',
      districtName: 'Xin Yi',
    })

    expect(
      resolveBoundaryConfig({
        boundary: {
          featureId: 12,
          name: 'Xinyi',
          aliases: ['靽∠儔?', '  Taipei '],
        },
      } as never),
    ).toEqual({
      featureId: '12',
      names: ['Xinyi', '靽∠儔?', 'Taipei'],
    })

    const outputs = resolveOutputConfig({} as never, path.resolve('configs'), 'xinyi')
    expect(outputs.generatedDir).toMatch(/data[\\/]generated[\\/]xinyi$/)
    expect(outputs.publicDir).toMatch(/public[\\/]data[\\/]generated[\\/]xinyi$/)

    expect(resolveValidationConfig({} as never).minCounts.crosswalks).toBe(0)
    expect(resolveValidationConfig({} as never).minCounts.overridesApplied).toBe(0)
    expect(
      resolveValidationConfig({
        validation: { minCounts: { overridesApplied: 2 } },
      } as never).minCounts.overridesApplied,
    ).toBe(2)
    expect(resolveOpsConfig({} as never).thresholds.maxNewReasonCodePct).toBe(5)
    expect(resolveDerivedConfigSections({} as never).crs.default).toBe('EPSG:3826')
  })
})
