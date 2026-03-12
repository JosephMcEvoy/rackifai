import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.ts'
import type { MiddlewareHandler } from 'hono/types'
import type { AuthAdapter, DrizzleDatabase } from './types.ts'

/**
 * Clerk auth adapter.
 *
 * Applies Clerk JWT verification middleware, then resolves the Clerk userId
 * to a local DB user row (lazy-creating on first request).
 */
export class ClerkAuthAdapter implements AuthAdapter {
  private getDb: () => DrizzleDatabase

  constructor(getDb: () => DrizzleDatabase) {
    this.getDb = getDb
  }

  middleware(): MiddlewareHandler {
    const clerkMw = clerkMiddleware()
    const getDbFn = this.getDb

    return async (c, next) => {
      // Run Clerk middleware first to populate auth context
      await new Promise<void>((resolve) => {
        clerkMw(c, async () => { resolve() })
      })

      const auth = getAuth(c)
      if (!auth?.userId) {
        c.set('authResult', null)
        await next()
        return
      }

      const db = getDbFn()
      let user = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.clerkId, auth.userId))
        .get()

      if (!user) {
        const email = (auth.sessionClaims as Record<string, unknown>)?.email as string | undefined
        user = await db
          .insert(users)
          .values({
            clerkId: auth.userId,
            email: email ?? `${auth.userId}@clerk`,
            name: null,
          })
          .returning({ id: users.id, email: users.email })
          .get()
      }

      if (user) {
        c.set('authResult', {
          userId: user.id,
          email: user.email,
          externalId: auth.userId,
        })
      } else {
        c.set('authResult', null)
      }

      await next()
    }
  }
}
