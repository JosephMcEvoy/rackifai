import { Hono } from 'hono'
import { eq, sql, desc, and } from 'drizzle-orm'
import { projects, rackConfigurations, deviceCatalog, users, feedback } from './db/schema.ts'
import type { DrizzleDatabase, AuthResult, CacheAdapter } from './adapters/types.ts'

/**
 * Hono env type for the shared routes.
 * Adapters populate these context variables via middleware.
 */
export type AppEnv = {
  Variables: {
    db: DrizzleDatabase
    cache: CacheAdapter
    authResult: AuthResult | null
    /** Clerk externalId — used only for admin checks in Cloudflare mode */
    adminUserIds?: string[]
  }
}

// --- Rate limiting helper ---

async function checkRateLimit(
  cache: CacheAdapter,
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSec)
  const cacheKey = `rl:${key}:${window}`
  const count = parseInt((await cache.get(cacheKey)) || '0')
  if (count >= limit) return false
  await cache.set(cacheKey, String(count + 1), windowSec * 2)
  return true
}

// --- Validation helpers ---

const MAX_NAME_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_CONFIG_JSON_BYTES = 512 * 1024 // 512 KB

function validateProjectInput(body: { name?: string; description?: string; configJson?: unknown }): string | null {
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) return 'Name is required'
    if (body.name.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer`
  }
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') return 'Description must be a string'
    if (body.description.length > MAX_DESCRIPTION_LENGTH) return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`
  }
  if (body.configJson !== undefined && body.configJson !== null) {
    if (typeof body.configJson !== 'object') return 'configJson must be an object'
    const size = new TextEncoder().encode(JSON.stringify(body.configJson)).length
    if (size > MAX_CONFIG_JSON_BYTES) return `configJson must be under ${MAX_CONFIG_JSON_BYTES / 1024} KB`
  }
  return null
}

// --- Convenience to read typed context values ---

function getDb(c: { get: (key: 'db') => DrizzleDatabase }): DrizzleDatabase {
  return c.get('db')
}

function getAuth(c: { get: (key: 'authResult') => AuthResult | null }): AuthResult | null {
  return c.get('authResult')
}

function getCache(c: { get: (key: 'cache') => CacheAdapter }): CacheAdapter {
  return c.get('cache')
}

/**
 * Creates all API routes.
 * The returned Hono instance expects `db`, `cache`, and `authResult`
 * to be set on the context by upstream middleware.
 */
