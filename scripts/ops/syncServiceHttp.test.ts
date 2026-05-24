import { describe, expect, it } from 'vitest'
import {
  readSyncServiceJsonBody,
  setSyncServiceCorsHeaders,
  SyncServicePayloadTooLargeError,
  writeSyncServiceJson,
  writeSyncServiceMethodNotAllowed,
} from './syncServiceHttp'

const createMockResponse = () => {
  const headers = new Map<string, string>()
  let body = ''

  return {
    body: () => body,
    headers,
    response: {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        headers.set(name, value)
      },
      end: (value?: string) => {
        body = value ?? ''
      },
    },
  }
}

describe('syncServiceHttp', () => {
  it('parses a json body and treats blank payloads as null', async () => {
    async function* body() {
      yield Buffer.from('  {"scope":"alpha"}  ')
    }

    async function* blankBody() {
      yield Buffer.from('   ')
    }

    await expect(
      readSyncServiceJsonBody({
        [Symbol.asyncIterator]: body,
      } as never),
    ).resolves.toEqual({ scope: 'alpha' })
    await expect(
      readSyncServiceJsonBody({
        [Symbol.asyncIterator]: blankBody,
      } as never),
    ).resolves.toBeNull()
  })

  it('writes json responses, method errors, and cors headers', () => {
    const res = createMockResponse()

    setSyncServiceCorsHeaders(res.response as never)
    writeSyncServiceJson(res.response as never, 201, { ok: true })

    expect(res.response.statusCode).toBe(201)
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.body()).toBe(JSON.stringify({ ok: true }))

    writeSyncServiceMethodNotAllowed(res.response as never)
    expect(res.response.statusCode).toBe(405)
    expect(res.body()).toBe(JSON.stringify({ error: 'Method not allowed.' }))
  })

  it('rejects json bodies that exceed the configured byte limit', async () => {
    async function* body() {
      yield Buffer.from('{"value":"too large"}')
    }

    await expect(
      readSyncServiceJsonBody(
        {
          [Symbol.asyncIterator]: body,
        } as never,
        { maxBytes: 10 },
      ),
    ).rejects.toBeInstanceOf(SyncServicePayloadTooLargeError)
  })
})
