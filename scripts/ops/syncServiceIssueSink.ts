import { createHash } from 'node:crypto'
import {
  DEFAULT_SYNC_DURABILITY,
  DEFAULT_SYNC_ISSUE_SINK_TIMEOUT_MS,
  normalizeScope,
  normalizeSyncText,
} from './syncServiceConfig'
import type {
  SyncIssueSinkReceipt,
  SyncServiceConfig,
} from './syncServiceTypes'

type FetchImpl = typeof fetch

export class SyncIssueSinkDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncIssueSinkDeliveryError'
  }
}

const resolveIssueSinkUrl = (value?: string | null) => {
  const normalized = normalizeSyncText(value)
  if (!normalized) {
    return null
  }
  const url = new URL(normalized)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Issue sink URL must use http or https.')
  }
  if (url.username || url.password) {
    throw new Error('Issue sink URL must not include credentials.')
  }
  return url.toString()
}

const buildIdempotencyKey = (scope: string, issue: unknown) =>
  `parkking-${createHash('sha256')
    .update(JSON.stringify({ scope, issue }))
    .digest('hex')}`

const readIssueSinkError = async (response: Response) => {
  const body = await response.text().catch(() => '')
  return body.trim().slice(0, 300) || `HTTP ${response.status}`
}

export const validateSyncIssueSinkConfig = (config: SyncServiceConfig) => {
  if (!normalizeSyncText(config.issueSinkUrl)) {
    return null
  }
  try {
    resolveIssueSinkUrl(config.issueSinkUrl)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export const createSyncIssueSink = (
  config: SyncServiceConfig,
  fetchImpl: FetchImpl = fetch,
) => {
  const issueSinkConfigError = validateSyncIssueSinkConfig(config)
  const issueSinkUrl = issueSinkConfigError
    ? null
    : resolveIssueSinkUrl(config.issueSinkUrl)
  const timeoutMs =
    config.issueSinkTimeoutMs ?? DEFAULT_SYNC_ISSUE_SINK_TIMEOUT_MS

  return async (
    issue: unknown,
    scope?: string | null,
  ): Promise<SyncIssueSinkReceipt> => {
    if (issueSinkConfigError) {
      throw new SyncIssueSinkDeliveryError(issueSinkConfigError)
    }
    if (!issueSinkUrl) {
      const durability = config.durability ?? DEFAULT_SYNC_DURABILITY
      return {
        configured: false,
        delivered: false,
        durability,
      }
    }

    const normalizedScope = normalizeScope(scope, config.defaultScope)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(issueSinkUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': buildIdempotencyKey(normalizedScope, issue),
          ...(config.issueSinkBearerToken
            ? { Authorization: `Bearer ${config.issueSinkBearerToken}` }
            : {}),
        },
        body: JSON.stringify({
          schemaVersion: 1,
          source: 'parkking-sync',
          scope: normalizedScope,
          receivedAt: new Date().toISOString(),
          issue,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new SyncIssueSinkDeliveryError(
          `Issue sink rejected the report: ${await readIssueSinkError(response)}`,
        )
      }
      return {
        configured: true,
        delivered: true,
        durability: 'external',
      }
    } catch (error) {
      if (error instanceof SyncIssueSinkDeliveryError) {
        throw error
      }
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? `timed out after ${timeoutMs} ms`
          : error instanceof Error
            ? error.message
            : String(error)
      throw new SyncIssueSinkDeliveryError(
        `Issue sink delivery failed: ${reason}`,
      )
    } finally {
      clearTimeout(timeout)
    }
  }
}
