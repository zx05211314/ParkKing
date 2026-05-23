import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseConfigArg,
  resolveConfigInputs,
} from './readConfigInputs'

describe('readConfigInputs', () => {
  it('parses config CLI args', () => {
    expect(parseConfigArg(['node', 'script', '--config', 'a.json'])).toBe('a.json')
    expect(parseConfigArg(['node', 'script', '-c', 'b.json'])).toBe('b.json')
    expect(parseConfigArg(['node', 'script'])).toBeNull()
  })

  it('resolves aliased inputs and relative paths', () => {
    const inputs = resolveConfigInputs(
      {
        inputs: {
          districtBounds: './boundary.geojson',
          red_yellow: './red.geojson',
          bus_stops: './bus.geojson',
          hydrants: './hydrants.geojson',
          signOverrides: './signs.geojson',
        } as never,
      },
      path.resolve('configs'),
    )

    expect(inputs.districtBounds).toMatch(/configs[\\/]boundary\.geojson$/)
    expect(inputs.redYellow).toMatch(/configs[\\/]red\.geojson$/)
    expect(inputs.busStops).toMatch(/configs[\\/]bus\.geojson$/)
    expect(inputs.sign_overrides).toMatch(/configs[\\/]signs\.geojson$/)
  })
})
