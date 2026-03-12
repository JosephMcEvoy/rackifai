import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseAdapter, DrizzleDatabase } from './types.ts'

/** Cloudflare D1 database adapter. */
export class D1DatabaseAdapter implements DatabaseAdapter {
  private db: DrizzleDatabase

  constructor(d1: D1Database) {
    this.db = drizzle(d1)
  }

  getDb(): DrizzleDatabase {
    return this.db
  }
}
