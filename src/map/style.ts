import type { StyleSpecification } from 'maplibre-gl'

const DEFAULT_RASTER_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_RASTER_ATTRIBUTION = '&copy; OpenStreetMap contributors'
const DEFAULT_RASTER_MAX_ZOOM = 19
const DEFAULT_RASTER_TILE_SIZE = 256

type ViteEnvLike = Record<string, string | undefined>

export interface StyleUrlBasemapConfig {
  kind: 'style-url'
  styleUrl: string
}

export interface RasterBasemapConfig {
  kind: 'raster'
  tileUrls: string[]
  attribution: string
  maxZoom: number
  tileSize: number
}

export type BasemapConfig = StyleUrlBasemapConfig | RasterBasemapConfig
export type MapStyleDefinition = StyleSpecification | string

const normalizeText = (value?: string | null) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const getViteEnv = (): ViteEnvLike => {
  const meta = import.meta as { env?: ViteEnvLike }
  return meta.env ?? {}
}

export const resolveBasemapConfig = (env: ViteEnvLike = getViteEnv()): BasemapConfig => {
  const styleUrl = normalizeText(env.VITE_MAP_STYLE_URL)
  if (styleUrl) {
    return {
      kind: 'style-url',
      styleUrl,
    }
  }

  const rasterUrl = normalizeText(env.VITE_MAP_RASTER_URL) ?? DEFAULT_RASTER_TILE_URL
  return {
    kind: 'raster',
    tileUrls: [rasterUrl],
    attribution:
      normalizeText(env.VITE_MAP_ATTRIBUTION) ?? DEFAULT_RASTER_ATTRIBUTION,
    maxZoom: parsePositiveInteger(
      env.VITE_MAP_RASTER_MAX_ZOOM,
      DEFAULT_RASTER_MAX_ZOOM,
    ),
    tileSize: parsePositiveInteger(
      env.VITE_MAP_RASTER_TILE_SIZE,
      DEFAULT_RASTER_TILE_SIZE,
    ),
  }
}

export const createBasemapStyle = (
  config: BasemapConfig = resolveBasemapConfig(),
): MapStyleDefinition => {
  if (config.kind === 'style-url') {
    return config.styleUrl
  }

  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: config.tileUrls,
        tileSize: config.tileSize,
        attribution: config.attribution,
        maxzoom: config.maxZoom,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#0f1116',
        },
      },
      {
        id: 'basemap-raster',
        type: 'raster',
        source: 'basemap',
        paint: {
          'raster-opacity': 1,
        },
      },
    ],
  }
}
