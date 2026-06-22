export type FetchLike = typeof fetch
export type RoutingProfile = 'walking' | 'driving'

export interface RoutingProxyProviderConfig {
  endpoint: string
}

export interface RoutingProxyConfig {
  primary: RoutingProxyProviderConfig
  fallback: RoutingProxyProviderConfig | null
  cacheTtlMs: number
  requestTimeoutMs: number
  cacheFile: string
  userAgent: string
  path: string
  port: number
}

export interface RoutingProxyRequest {
  profile: RoutingProfile
  origin: [number, number]
  destinations: [number, number][]
}

export interface RoutingPathRequest {
  profile: RoutingProfile
  origin: [number, number]
  destination: [number, number]
}

export interface RoutingMatrixEntry {
  destination: [number, number]
  distanceMeters: number | null
  durationSeconds: number | null
  estimated: boolean
}

export interface RoutingPathEntry {
  destination: [number, number]
  distanceMeters: number | null
  durationSeconds: number | null
  estimated: boolean
  geometry: [number, number][] | null
}

export interface RoutingCacheEntry {
  cachedAtMs: number
  payload: unknown
}

export interface RoutingCacheFile {
  entries: Record<string, RoutingCacheEntry>
}

export interface RoutingProxyDependencies {
  fetchImpl?: FetchLike
  now?: () => number
}

export interface RoutingProxyService {
  route(request: RoutingProxyRequest): Promise<RoutingMatrixEntry[]>
  routePath(request: RoutingPathRequest): Promise<RoutingPathEntry>
}

export interface OsrmTablePayload {
  code?: string
  message?: string
  durations?: Array<Array<number | null>>
  distances?: Array<Array<number | null>>
  fallback_speed_cells?: Array<[number, number]>
}

export interface OsrmRoutePayload {
  code?: string
  message?: string
  routes?: Array<{
    distance?: number | null
    duration?: number | null
    geometry?: {
      coordinates?: unknown
    } | null
  }>
}
