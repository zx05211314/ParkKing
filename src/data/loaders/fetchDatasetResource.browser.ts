const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

export const DEFAULT_DATASET_FETCH_TIMEOUT_MS = 12_000
export const DEFAULT_DATASET_FETCH_RETRY_DELAYS_MS = [250, 750, 2_000] as const

interface DatasetFetchErrorOptions {
  url: string
  attempt: number
  maxAttempts: number
  status: number | null
  retryable: boolean
  reason: string
}

export class DatasetFetchError extends Error {
  readonly url: string
  readonly attempts: number
  readonly maxAttempts: number
  readonly status: number | null
  readonly retryable: boolean

  constructor({
    url,
    attempt,
    maxAttempts,
    status,
    retryable,
    reason,
  }: DatasetFetchErrorOptions) {
    super(
      `Failed to load ${url} (attempt ${attempt}/${maxAttempts}): ${reason}`,
    )
    this.name = 'DatasetFetchError'
    this.url = url
    this.attempts = attempt
    this.maxAttempts = maxAttempts
    this.status = status
    this.retryable = retryable
  }
}

interface FetchDatasetResourceOptions<T> {
  read: (response: Response) => Promise<T> | T
  init?: RequestInit
  allowHttpError?: boolean
  timeoutMs?: number
  retryDelaysMs?: readonly number[]
}

const errorReason = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const abortedReason = (signal: AbortSignal) =>
  signal.reason instanceof Error
    ? signal.reason
    : new Error('Dataset request aborted')

const waitForRetry = (
  delayMs: number,
  signal: AbortSignal | null,
): Promise<void> => {
  if (signal?.aborted) {
    return Promise.reject(abortedReason(signal))
  }
  if (delayMs <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    const onAbort = () => {
      globalThis.clearTimeout(timeout)
      reject(signal ? abortedReason(signal) : new Error('Dataset request aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export const fetchDatasetResource = async <T>(
  url: string,
  {
    read,
    init = {},
    allowHttpError = false,
    timeoutMs = DEFAULT_DATASET_FETCH_TIMEOUT_MS,
    retryDelaysMs = DEFAULT_DATASET_FETCH_RETRY_DELAYS_MS,
  }: FetchDatasetResourceOptions<T>,
): Promise<T> => {
  const maxAttempts = retryDelaysMs.length + 1
  const externalSignal = init.signal ?? null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (externalSignal?.aborted) {
      throw abortedReason(externalSignal)
    }

    const controller = new AbortController()
    let timedOut = false
    let responseReceived = false
    let responseStatus: number | null = null
    let failure: DatasetFetchError | null = null
    const forwardAbort = () => controller.abort(externalSignal?.reason)
    externalSignal?.addEventListener('abort', forwardAbort, { once: true })
    const timeout = globalThis.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })
      responseReceived = true
      responseStatus = response.status

      if (!response.ok) {
        const retryable = RETRYABLE_HTTP_STATUSES.has(response.status)
        if (retryable || !allowHttpError) {
          await response.body?.cancel().catch(() => undefined)
          failure = new DatasetFetchError({
            url,
            attempt,
            maxAttempts,
            status: response.status,
            retryable,
            reason: `HTTP ${response.status}`,
          })
        } else {
          return await read(response)
        }
      } else {
        return await read(response)
      }
    } catch (error) {
      if (externalSignal?.aborted) {
        throw abortedReason(externalSignal)
      }

      const retryable =
        timedOut || !responseReceived || error instanceof TypeError
      failure = new DatasetFetchError({
        url,
        attempt,
        maxAttempts,
        status: responseStatus,
        retryable,
        reason: timedOut
          ? `timed out after ${timeoutMs}ms`
          : errorReason(error),
      })
    } finally {
      globalThis.clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', forwardAbort)
    }

    if (!failure || !failure.retryable || attempt === maxAttempts) {
      throw failure ?? new Error(`Failed to load ${url}`)
    }

    await waitForRetry(retryDelaysMs[attempt - 1] ?? 0, externalSignal)
  }

  throw new Error(`Failed to load ${url}`)
}
