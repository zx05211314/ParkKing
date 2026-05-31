import {
  readSetting,
  STORAGE_KEYS,
  writeSetting,
} from '../settings'
import {
  DEFAULT_SAVED_PLAN_LIMIT,
  mergeSavedPlansWithConflicts,
  normalizeSavedPlans,
  type SavedPlanConflictDetail,
  type SavedPlan,
} from '../ui/savedPlans'
import {
  fetchJson,
  type ViteEnvLike,
} from './client'
import { setSyncRuntimeResourceStatus } from './syncRuntimeStatus'
import { resolveParkKingSyncServiceConfig } from './syncContract'

interface SavedPlansEnvelope {
  plans?: unknown
  revision?: unknown
  savedPlansRevision?: unknown
}

interface ParsedSavedPlansPayload {
  valid: boolean
  plans: SavedPlan[]
}

const savedPlansRevisionByEndpoint = new Map<string, number>()

export interface SavedPlansPersistenceConfig {
  endpoint: string | null
}

interface LoadSavedPlansOptions {
  config?: SavedPlansPersistenceConfig
  fetchImpl?: typeof fetch
  limit?: number
}

interface SaveSavedPlansOptions {
  config?: SavedPlansPersistenceConfig
  fetchImpl?: typeof fetch
}

export interface SaveSavedPlansResult {
  plans: SavedPlan[]
  conflictedUrls: string[]
  conflictDetails: SavedPlanConflictDetail[]
  remoteSynced: boolean
}

const getSyncFailureReason = (error: unknown) =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message.trim()
    : 'Remote sync is unavailable.'

const readLocalSavedPlans = (limit = DEFAULT_SAVED_PLAN_LIMIT) =>
  normalizeSavedPlans(readSetting<unknown>(STORAGE_KEYS.savedPlans, []), limit)

export const writeLocalSavedPlans = (plans: SavedPlan[]) => {
  writeSetting(STORAGE_KEYS.savedPlans, plans)
}

const normalizeRevision = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.floor(value)
}

export const readSavedPlansRevision = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const envelope = payload as SavedPlansEnvelope
  return (
    normalizeRevision(envelope.revision) ??
    normalizeRevision(envelope.savedPlansRevision)
  )
}

export const getSavedPlansRevision = (endpoint: string | null) =>
  endpoint ? savedPlansRevisionByEndpoint.get(endpoint) ?? null : null

export const setSavedPlansRevision = (
  endpoint: string | null,
  revision: number | null,
) => {
  if (!endpoint || revision === null) {
    return
  }
  savedPlansRevisionByEndpoint.set(endpoint, revision)
}

export const parseRemoteSavedPlansPayload = (
  payload: unknown,
  limit = DEFAULT_SAVED_PLAN_LIMIT,
) : ParsedSavedPlansPayload => {
  if (Array.isArray(payload)) {
    return {
      valid: true,
      plans: normalizeSavedPlans(payload, limit),
    }
  }
  if (payload && typeof payload === 'object') {
    const envelope = payload as SavedPlansEnvelope
    if ('plans' in envelope) {
      return {
        valid: true,
        plans: normalizeSavedPlans(envelope.plans, limit),
      }
    }
  }
  return {
    valid: false,
    plans: [],
  }
}

export const resolveSavedPlansPersistenceConfig = (
  env?: ViteEnvLike,
): SavedPlansPersistenceConfig => ({
  endpoint: resolveParkKingSyncServiceConfig(env).savedPlansEndpoint,
})

export const loadSavedPlans = async ({
  config = resolveSavedPlansPersistenceConfig(),
  fetchImpl = fetch,
  limit = DEFAULT_SAVED_PLAN_LIMIT,
}: LoadSavedPlansOptions = {}): Promise<SavedPlan[]> => {
  const localPlans = readLocalSavedPlans(limit)
  if (!config.endpoint) {
    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'local-only',
      message: 'Saved plans are stored locally only.',
      pendingCount: 0,
    })
    return localPlans
  }

  setSyncRuntimeResourceStatus('savedPlans', {
    mode: 'syncing',
    message: 'Saved plans are waiting for remote confirmation.',
  })

  try {
    const { response, payload } = await fetchJson(config.endpoint, {
      fetchImpl,
    })
    if (!response.ok) {
      throw new Error(`Saved-plan request failed with ${response.status}.`)
    }

    const parsedPayload = parseRemoteSavedPlansPayload(payload, limit)
    if (!parsedPayload.valid) {
      throw new Error('Saved-plan response did not include a plans array.')
    }

    const remotePlans = parsedPayload.plans
    setSavedPlansRevision(config.endpoint, readSavedPlansRevision(payload))
    writeLocalSavedPlans(remotePlans)
    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'remote',
      message: 'Saved plans are synced with ParkKing Sync.',
      pendingCount: 0,
      lastRemoteCount: remotePlans.length,
      remoteEvent: 'pull',
    })
    return remotePlans
  } catch (error) {
    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'fallback-local',
      message: 'Saved plans are using local fallback because remote sync is unavailable.',
      failureReason: getSyncFailureReason(error),
    })
    return localPlans
  }
}

