import { DEFAULT_SAVED_PLAN_LIMIT, normalizeSavedPlans, type SavedPlan } from '../ui/savedPlans'
import type { SyncRuntimeResource } from './syncRuntimeStatus'
import {
  mergeReportLists,
  parseRemoteReportsPayload,
  readReports,
  readReportsRevision,
  setReportsRevision,
  type SegmentReport,
  writeReports,
} from '../feedback/reports'
import {
  fetchJson,
  type ViteEnvLike,
} from './client'
import {
  parseRemoteSavedPlansPayload,
  readSavedPlansRevision,
  setSavedPlansRevision,
  writeLocalSavedPlans,
} from './savedPlansPersistence'
import { resolveParkKingSyncServiceConfig } from './syncContract'

export interface SyncBootstrapConfig {
  endpoint: string | null
  savedPlansEndpoint: string | null
  reportsEndpoint: string | null
}

export interface SyncBootstrapSnapshot {
  savedPlans: SavedPlan[]
  reports: SegmentReport[]
}

export interface SyncBootstrapRemoteSnapshot extends SyncBootstrapSnapshot {
  savedPlansRevision: number | null
  reportsRevision: number | null
}

interface LoadSyncBootstrapOptions {
  config?: SyncBootstrapConfig
  fetchImpl?: typeof fetch
  limit?: number
  resources?: SyncRuntimeResource[]
}

const bootstrapPromiseByEndpoint = new Map<
  string,
  Promise<SyncBootstrapRemoteSnapshot>
>()
const bootstrapLoadPromiseByEndpoint = new Map<
  string,
  Promise<SyncBootstrapSnapshot | null>
>()

const DEFAULT_BOOTSTRAP_RESOURCES: SyncRuntimeResource[] = ['savedPlans', 'reports']

const normalizeBootstrapResources = (resources?: SyncRuntimeResource[]) => {
  const normalizedResources = (resources ?? []).filter(
    (resource, index, allResources) =>
      (resource === 'savedPlans' || resource === 'reports') &&
      allResources.indexOf(resource) === index,
  )

  if (normalizedResources.length === 0) {
    return DEFAULT_BOOTSTRAP_RESOURCES
  }

  return normalizedResources
}

const buildBootstrapRequestEndpoint = (
  endpoint: string,
  resources: SyncRuntimeResource[],
) => {
  const requestedResources = normalizeBootstrapResources(resources)
  if (
    requestedResources.length === DEFAULT_BOOTSTRAP_RESOURCES.length &&
    DEFAULT_BOOTSTRAP_RESOURCES.every((resource) =>
      requestedResources.includes(resource),
    )
  ) {
    return endpoint
  }

  const url = new URL(endpoint, 'http://parkking.local')
  url.searchParams.delete('include')
  requestedResources.forEach((resource) => {
    url.searchParams.append('include', resource)
  })
  const originless = `${url.pathname}${url.search}${url.hash}`
  return /^https?:\/\//i.test(endpoint) ? url.toString() : originless
}

export const resolveSyncBootstrapConfig = (
  env?: ViteEnvLike,
): SyncBootstrapConfig => {
  const syncConfig = resolveParkKingSyncServiceConfig(env)
  return {
    endpoint: syncConfig.bootstrapEndpoint,
    savedPlansEndpoint: syncConfig.savedPlansEndpoint,
    reportsEndpoint: syncConfig.reportsEndpoint,
  }
}

