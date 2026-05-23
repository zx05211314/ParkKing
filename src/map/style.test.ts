import { describe, expect, it } from 'vitest'
import { createBasemapStyle, resolveBasemapConfig } from './style'

describe('resolveBasemapConfig', () => {
  it('defaults to an OpenStreetMap raster basemap', () => {
    const result = resolveBasemapConfig({})

    expect(result).toEqual({
      kind: 'raster',
      tileUrls: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      tileSize: 256,
    })
  })

  it('prefers an explicit style url when configured', () => {
    const result = resolveBasemapConfig({
      VITE_MAP_STYLE_URL: 'https://maps.example.com/style.json',
    })

    expect(result).toEqual({
      kind: 'style-url',
      styleUrl: 'https://maps.example.com/style.json',
    })
  })

  it('uses configured raster values when style url is absent', () => {
    const result = resolveBasemapConfig({
      VITE_MAP_RASTER_URL: 'https://tiles.example.com/{z}/{x}/{y}.png',
      VITE_MAP_ATTRIBUTION: 'Example Maps',
      VITE_MAP_RASTER_MAX_ZOOM: '21',
      VITE_MAP_RASTER_TILE_SIZE: '512',
    })

    expect(result).toEqual({
      kind: 'raster',
      tileUrls: ['https://tiles.example.com/{z}/{x}/{y}.png'],
      attribution: 'Example Maps',
      maxZoom: 21,
      tileSize: 512,
    })
  })

  it('falls back for invalid raster numeric settings', () => {
    const result = resolveBasemapConfig({
      VITE_MAP_RASTER_MAX_ZOOM: 'abc',
      VITE_MAP_RASTER_TILE_SIZE: '-5',
    })

    expect(result).toEqual({
      kind: 'raster',
      tileUrls: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      tileSize: 256,
    })
  })
})

describe('createBasemapStyle', () => {
  it('returns the style url directly for style-url basemaps', () => {
    expect(
      createBasemapStyle({
        kind: 'style-url',
        styleUrl: 'https://maps.example.com/style.json',
      }),
    ).toBe('https://maps.example.com/style.json')
  })

  it('creates a raster style specification for raster basemaps', () => {
    const result = createBasemapStyle({
      kind: 'raster',
      tileUrls: ['https://tiles.example.com/{z}/{x}/{y}.png'],
      attribution: 'Example Maps',
      maxZoom: 20,
      tileSize: 512,
    })

    expect(typeof result).toBe('object')
    expect(result).toMatchObject({
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://tiles.example.com/{z}/{x}/{y}.png'],
          tileSize: 512,
          attribution: 'Example Maps',
          maxzoom: 20,
        },
      },
    })
  })
})
