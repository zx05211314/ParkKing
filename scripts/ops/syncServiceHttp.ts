import type { IncomingMessage, ServerResponse } from 'node:http'

export const readSyncServiceJsonBody = async (
  req: IncomingMessage,
): Promise<unknown> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
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
