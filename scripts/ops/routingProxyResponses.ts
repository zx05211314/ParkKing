import type { ServerResponse } from 'node:http'

export const writeRoutingProxyJson = (
  res: ServerResponse,
  statusCode: number,
  body: unknown,
) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export const setRoutingProxyCorsHeaders = (res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

export const getRoutingProxyErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Routing proxy request failed.'