const parseSyncBootstrapPayload = (
  payload: unknown,
  limit = DEFAULT_SAVED_PLAN_LIMIT,
  resources: SyncRuntimeResource[] = DEFAULT_BOOTSTRAP_RESOURCES,
): SyncBootstrapRemoteSnapshot => {
  const requestedResources = normalizeBootstrapResources(resources)
  const includeSavedPlans = requestedResources.includes('savedPlans')
  const includeReports = requestedResources.includes('reports')
  const parsedSavedPlans = includeSavedPlans
    ? parseRemoteSavedPlansPayload(payload, limit)
    : { valid: true, plans: [] as SavedPlan[] }
  const parsedReports = includeReports
    ? parseRemoteReportsPayload(payload)
    : { valid: true, reports: [] as SegmentReport[] }
  if (includeSavedPlans && !parsedSavedPlans.valid) {
    throw new Error('Sync bootstrap response did not include a plans array.')
  }
  if (includeReports && !parsedReports.valid) {
    throw new Error('Sync bootstrap response did not include a reports array.')
  }

  return {
    savedPlans: normalizeSavedPlans(parsedSavedPlans.plans, limit),
    reports: parsedReports.reports,
    savedPlansRevision: includeSavedPlans ? readSavedPlansRevision(payload) : null,
    reportsRevision: includeReports ? readReportsRevision(payload) : null,
  }
}

export const fetchSyncBootstrapSnapshot = async ({
  config = resolveSyncBootstrapConfig(),
  fetchImpl = fetch,
  limit = DEFAULT_SAVED_PLAN_LIMIT,
  resources,
}: LoadSyncBootstrapOptions = {}): Promise<SyncBootstrapRemoteSnapshot | null> => {
  if (!config.endpoint) {
    return null
  }

  const requestedResources = normalizeBootstrapResources(resources)
  const requestEndpoint = buildBootstrapRequestEndpoint(
    config.endpoint,
    requestedResources,
  )
  const cached = bootstrapPromiseByEndpoint.get(requestEndpoint)
  if (cached) {
    return cached
  }

  const requestPromise = (async () => {
    const { response, payload } = await fetchJson(requestEndpoint, {
      fetchImpl,
    })
    if (!response.ok) {
      throw new Error(`Sync bootstrap request failed with ${response.status}.`)
    }

    return parseSyncBootstrapPayload(payload, limit, requestedResources)
  })()

  bootstrapPromiseByEndpoint.set(requestEndpoint, requestPromise)

  try {
    return await requestPromise
  } finally {
    bootstrapPromiseByEndpoint.delete(requestEndpoint)
  }
}

export const loadSyncBootstrap = async (
  options: LoadSyncBootstrapOptions = {},
): Promise<SyncBootstrapSnapshot | null> => {
  const snapshot = await fetchSyncBootstrapSnapshot(options)
  const config = options.config ?? resolveSyncBootstrapConfig()
  const requestedResources = normalizeBootstrapResources(options.resources)
  if (!snapshot) {
    return null
  }

  if (requestedResources.includes('savedPlans')) {
    setSavedPlansRevision(config.savedPlansEndpoint, snapshot.savedPlansRevision)
    writeLocalSavedPlans(snapshot.savedPlans)
  }

  const mergedReports = requestedResources.includes('reports')
    ? mergeReportLists(readReports(), snapshot.reports)
    : readReports()
  if (requestedResources.includes('reports')) {
    writeReports(mergedReports)
    setReportsRevision(config.reportsEndpoint, snapshot.reportsRevision)
  }
  return {
    savedPlans: snapshot.savedPlans,
    reports: mergedReports,
  }
}

export const loadSyncBootstrapOnce = async (
  options: LoadSyncBootstrapOptions = {},
): Promise<SyncBootstrapSnapshot | null> => {
  const config = options.config ?? resolveSyncBootstrapConfig()
  if (!config.endpoint) {
    return loadSyncBootstrap({
      ...options,
      config,
    })
  }

  const requestEndpoint = buildBootstrapRequestEndpoint(
    config.endpoint,
    normalizeBootstrapResources(options.resources),
  )
  const cached = bootstrapLoadPromiseByEndpoint.get(requestEndpoint)
  if (cached) {
    return cached
  }

  const loadPromise = loadSyncBootstrap({
    ...options,
    config,
  })
  bootstrapLoadPromiseByEndpoint.set(requestEndpoint, loadPromise)

  try {
    return await loadPromise
  } catch (error) {
    bootstrapLoadPromiseByEndpoint.delete(requestEndpoint)
    throw error
  }
}

export const resetSyncBootstrapCacheForTests = () => {
  bootstrapPromiseByEndpoint.clear()
  bootstrapLoadPromiseByEndpoint.clear()
}
