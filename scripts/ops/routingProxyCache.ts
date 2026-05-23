import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RoutingCacheFile } from './routingProxyTypes'

export const readRoutingCacheFile = async (
  cacheFile: string,
): Promise<RoutingCacheFile> => {
  try {
    const raw = await readFile(cacheFile, 'utf8')
    const parsed = JSON.parse(raw) as RoutingCacheFile
    return {
      entries: parsed.entries ?? {},
    }
  } catch {
    return { entries: {} }
  }
}

export const writeRoutingCacheFile = async (
  cacheFile: string,
  payload: RoutingCacheFile,
) => {
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, JSON.stringify(payload, null, 2), 'utf8')
}

export const pruneExpiredRoutingCacheEntries = (
  cache: RoutingCacheFile,
  thresholdMs: number,
) => {
  Object.entries(cache.entries).forEach(([key, entry]) => {
    if (entry.cachedAtMs < thresholdMs) {
      delete cache.entries[key]
    }
  })
}
