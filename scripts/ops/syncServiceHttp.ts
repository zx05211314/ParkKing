import type { IncomingMessage, ServerResponse } from 'node:http'
import { DEFAULT_SYNC_MAX_BODY_BYTES } from './syncServiceConfig'

export class SyncServicePayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Sync service JSON body exceeds ${maxBytes} bytes.`)
    this.name = 'SyncServicePayloadTooLargeError'
  }
}

export const readSyncServiceJsonBody = async (
  req: IncomingMessage,
  options: { maxBytes?: number } = {},
): Promise<unknown> => {
  const chunks: Uint8Array[] = []
  const maxBytes = options.maxBytes ?? DEFAULT_SYNC_MAX_BODY_BYTES
  let totalBytes = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)
    totalBytes += buffer.byteLength
    if (totalBytes > maxBytes) {
      throw new SyncServicePayloadTooLargeError(maxBytes)
    }
    chunks.push(buffer)
  }

  if (chunks.length === 0) {
    return null
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) {
    return null
  }
  return JSON.parse(raw)
}

export const writeSyncServiceJson = (
  res: ServerResponse,
  statusCode: number,
  body: unknown,
) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export const writeSyncServiceMethodNotAllowed = (res: ServerResponse) => {
  writeSyncServiceJson(res, 405, { error: 'Method not allowed.' })
}

export const setSyncServiceCorsHeaders = (res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}
