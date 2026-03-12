import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as jose from 'jose'
import { users } from '../../worker/db/schema.ts'
import type { MiddlewareHandler } from 'hono/types'
import type { AuthAdapter, DrizzleDatabase } from '../../worker/adapters/types.ts'

/**
 * Local JWT auth adapter for standalone mode.
 *
 * - No-auth mode (default): all requests get a default single-user identity.
 * - Multi-user mode: set `AUTH_REQUIRED=true` to require login via /api/auth/*.
 */
export class LocalAuthAdapter implements AuthAdapter {
  private getDb: () => DrizzleDatabase
  private jwtSecret: Uint8Array
  private authRequired: boolean
  private defaultUserId: string | null = null

  constructor(opts: {
    getDb: () => DrizzleDatabase
    jwtSecret: string
    authRequired?: boolean
  }) {
    this.getDb = opts.getDb
    this.jwtSecret = new TextEncoder().encode(opts.jwtSecret)
    this.authRequired = opts.authRequired ?? false
  }

  middleware(): MiddlewareHandler {
    return async (c, next) => {
      const authHeader = c.req.header('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

      if (token) {
        // Verify JWT
        try {
          const { payload } = await jose.jwtVerify(token, this.jwtSecret)
          const userId = payload.sub as string
          const email = payload.email as string
          c.set('authResult', { userId, email, externalId: null })
        } catch {
          c.set('authResult', null)
        }
      } else if (!this.authRequired) {
        // No-auth mode: auto-create/reuse a default user
        const user = await this.getOrCreateDefaultUser()
        if (user) {
          c.set('authResult', { userId: user.id, email: user.email, externalId: null })
        } else {
          c.set('authResult', null)
        }
      } else {
        c.set('authResult', null)
      }

      await next()
    }
  }

  getAuthRoutes(): Hono {
    const app = new Hono()
    const getDb = this.getDb
    const jwtSecret = this.jwtSecret

    // Register
    app.post('/auth/register', async (c) => {
      const body = await c.req.json<{ email: string; password: string; name?: string }>()
      if (!body.email || !body.password) {
        return c.json({ error: 'Email and password are required' }, 400)
      }

      const db = getDb()
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, body.email))
        .get()

      if (existing) {
        return c.json({ error: 'Email already registered' }, 409)
      }

      // Hash password using Web Crypto (works in Node.js and edge)
      const passwordHash = await hashPassword(body.password)

      const user = await db
        .insert(users)
        .values({
          email: body.email,
          name: body.name ?? null,
          clerkId: `local:${passwordHash}`, // Store hash in clerkId field (repurposed for standalone)
        })
        .returning({ id: users.id, email: users.email })
        .get()

      const token = await new jose.SignJWT({ email: user.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(jwtSecret)

      return c.json({ token, user: { id: user.id, email: user.email } })
    })

    // Login
    app.post('/auth/login', async (c) => {
      const body = await c.req.json<{ email: string; password: string }>()
      if (!body.email || !body.password) {
        return c.json({ error: 'Email and password are required' }, 400)
      }

      const db = getDb()
      const user = await db
        .select({ id: users.id, email: users.email, clerkId: users.clerkId })
        .from(users)
        .where(eq(users.email, body.email))
        .get()

      if (!user || !user.clerkId?.startsWith('local:')) {
        return c.json({ error: 'Invalid email or password' }, 401)
      }

      const storedHash = user.clerkId.slice(6) // Remove 'local:' prefix
      const valid = await verifyPassword(body.password, storedHash)
      if (!valid) {
        return c.json({ error: 'Invalid email or password' }, 401)
      }

      const token = await new jose.SignJWT({ email: user.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(jwtSecret)

      return c.json({ token, user: { id: user.id, email: user.email } })
    })

    return app
  }

  private async getOrCreateDefaultUser(): Promise<{ id: string; email: string } | null> {
    if (this.defaultUserId) {
      const db = this.getDb()
      const user = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, this.defaultUserId))
        .get()
      if (user) return user
    }

    const db = this.getDb()
    const defaultEmail = 'admin@localhost'
    let user = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, defaultEmail))
      .get()

    if (!user) {
      user = await db
        .insert(users)
        .values({ email: defaultEmail, name: 'Admin', clerkId: null })
        .returning({ id: users.id, email: users.email })
        .get()
    }

    this.defaultUserId = user.id
    return user
  }
}

// --- Password hashing using Web Crypto (PBKDF2) ---
// Works in both Node.js and edge runtimes without native dependencies.

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  )
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  )
  const derivedHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return derivedHex === hashHex
}
