import { resolve } from 'node:path'
import type { SyncBootstrapResource, SyncServiceConfig } from './syncServiceTypes'

export const DEFAULT_SYNC_PATH = '/api/sync'
export const DEFAULT_SYNC_PORT = 8789
export const DEFAULT_SYNC_FILE = '.tmp/sync-service.json'
export const DEFAULT_SYNC_SCOPE = 'default'
export const STORE_SCHEMA_VERSION = 1

export const normalizeSyncText = (value?: string | null) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const normalizeScope = (
  scope?: string | null,
  fallback = DEFAULT_SYNC_SCOPE,
) => normalizeSyncText(scope) ?? fallback

export const normalizeBootstrapResources = (
  values: string[],
): SyncBootstrapResource[] => {
  const resources: SyncBootstrapResource[] = []
  values.forEach((value) => {
    value
      .split(',')
      .map((part) => normalizeSyncText(part))
      .forEach((part) => {
        if (
          (part === 'savedPlans' || part === 'reports') &&
          !resources.includes(part)
        ) {
          resources.push(part)
        }
      })
  })
  return resources.length > 0 ? resources : ['savedPlans', 'reports']
}

export const resolveSyncServiceConfig = (
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): SyncServiceConfig => ({
  path: normalizeSyncText(env.PARKKING_SYNC_PATH) ?? DEFAULT_SYNC_PATH,
  port: parsePositiveInteger(env.PARKKING_SYNC_PORT, DEFAULT_SYNC_PORT),
  storageFile: resolve(cwd, env.PARKKING_SYNC_FILE ?? DEFAULT_SYNC_FILE),
  defaultScope: normalizeScope(env.PARKKING_SYNC_DEFAULT_SCOPE),
})
