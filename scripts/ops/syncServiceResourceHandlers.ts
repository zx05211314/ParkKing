import {
  readSyncServiceJsonBody,
  writeSyncServiceJson,
  writeSyncServiceMethodNotAllowed,
} from './syncServiceHttp'
import type {
  IssueReportsEnvelope,
  ReportsEnvelope,
  SavedPlansEnvelope,
} from './syncServiceTypes'
import type { SyncServiceRequestContext } from './syncServiceRequestTypes'

export const handleSyncSavedPlansRequest = async ({
  req,
  res,
  service,
  scope,
}: SyncServiceRequestContext) => {
  if (req.method === 'GET') {
    const savedPlansState = await service.getSavedPlansState(scope)
    writeSyncServiceJson(res, 200, {
      plans: savedPlansState.plans,
      revision: savedPlansState.revision,
    })
    return true
  }

  if (req.method === 'PUT') {
    const body = (await readSyncServiceJsonBody(req)) as SavedPlansEnvelope | null
    const result = await service.replaceSavedPlans(
      body?.plans,
      scope,
      typeof body?.revision === 'number' ? body.revision : null,
    )
    if (result.conflict) {
      writeSyncServiceJson(res, 409, {
        error: 'Saved plans are out of date.',
        plans: result.plans,
        revision: result.revision,
      })
      return true
    }
    writeSyncServiceJson(res, 200, {
      plans: result.plans,
      revision: result.revision,
    })
    return true
  }

  writeSyncServiceMethodNotAllowed(res)
  return true
}

export const handleSyncReportsRequest = async ({
  req,
  res,
  service,
  scope,
}: SyncServiceRequestContext) => {
  if (req.method === 'GET') {
    const reportsState = await service.getReportsState(scope)
    writeSyncServiceJson(res, 200, {
      reports: reportsState.reports,
      revision: reportsState.revision,
    })
    return true
  }

  if (req.method === 'POST') {
    const body = (await readSyncServiceJsonBody(req)) as ReportsEnvelope | null
    const result = await service.appendReport(body?.report, scope)
    writeSyncServiceJson(res, 201, result)
    return true
  }

  writeSyncServiceMethodNotAllowed(res)
  return true
}

export const handleSyncIssueReportsRequest = async ({
  req,
  res,
  service,
  scope,
}: SyncServiceRequestContext) => {
  if (req.method === 'GET') {
    const issueReportsState = await service.getIssueReportsState(scope)
    writeSyncServiceJson(res, 200, {
      issues: issueReportsState.issues,
      revision: issueReportsState.revision,
    })
    return true
  }

  if (req.method === 'POST') {
    const body = (await readSyncServiceJsonBody(req)) as IssueReportsEnvelope | null
    const result = await service.appendIssueReport(body?.issue, scope)
    writeSyncServiceJson(res, 201, result)
    return true
  }

  writeSyncServiceMethodNotAllowed(res)
  return true
}
