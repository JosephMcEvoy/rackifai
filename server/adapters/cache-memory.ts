import type { CacheAdapter } from '../../worker/adapters/types.ts'

interface CacheEntry {
  value: string
  expiresAt: number
}

/** In-process memory cache with TTL expiry. Suitable for single-instance standalone. */
export class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, CacheEntry>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Lazy cleanup every 60 seconds
    this.cleanupInterval = setInterval(() => this.evictExpired(), 60_000)
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  private evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }

  /** Stop the cleanup interval (for graceful shutdown). */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}
