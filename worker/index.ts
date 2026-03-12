import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { eq, sql } from 'drizzle-orm'
import { projects, rackConfigurations } from './db/schema.ts'
import { D1DatabaseAdapter } from './adapters/db-d1.ts'
import { ClerkAuthAdapter } from './adapters/auth-clerk.ts'
import { KVCacheAdapter } from './adapters/cache-kv.ts'
import { createRoutes, type AppEnv } from './routes.ts'

type CloudflareEnv = {
  Bindings: {
    DB: D1Database
    RATE_LIMIT: KVNamespace
    CLERK_SECRET_KEY: string
    CLERK_PUBLISHABLE_KEY: string
    ADMIN_USER_IDS?: string
  }
}

type CombinedEnv = CloudflareEnv & AppEnv

const app = new Hono<CombinedEnv>().basePath('/api')

// Global error handler
app.onError((err, c) => {
  console.error('[API Error]', err.message, err.stack)
  return c.json({ error: 'Internal server error' }, 500)
})

// Security headers
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com",
      "img-src 'self' data: blob: https://img.clerk.com https://raw.githubusercontent.com",
      "frame-src https://*.clerk.accounts.dev",
      "frame-ancestors 'none'",
    ].join('; '),
  )
})

// CORS
app.use('*', cors({
  origin: ['https://rackifai.com', 'https://www.rackifai.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// --- Adapter middleware: initialize per-request context ---
app.use('*', async (c, next) => {
  // Database
  const dbAdapter = new D1DatabaseAdapter(c.env.DB)
  c.set('db', dbAdapter.getDb())

  // Cache
  const cacheAdapter = new KVCacheAdapter(c.env.RATE_LIMIT)
  c.set('cache', cacheAdapter)

  // Admin user IDs
  const adminIds = (c.env.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  c.set('adminUserIds', adminIds)

  await next()
})

// Auth middleware (Clerk) — needs db from context to resolve users
app.use('*', async (c, next) => {
  const authAdapter = new ClerkAuthAdapter(() => c.get('db'))
  const middleware = authAdapter.middleware()
  await middleware(c, next)
})

// Mount shared routes
const routes = createRoutes()
app.route('/', routes)

// --- Scheduled: purge expired trash ---

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: CloudflareEnv['Bindings']) {
    const dbAdapter = new D1DatabaseAdapter(env.DB)
    const db = dbAdapter.getDb()
    const expired = await db
      .select({ id: projects.id })
      .from(projects)
      .where(sql`${projects.deletedAt} IS NOT NULL AND ${projects.deletedAt} < unixepoch() - 604800`)

    for (const p of expired) {
      await db.delete(rackConfigurations).where(eq(rackConfigurations.projectId, p.id))
      await db.delete(projects).where(eq(projects.id, p.id))
    }
  },
}
