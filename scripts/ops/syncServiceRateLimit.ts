export interface SyncServiceWriteRateLimitOptions {
  windowMs: number
  maxRequests: number
  nowMs?: () => number
}

export interface SyncServiceWriteRateLimitRequest {
  clientId: string
  route: string
  scope: string
}

export interface SyncServiceWriteRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  resetAtMs: number
}

interface SyncServiceWriteRateLimitBucket {
  windowStartMs: number
  count: number
}

const buildWriteRateLimitKey = ({
  clientId,
  route,
  scope,
}: SyncServiceWriteRateLimitRequest) => `${clientId}::${route}::${scope}`

export const createSyncServiceWriteRateLimiter = ({
  windowMs,
  maxRequests,
  nowMs = Date.now,
}: SyncServiceWriteRateLimitOptions) => {
  const buckets = new Map<string, SyncServiceWriteRateLimitBucket>()

  return {
    check(request: SyncServiceWriteRateLimitRequest): SyncServiceWriteRateLimitResult {
      const key = buildWriteRateLimitKey(request)
      const now = nowMs()
      const existing = buckets.get(key)
      const bucket =
        existing && now - existing.windowStartMs < windowMs
          ? existing
          : { windowStartMs: now, count: 0 }

      if (bucket.count >= maxRequests) {
        buckets.set(key, bucket)
        const resetAtMs = bucket.windowStartMs + windowMs
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
          resetAtMs,
        }
      }

      bucket.count += 1
      buckets.set(key, bucket)
      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - bucket.count),
        retryAfterSeconds: 0,
        resetAtMs: bucket.windowStartMs + windowMs,
      }
    },
  }
}
