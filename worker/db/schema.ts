import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId: text('clerk_id').unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  ...timestamps,
})

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    shareToken: text('share_token'),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (table) => [index('projects_share_token_idx').on(table.shareToken)],
)

// NOTE: config_json is a transitional blob. Will be normalized to a
// rack_devices child table in M5 if blob sizes approach the D1 1MB row limit.
export const rackConfigurations = sqliteTable(
  'rack_configurations',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    configJson: text('config_json', { mode: 'json' }),
    ...timestamps,
  },
  (table) => [index('rack_configs_project_id_idx').on(table.projectId)],
)

export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  message: text('message').notNull(),
  email: text('email'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const deviceCatalog = sqliteTable(
  'device_catalog',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    manufacturer: text('manufacturer').notNull(),
    model: text('model').notNull(),
    slug: text('slug').notNull(),
    uHeight: integer('u_height').notNull().default(1),
    isFullDepth: integer('is_full_depth', { mode: 'boolean' }).notNull().default(true),
    weightKg: real('weight_kg'),
    maxPowerWatts: integer('max_power_watts'),
    category: text('category').notNull().default('server'),
    metadataJson: text('metadata_json', { mode: 'json' }),
    ...timestamps,
  },
  (table) => [
    index('device_catalog_manufacturer_idx').on(table.manufacturer),
    index('device_catalog_category_idx').on(table.category),
    index('device_catalog_slug_idx').on(table.slug),
  ],
)
