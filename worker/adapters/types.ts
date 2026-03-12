import type { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono/types'

/**
 * Drizzle database instance — works with both D1 and better-sqlite3 drivers.
 *
 * We use a structural type here rather than importing driver-specific types so
 * the shared routes compile under both the worker and server tsconfigs.
 * All query-level type safety comes from the Drizzle schema, not the driver type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrizzleDatabase = any

/** Resolved identity from the auth layer. */
export interface AuthResult {
  userId: string           // local DB user.id (UUID)
  email: string
  externalId: string | null  // Clerk ID or null for local/no-auth
}

/** Database adapter — provides a Drizzle instance. */
export interface DatabaseAdapter {
  getDb(): DrizzleDatabase
}

/**
 * Auth adapter — middleware that resolves requests to a user identity.
 *
 * `middleware()` sets `authResult` on the Hono context via `c.set('authResult', ...)`.
 * `getAuthRoutes()` optionally returns a sub-app with login/register routes (standalone only).
 */
export interface AuthAdapter {
  middleware(): MiddlewareHandler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAuthRoutes?(): Hono<any>
}

/** Simple key-value cache for rate limiting and ephemeral data. */
export interface CacheAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
}

/**
 * Combined adapters passed to route factories.
 * Routes access these via Hono context variables set by middleware.
 */
export interface Adapters {
  db: DatabaseAdapter
  auth: AuthAdapter
  cache: CacheAdapter
}
