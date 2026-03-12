import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import path from 'node:path'
import fs from 'node:fs'
import { SQLiteDatabaseAdapter } from './adapters/db-sqlite.ts'
import { LocalAuthAdapter } from './adapters/auth-local.ts'
import { MemoryCacheAdapter } from './adapters/cache-memory.ts'
import { createRoutes, type AppEnv } from '../worker/routes.ts'
import { runMigrations } from './migrate.ts'

// --- Configuration from environment ---

const PORT = parseInt(process.env.PORT || '3000', 10)
const DATABASE_PATH = process.env.DATABASE_PATH || './data/rackifai.db'
const JWT_SECRET = process.env.JWT_SECRET || 'rackifai-dev-secret-change-me'
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === 'true'
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)

// --- Ensure data directory exists ---

const dataDir = path.dirname(DATABASE_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// --- Run migrations ---

console.log(`[rackifai] Running migrations on ${DATABASE_PATH}...`)
runMigrations(DATABASE_PATH)
console.log('[rackifai] Migrations complete.')

// --- Initialize adapters ---

const dbAdapter = new SQLiteDatabaseAdapter(DATABASE_PATH)
const cacheAdapter = new MemoryCacheAdapter()
const authAdapter = new LocalAuthAdapter({
  getDb: () => dbAdapter.getDb(),
  jwtSecret: JWT_SECRET,
  authRequired: AUTH_REQUIRED,
})

// --- Create Hono app ---

const app = new Hono<AppEnv>()

// Global error handler
app.onError((err, c) => {
  console.error('[API Error]', err.message, err.stack)
  return c.json({ error: 'Internal server error' }, 500)
})

// Security headers
app.use('/api/*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
})

// CORS — allow all origins in standalone (self-hosted)
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// Inject adapters into context
app.use('/api/*', async (c, next) => {
  c.set('db', dbAdapter.getDb())
  c.set('cache', cacheAdapter)
  c.set('adminUserIds', ADMIN_USER_IDS)
  await next()
})

// Auth middleware
app.use('/api/*', authAdapter.middleware())

// Mount auth routes (login/register) if in multi-user mode
const authRoutes = authAdapter.getAuthRoutes?.()
if (authRoutes) {
  app.route('/api', authRoutes)
}

// Mount shared API routes
const routes = createRoutes()
app.route('/api', routes)

// --- Serve SPA static files ---

// Serve static files from dist/client/
app.use('/*', serveStatic({ root: './dist/client' }))

// SPA fallback — serve index.html for all non-API, non-static routes
app.get('*', async (c) => {
  const indexPath = path.resolve('./dist/client/index.html')
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf-8')
    return c.html(html)
  }
  return c.text('Not found', 404)
})

// --- Start server ---

console.log(`[rackifai] Starting server on port ${PORT}...`)
console.log(`[rackifai] Auth mode: ${AUTH_REQUIRED ? 'multi-user (login required)' : 'single-user (no auth)'}`)
console.log(`[rackifai] Database: ${DATABASE_PATH}`)

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`[rackifai] Server running at http://localhost:${info.port}`)
})