export const saveSavedPlans = async (
  plans: SavedPlan[],
  {
    config = resolveSavedPlansPersistenceConfig(),
    fetchImpl = fetch,
  }: SaveSavedPlansOptions = {},
): Promise<SaveSavedPlansResult> => {
  const normalizedPlans = normalizeSavedPlans(plans)
  writeLocalSavedPlans(normalizedPlans)
  if (!config.endpoint) {
    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'local-only',
      message: 'Saved plans are stored locally only.',
      pendingCount: 0,
    })
    return {
      plans: normalizedPlans,
      conflictedUrls: [],
      conflictDetails: [],
      remoteSynced: false,
    }
  }

  setSyncRuntimeResourceStatus('savedPlans', {
    mode: 'syncing',
    message: 'Saved plans are waiting for remote confirmation.',
    pendingCount: normalizedPlans.length,
  })

  const syncOnce = async (
    nextPlans: SavedPlan[],
    revision: number | null,
  ) => {
    const { response, payload } = await fetchJson(config.endpoint!, {
      fetchImpl,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plans: nextPlans,
        ...(revision !== null ? { revision } : {}),
      }),
    })

    return {
      response,
      payload,
      revision: readSavedPlansRevision(payload),
      parsedPayload: parseRemoteSavedPlansPayload(payload),
    }
  }

  try {
    const firstAttempt = await syncOnce(
      normalizedPlans,
      getSavedPlansRevision(config.endpoint),
    )

    if (firstAttempt.response.ok) {
      setSavedPlansRevision(config.endpoint, firstAttempt.revision)
      setSyncRuntimeResourceStatus('savedPlans', {
        mode: 'remote',
        message: 'Saved plans are synced with ParkKing Sync.',
        pendingCount: 0,
        lastRemoteCount: normalizedPlans.length,
        remoteEvent: 'push',
      })
      return {
        plans: normalizedPlans,
        conflictedUrls: [],
        conflictDetails: [],
        remoteSynced: true,
      }
    }

    if (firstAttempt.response.status === 409 && firstAttempt.parsedPayload.valid) {
      const mergedResult = mergeSavedPlansWithConflicts(
        normalizedPlans,
        firstAttempt.parsedPayload.plans,
      )
      writeLocalSavedPlans(mergedResult.plans)

      const retryAttempt = await syncOnce(
        mergedResult.plans,
        firstAttempt.revision,
      )
      if (retryAttempt.response.ok) {
        setSavedPlansRevision(config.endpoint, retryAttempt.revision)
        setSyncRuntimeResourceStatus('savedPlans', {
          mode: 'remote',
          message: 'Saved plans were merged and synced with ParkKing Sync.',
          pendingCount: 0,
          lastRemoteCount: mergedResult.plans.length,
          remoteEvent: 'push',
        })
        return {
          plans: mergedResult.plans,
          conflictedUrls: mergedResult.conflictedUrls,
          conflictDetails: mergedResult.conflictDetails,
          remoteSynced: true,
        }
      }

      setSyncRuntimeResourceStatus('savedPlans', {
        mode: 'fallback-local',
        message: 'Saved plans were merged locally, but remote sync is still unavailable.',
        failureReason: `Retry sync failed with ${retryAttempt.response.status}.`,
        pendingCount: mergedResult.plans.length,
      })
      return {
        plans: mergedResult.plans,
        conflictedUrls: mergedResult.conflictedUrls,
        conflictDetails: mergedResult.conflictDetails,
        remoteSynced: false,
      }
    }
  } catch (error) {
    // Keep the local cache as the durability fallback when remote sync is unavailable.
    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'fallback-local',
      message: 'Saved plans are using local fallback because remote sync is unavailable.',
      failureReason: getSyncFailureReason(error),
      pendingCount: normalizedPlans.length,
    })
    return {
      plans: normalizedPlans,
      conflictedUrls: [],
      conflictDetails: [],
      remoteSynced: false,
    }
  }

  setSyncRuntimeResourceStatus('savedPlans', {
    mode: 'fallback-local',
    message: 'Saved plans are using local fallback because remote sync is unavailable.',
    failureReason: 'Remote sync rejected the saved-plan write.',
    pendingCount: normalizedPlans.length,
  })
  return {
    plans: normalizedPlans,
    conflictedUrls: [],
    conflictDetails: [],
    remoteSynced: false,
  }
}

export const resetSavedPlansPersistenceStateForTests = () => {
  savedPlansRevisionByEndpoint.clear()
}
