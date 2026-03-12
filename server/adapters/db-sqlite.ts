import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { DatabaseAdapter, DrizzleDatabase } from '../../worker/adapters/types.ts'

/** Local SQLite database adapter via better-sqlite3. */
export class SQLiteDatabaseAdapter implements DatabaseAdapter {
  private db: DrizzleDatabase

  constructor(dbPath: string) {
    const sqlite = new Database(dbPath)
    // Enable WAL mode for better concurrent read performance
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    this.db = drizzle(sqlite)
  }

  getDb(): DrizzleDatabase {
    return this.db
  }
}
