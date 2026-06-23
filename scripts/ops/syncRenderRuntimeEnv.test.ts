import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseRenderRuntimeEnvSyncArgs,
  renderRenderRuntimeEnvSyncResult,
  syncRenderRuntimeEnv,
  writeRenderRuntimeEnvSyncOutputs,
} from './syncRenderRuntimeEnv'

const env = {
  PARKKING_RENDER_SERVICE_ID: 'srv-test',
  RENDER_API_KEY: 'token',
}

describe('syncRenderRuntimeEnv', () => {
  it('parses dry-run defaults from environment', () => {
    expect(parseRenderRuntimeEnvSyncArgs([], env)).toMatchObject({
      serviceId: 'srv-test',
      apiBaseUrl: 'https://api.render.com/v1',
      execute: false,
      deploy: false,
      deployMode: 'build_and_deploy',
      tokenEnv: 'RENDER_API_KEY',
      token: 'token',
    })
  })

  it('plans required runtime env updates without calling Render in dry-run mode', async () => {
    const calls: string[] = []
    const result = await syncRenderRuntimeEnv(
      parseRenderRuntimeEnvSyncArgs(['--service-id', 'srv-test'], env),
      (async (input) => {
        calls.push(String(input))
        return new Response('{}', { status: 200 })
      }) as typeof fetch,
    )

    expect(result.pass).toBe(true)
    expect(result.execute).toBe(false)
    expect(calls).toEqual([])
    expect(result.updates.map((update) => update.key)).toEqual([
      'PARKKING_SYNC_CORS_ORIGINS',
      'PARKKING_GEOCODER_REQUEST_TIMEOUT_MS',
      'PARKKING_ROUTING_REQUEST_TIMEOUT_MS',
    ])
    expect(renderRenderRuntimeEnvSyncResult(result)).toContain(
      'PARKKING_SYNC_CORS_ORIGINS=https://parkking.onrender.com',
    )
  })

  it('resolves a Render service id by service name before planning updates', async () => {
    const calls: Array<{ url: string; method: string | undefined }> = []
    const result = await syncRenderRuntimeEnv(
      parseRenderRuntimeEnvSyncArgs(
        ['--service-name', 'parkking'],
        { RENDER_API_KEY: 'token' },
      ),
      (async (input, init) => {
        calls.push({ url: String(input), method: init?.method })
        return new Response(
          JSON.stringify([{ service: { id: 'srv-parkking', name: 'parkking' } }]),
          { status: 200 },
        )
      }) as typeof fetch,
    )

    expect(result.pass).toBe(true)
    expect(result.serviceId).toBe('srv-parkking')
    expect(result.serviceName).toBe('parkking')
    expect(calls).toEqual([
      {
        url: 'https://api.render.com/v1/services?limit=100',
        method: 'GET',
      },
    ])
    expect(result.updates[0]?.url).toBe(
      'https://api.render.com/v1/services/srv-parkking/env-vars/PARKKING_SYNC_CORS_ORIGINS',
    )
  })

  it('updates required runtime env vars and triggers a deploy when executed', async () => {
    const calls: Array<{
      url: string
      method: string | undefined
      body: string | null | undefined
      auth: string | null
    }> = []
    const result = await syncRenderRuntimeEnv(
      parseRenderRuntimeEnvSyncArgs(
        ['--service-id', 'srv-test', '--execute', '--deploy'],
        env,
      ),
      (async (input, init) => {
        const headers = new Headers(init?.headers)
        calls.push({
          url: String(input),
          method: init?.method,
          body: init?.body as string | null | undefined,
          auth: headers.get('authorization'),
        })
        return new Response('{}', { status: calls.length === 4 ? 202 : 200 })
      }) as typeof fetch,
    )

    expect(result.pass).toBe(true)
    expect(calls).toHaveLength(4)
    expect(calls.slice(0, 3).map((call) => call.method)).toEqual([
      'PUT',
      'PUT',
      'PUT',
    ])
    expect(calls[0]?.url).toBe(
      'https://api.render.com/v1/services/srv-test/env-vars/PARKKING_SYNC_CORS_ORIGINS',
    )
    expect(calls[0]?.body).toBe(
      JSON.stringify({ value: 'https://parkking.onrender.com' }),
    )
    expect(calls.every((call) => call.auth === 'Bearer token')).toBe(true)
    expect(calls[3]).toMatchObject({
      url: 'https://api.render.com/v1/services/srv-test/deploys',
      method: 'POST',
      body: JSON.stringify({ deployMode: 'build_and_deploy' }),
    })
    expect(result.deployResult).toMatchObject({
      pass: true,
      executed: true,
      status: 202,
    })
  })

  it('fails execute mode without a Render token before calling the API', async () => {
    const calls: string[] = []
    const result = await syncRenderRuntimeEnv(
      parseRenderRuntimeEnvSyncArgs(
        ['--service-id', 'srv-test', '--execute', '--deploy'],
        { PARKKING_RENDER_SERVICE_ID: 'srv-test' },
      ),
      (async (input) => {
        calls.push(String(input))
        return new Response('{}', { status: 200 })
      }) as typeof fetch,
    )

    expect(result.pass).toBe(false)
    expect(calls).toEqual([])
    expect(result.errors.join('\n')).toContain('Missing RENDER_API_KEY')
    expect(result.deployResult).toBeNull()
  })

  it('fails service-name resolution without a Render token before calling the API', async () => {
    const calls: string[] = []
    const result = await syncRenderRuntimeEnv(
      parseRenderRuntimeEnvSyncArgs(['--service-name', 'parkking']),
      (async (input) => {
        calls.push(String(input))
        return new Response('[]', { status: 200 })
      }) as typeof fetch,
    )

    expect(result.pass).toBe(false)
    expect(calls).toEqual([])
    expect(result.serviceId).toBeNull()
    expect(result.errors.join('\n')).toContain(
      'Missing RENDER_API_KEY to resolve Render service name parkking',
    )
  })

  it('does not trigger deploy when an env update fails', async () => {
    const calls: string[] = []
    const result = await syncRenderRuntimeEnv(
      parseRenderRuntimeEnvSyncArgs(
        ['--service-id', 'srv-test', '--execute', '--deploy'],
        env,
      ),
      (async (input) => {
        calls.push(String(input))
        return new Response('bad request', {
          status: calls.length === 2 ? 400 : 200,
        })
      }) as typeof fetch,
    )

    expect(result.pass).toBe(false)
    expect(calls).toHaveLength(3)
    expect(calls.some((url) => url.endsWith('/deploys'))).toBe(false)
    expect(result.errors.join('\n')).toContain(
      'PARKKING_GEOCODER_REQUEST_TIMEOUT_MS: bad request',
    )
  })

  it('writes markdown and JSON reports', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-env-sync-'))
    const outPath = path.join(base, 'sync.md')
    const jsonOutPath = path.join(base, 'sync.json')
    const result = await syncRenderRuntimeEnv(
      parseRenderRuntimeEnvSyncArgs(['--service-id', 'srv-test'], env),
    )

    await writeRenderRuntimeEnvSyncOutputs(result, { outPath, jsonOutPath })

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      '# Render Runtime Env Sync: PASS',
    )
    await expect(fs.readFile(jsonOutPath, 'utf-8')).resolves.toContain(
      '"serviceId": "srv-test"',
    )
  })
})
