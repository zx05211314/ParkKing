import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DatasetFetchError,
  fetchDatasetResource,
} from './fetchDatasetResource.browser'

const readJson = (response: Response) =>
  response.json() as Promise<{ ok: boolean }>

describe('fetchDatasetResource', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns a successful response without retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchDatasetResource('/data.json', {
        read: readJson,
        retryDelaysMs: [0, 0],
      }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a transient HTTP failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchDatasetResource('/data.json', {
        read: readJson,
        retryDelaysMs: [0],
      }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchDatasetResource('/data.json', {
        read: readJson,
        retryDelaysMs: [0],
      }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a permanent HTTP failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchDatasetResource('/missing.json', {
        read: readJson,
        retryDelaysMs: [0, 0],
      }),
    ).rejects.toMatchObject({
      name: 'DatasetFetchError',
      status: 404,
      attempts: 1,
      retryable: false,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports the final attempt when transient failures are exhausted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchDatasetResource('/unavailable.json', {
        read: readJson,
        retryDelaysMs: [0, 0],
      }),
    ).rejects.toMatchObject({
      name: 'DatasetFetchError',
      status: 503,
      attempts: 3,
      maxAttempts: 3,
      retryable: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('aborts and reports a timed-out request', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = fetchDatasetResource('/slow.json', {
      read: readJson,
      timeoutMs: 10,
      retryDelaysMs: [],
    })
    const assertion = expect(request).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof DatasetFetchError &&
        error.message.includes('timed out after 10ms'),
    )
    await vi.advanceTimersByTimeAsync(10)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
