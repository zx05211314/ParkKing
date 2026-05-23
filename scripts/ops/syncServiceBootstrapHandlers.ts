import { normalizeBootstrapResources } from './syncServiceConfig'
import {
  writeSyncServiceJson,
  writeSyncServiceMethodNotAllowed,
} from './syncServiceHttp'
import type { SyncServiceRequestContext } from './syncServiceRequestTypes'

export const handleSyncBootstrapRequest = async ({
  req,
  res,
  service,
  scope,
  url,
}: SyncServiceRequestContext) => {
  if (req.method !== 'GET') {
    writeSyncServiceMethodNotAllowed(res)
    return true
  }

  const requestedResources = normalizeBootstrapResources(url.searchParams.getAll('include'))
  const bootstrapState = await service.getBootstrapState(scope, requestedResources)
  writeSyncServiceJson(res, 200, bootstrapState)
  return true
}

export const handleSyncStatusRequest = async ({
  req,
  res,
  service,
  scope,
}: SyncServiceRequestContext) => {
  if (req.method !== 'GET') {
    writeSyncServiceMethodNotAllowed(res)
    return true
  }

  writeSyncServiceJson(res, 200, await service.getSyncStatus(scope))
  return true
}
