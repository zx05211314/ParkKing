import {
  normalizeOptionalText,
  readViteEnv,
  resolveLocalhostProxyEndpoint,
  type ViteEnvLike,
} from './client'

const DEFAULT_SAVED_PLANS_RESOURCE_PATH = 'saved-plans'
const DEFAULT_REPORTS_RESOURCE_PATH = 'reports'
const DEFAULT_ISSUES_RESOURCE_PATH = 'issues'
const DEFAULT_BOOTSTRAP_RESOURCE_PATH = 'bootstrap'
const DEFAULT_STATUS_RESOURCE_PATH = 'status'
const DEFAULT_READINESS_RESOURCE_PATH = 'ready'
const LOCAL_SYNC_PROXY_PATH = '/api/sync'
const ISSUE_UPLOAD_ONLY_MODE = 'issue-upload-only'

export interface ParkKingSyncServiceConfig {
  baseUrl: string | null
  bootstrapEndpoint: string | null
  statusEndpoint: string | null
  readinessEndpoint: string | null
  savedPlansEndpoint: string | null
  reportsEndpoint: string | null
  issueReportsEndpoint: string | null
}

const joinEndpointPath = (baseUrl: string, resourcePath: string) => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const normalizedResourcePath = resourcePath.replace(/^\/+/, '')
  return `${normalizedBaseUrl}/${normalizedResourcePath}`
}

const appendScopeParam = (endpoint: string | null, scope: string | null) => {
  if (!endpoint || !scope) {
    return endpoint
  }
  const url = new URL(endpoint, 'http://parkking.local')
  url.searchParams.set('scope', scope)
  const originless = `${url.pathname}${url.search}${url.hash}`
  return /^https?:\/\//i.test(endpoint) ? url.toString() : originless
}

export const resolveParkKingSyncServiceConfig = (
  env: ViteEnvLike = readViteEnv(),
): ParkKingSyncServiceConfig => {
  const savedPlansLegacyEndpoint = normalizeOptionalText(env.VITE_SAVED_PLANS_URL)
  const reportsLegacyEndpoint = normalizeOptionalText(env.VITE_REPORTS_URL)
  const issueReportsLegacyEndpoint = normalizeOptionalText(env.VITE_ISSUE_REPORTS_URL)
  const configuredBaseUrl = normalizeOptionalText(env.VITE_SYNC_BASE_URL)
  const issueUploadOnly =
    normalizeOptionalText(env.VITE_SYNC_MODE) === ISSUE_UPLOAD_ONLY_MODE
  const scope = normalizeOptionalText(env.VITE_SYNC_SCOPE)
  if (issueUploadOnly) {
    const issueEndpoint = configuredBaseUrl
      ? joinEndpointPath(
          configuredBaseUrl,
          normalizeOptionalText(env.VITE_SYNC_ISSUES_PATH) ??
            DEFAULT_ISSUES_RESOURCE_PATH,
        )
      : issueReportsLegacyEndpoint
    return {
      baseUrl: null,
      bootstrapEndpoint: null,
      statusEndpoint: null,
      readinessEndpoint: null,
      savedPlansEndpoint: null,
      reportsEndpoint: null,
      issueReportsEndpoint: appendScopeParam(issueEndpoint, scope),
    }
  }
  const implicitLocalBaseUrl =
    configuredBaseUrl ||
    savedPlansLegacyEndpoint ||
    reportsLegacyEndpoint ||
    issueReportsLegacyEndpoint
      ? null
      : resolveLocalhostProxyEndpoint(LOCAL_SYNC_PROXY_PATH)
  const baseUrl = configuredBaseUrl ?? implicitLocalBaseUrl

  if (!baseUrl) {
    return {
      baseUrl: null,
      bootstrapEndpoint: null,
      statusEndpoint: null,
      readinessEndpoint: null,
      savedPlansEndpoint: appendScopeParam(savedPlansLegacyEndpoint, scope),
      reportsEndpoint: appendScopeParam(reportsLegacyEndpoint, scope),
      issueReportsEndpoint: appendScopeParam(issueReportsLegacyEndpoint, scope),
    }
  }

  const bootstrapResourcePath =
    normalizeOptionalText(env.VITE_SYNC_BOOTSTRAP_PATH) ??
    DEFAULT_BOOTSTRAP_RESOURCE_PATH
  const statusResourcePath =
    normalizeOptionalText(env.VITE_SYNC_STATUS_PATH) ??
    DEFAULT_STATUS_RESOURCE_PATH
  const readinessResourcePath =
    normalizeOptionalText(env.VITE_SYNC_READINESS_PATH) ??
    DEFAULT_READINESS_RESOURCE_PATH
  const savedPlansResourcePath =
    normalizeOptionalText(env.VITE_SYNC_SAVED_PLANS_PATH) ??
    DEFAULT_SAVED_PLANS_RESOURCE_PATH
  const reportsResourcePath =
    normalizeOptionalText(env.VITE_SYNC_REPORTS_PATH) ??
    DEFAULT_REPORTS_RESOURCE_PATH
  const issuesResourcePath =
    normalizeOptionalText(env.VITE_SYNC_ISSUES_PATH) ??
    DEFAULT_ISSUES_RESOURCE_PATH

  return {
    baseUrl,
    bootstrapEndpoint: appendScopeParam(
      joinEndpointPath(baseUrl, bootstrapResourcePath),
      scope,
    ),
    statusEndpoint: appendScopeParam(
      joinEndpointPath(baseUrl, statusResourcePath),
      scope,
    ),
    readinessEndpoint: appendScopeParam(
      joinEndpointPath(baseUrl, readinessResourcePath),
      scope,
    ),
    savedPlansEndpoint: appendScopeParam(
      joinEndpointPath(baseUrl, savedPlansResourcePath),
      scope,
    ),
    reportsEndpoint: appendScopeParam(
      joinEndpointPath(baseUrl, reportsResourcePath),
      scope,
    ),
    issueReportsEndpoint: appendScopeParam(
      joinEndpointPath(baseUrl, issuesResourcePath),
      scope,
    ),
  }
}
