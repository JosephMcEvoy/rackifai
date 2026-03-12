import type { CacheAdapter } from './types.ts'

/** Cloudflare KV-backed cache adapter. */
export class KVCacheAdapter implements CacheAdapter {
  private kv: KVNamespace

  constructor(kv: KVNamespace) {
    this.kv = kv
  }

  async get(key: string): Promise<string | null> {
    return this.kv.get(key)
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.kv.put(key, value, { expirationTtl: ttlSeconds })
  }
}