export function createRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  // --- Health ---

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.get('/health/db', async (c) => {
    const db = getDb(c)
    await db.all(sql`SELECT 1`)
    return c.json({ status: 'ok' })
  })

  // --- Auth ---

  app.get('/auth/me', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Not authenticated' }, 401)
    }

    const db = getDb(c)
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .get()

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json(user)
  })

  // --- Projects CRUD ---

  app.get('/projects', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(and(eq(projects.userId, auth.userId), sql`${projects.deletedAt} IS NULL`))
      .orderBy(desc(projects.updatedAt))

    return c.json(result)
  })

  // --- Project Trash ---

  app.get('/projects/trash', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        deletedAt: projects.deletedAt,
      })
      .from(projects)
      .where(and(eq(projects.userId, auth.userId), sql`${projects.deletedAt} IS NOT NULL`))
      .orderBy(desc(projects.deletedAt))

    return c.json(result)
  })

  app.post('/projects/:id/restore', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const projectId = c.req.param('id')

    const existing = await db
      .select({ id: projects.id, userId: projects.userId })
      .from(projects)
      .where(and(eq(projects.id, projectId), sql`${projects.deletedAt} IS NOT NULL`))
      .get()

    if (!existing) {
      return c.json({ error: 'Trashed project not found' }, 404)
    }

    if (existing.userId !== auth.userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await db
      .update(projects)
      .set({ deletedAt: null })
      .where(eq(projects.id, projectId))

    return c.json({ ok: true })
  })

  app.delete('/projects/:id/permanent', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const projectId = c.req.param('id')

    const existing = await db
      .select({ id: projects.id, userId: projects.userId })
      .from(projects)
      .where(and(eq(projects.id, projectId), sql`${projects.deletedAt} IS NOT NULL`))
      .get()

    if (!existing) {
      return c.json({ error: 'Trashed project not found' }, 404)
    }

    if (existing.userId !== auth.userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await db.delete(rackConfigurations).where(eq(rackConfigurations.projectId, projectId))
    await db.delete(projects).where(eq(projects.id, projectId))

    return c.json({ ok: true })
  })

  app.get('/projects/:id', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const projectId = c.req.param('id')

    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), sql`${projects.deletedAt} IS NULL`))
      .get()

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    if (project.userId !== auth.userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const configs = await db
      .select()
      .from(rackConfigurations)
      .where(eq(rackConfigurations.projectId, projectId))

    return c.json({ ...project, rackConfigurations: configs })
  })

  app.post('/projects', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const body = await c.req.json<{
      name: string
      description?: string
      configJson?: unknown
    }>()

    const validationError = validateProjectInput(body)
    if (validationError) return c.json({ error: validationError }, 400)

    if (!body.name) {
      return c.json({ error: 'Name is required' }, 400)
    }

    const project = await db
      .insert(projects)
      .values({
        name: body.name,
        description: body.description ?? null,
        userId: auth.userId,
      })
      .returning()
      .get()

    if (body.configJson) {
      await db.insert(rackConfigurations).values({
        projectId: project.id,
        name: 'Default',
        configJson: body.configJson as Record<string, unknown>,
      })
    }

    return c.json(project, 201)
  })

  app.put('/projects/:id', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const projectId = c.req.param('id')
    const body = await c.req.json<{
      name?: string
      description?: string
      configJson?: unknown
    }>()

    const existing = await db
      .select({ id: projects.id, userId: projects.userId })
      .from(projects)
      .where(and(eq(projects.id, projectId), sql`${projects.deletedAt} IS NULL`))
      .get()

    if (!existing) {
      return c.json({ error: 'Project not found' }, 404)
    }

    if (existing.userId !== auth.userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const validationError = validateProjectInput(body)
    if (validationError) return c.json({ error: validationError }, 400)

    const updates: Record<string, unknown> = {
      updatedAt: sql`(unixepoch())`,
    }
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description

    await db.update(projects).set(updates).where(eq(projects.id, projectId))

    if (body.configJson !== undefined) {
      const existingConfig = await db
        .select({ id: rackConfigurations.id })
        .from(rackConfigurations)
        .where(eq(rackConfigurations.projectId, projectId))
        .get()

      if (existingConfig) {
        await db
          .update(rackConfigurations)
          .set({
            configJson: body.configJson as Record<string, unknown>,
            updatedAt: sql`(unixepoch())`,
          })
          .where(eq(rackConfigurations.id, existingConfig.id))
      } else {
        await db.insert(rackConfigurations).values({
          projectId,
          name: 'Default',
          configJson: body.configJson as Record<string, unknown>,
        })
      }
    }

    return c.json({ ok: true })
  })

  app.delete('/projects/:id', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const projectId = c.req.param('id')

    const existing = await db
      .select({ id: projects.id, userId: projects.userId })
      .from(projects)
      .where(and(eq(projects.id, projectId), sql`${projects.deletedAt} IS NULL`))
      .get()

    if (!existing) {
      return c.json({ error: 'Project not found' }, 404)
    }

    if (existing.userId !== auth.userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await db
      .update(projects)
      .set({ deletedAt: sql`(unixepoch())` })
      .where(eq(projects.id, projectId))

    return c.json({ ok: true })
  })

  app.post('/projects/:id/claim', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Not authenticated' }, 401)
    }

    const db = getDb(c)
    const projectId = c.req.param('id')

    const result = await db
      .update(projects)
      .set({ userId: auth.userId })
      .where(
        and(
          eq(projects.id, projectId),
          sql`${projects.userId} IS NULL`,
          sql`${projects.createdAt} > unixepoch() - 3600`,
        ),
      )
      .returning({ id: projects.id })
      .get()

    if (!result) {
      return c.json({ error: 'Project not found, already owned, or claim window expired' }, 404)
    }

    return c.json({ ok: true })
  })

  // --- Share ---

  app.post('/projects/:id/share', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const projectId = c.req.param('id')

    const project = await db
      .select({ id: projects.id, userId: projects.userId, shareToken: projects.shareToken })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, auth.userId)))
      .get()

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    const token = project.shareToken ?? crypto.randomUUID().replace(/-/g, '')

    if (!project.shareToken) {
      await db
        .update(projects)
        .set({ shareToken: token })
        .where(eq(projects.id, projectId))
    }

    return c.json({ token })
  })

  app.delete('/projects/:id/share', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = getDb(c)
    const projectId = c.req.param('id')

    await db
      .update(projects)
      .set({ shareToken: null })
      .where(and(eq(projects.id, projectId), eq(projects.userId, auth.userId)))

    return c.json({ ok: true })
  })

  app.get('/share/:token', async (c) => {
    const cache = getCache(c)
    // Rate limit: 10 requests per IP per minute
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'
    const allowed = await checkRateLimit(cache, `share:${ip}`, 10, 60)
    if (!allowed) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    const db = getDb(c)
    const token = c.req.param('token')

    const project = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
      })
      .from(projects)
      .where(and(eq(projects.shareToken, token), sql`${projects.deletedAt} IS NULL`))
      .get()

    if (!project) {
      return c.json({ error: 'Shared project not found' }, 404)
    }

    const configs = await db
      .select()
      .from(rackConfigurations)
      .where(eq(rackConfigurations.projectId, project.id))

    return c.json({
      ...project,
      rackConfigurations: configs,
      readOnly: true,
    })
  })

  // --- Device Catalog ---

  app.get('/catalog', async (c) => {
    const db = getDb(c)
    const q = c.req.query('q')
    const category = c.req.query('category')
    const manufacturer = c.req.query('manufacturer')
    const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '50') || 50), 200)
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0') || 0)

    const conditions = []
    if (q) {
      conditions.push(
        sql`(${deviceCatalog.model} LIKE ${'%' + q + '%'} OR ${deviceCatalog.manufacturer} LIKE ${'%' + q + '%'})`,
      )
    }
    if (category) {
      conditions.push(eq(deviceCatalog.category, category))
    }
    if (manufacturer) {
      conditions.push(eq(deviceCatalog.manufacturer, manufacturer))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const results = await db
      .select()
      .from(deviceCatalog)
      .where(where)
      .orderBy(deviceCatalog.manufacturer, deviceCatalog.model)
      .limit(limit)
      .offset(offset)

    return c.json(results)
  })

  // --- Events (analytics beacon) ---

  app.post('/events', async (c) => {
    return c.json({ ok: true })
  })

  // --- Feedback ---

  app.post('/feedback', async (c) => {
    const cache = getCache(c)
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'
    const allowed = await checkRateLimit(cache, `feedback:${ip}`, 5, 300)
    if (!allowed) {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    const db = getDb(c)
    const body = await c.req.json<{ message: string; email?: string }>()

    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return c.json({ error: 'Message is required' }, 400)
    }

    if (body.message.length > 2000) {
      return c.json({ error: 'Message must be 2000 characters or fewer' }, 400)
    }

    const email = body.email?.trim() || null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400)
    }

    const entry = await db
      .insert(feedback)
      .values({
        message: body.message.trim(),
        email,
      })
      .returning()
      .get()

    return c.json(entry, 201)
  })

  app.get('/feedback', async (c) => {
    const auth = getAuth(c)
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    // Admin check: use externalId (Clerk) or userId for admin list
    const adminIds = c.get('adminUserIds') ?? []
    const isAdmin = adminIds.includes(auth.externalId ?? '') || adminIds.includes(auth.userId)
    if (!isAdmin) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const db = getDb(c)
    const feedbackLimit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '100') || 100), 500)
    const feedbackOffset = Math.max(0, parseInt(c.req.query('offset') || '0') || 0)

    const results = await db
      .select()
      .from(feedback)
      .orderBy(desc(feedback.createdAt))
      .limit(feedbackLimit)
      .offset(feedbackOffset)

    return c.json(results)
  })

  return app
}
