import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'

/**
 * Run Drizzle migrations against a SQLite database file.
 * Creates the database file if it doesn't exist.
 */
export function runMigrations(dbPath: string): void {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite)

  // Migrations directory is relative to the project root
  const migrationsFolder = path.resolve('./drizzle/migrations')

  migrate(db, { migrationsFolder })

  sqlite.close()
}
