import { openDB, type DBSchema, deleteDB } from "idb"
import type { LocalProject, LocalProjectMeta, ConfigJson } from "@/types/project"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface RackifaiDB extends DBSchema {
  projects: {
    key: string
    value: LocalProject
    indexes: { "by-updated": string }
  }
}

const DB_NAME = "rackifai"
const DB_VERSION = 1

// Singleton connection — opened once, reused everywhere.
let dbPromise: ReturnType<typeof openDB<RackifaiDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<RackifaiDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("projects", { keyPath: "id" })
          store.createIndex("by-updated", "updatedAt")
        }
      },
      blocked() {
        // Another tab holds an older version — prompt user to close it.
        console.warn("[local-db] DB upgrade blocked by another tab")
      },
      blocking() {
        // We're blocking a newer version — close so the upgrade can proceed.
        dbPromise?.then((db) => db.close())
        dbPromise = null
      },
    })
  }
  return dbPromise
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function saveLocalProject(project: LocalProject): Promise<void> {
  const db = await getDB()
  await db.put("projects", project)
}

export async function loadLocalProject(
  id: string,
): Promise<LocalProject | undefined> {
  const db = await getDB()
  const project = await db.get("projects", id)
  if (project?.deletedAt) return undefined
  if (project && !isValidConfigJson(project.configJson)) {
    console.warn("[local-db] Invalid configJson for project", id)
    return undefined
  }
  return project
}

export async function listLocalProjects(): Promise<LocalProjectMeta[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex("projects", "by-updated")
  // Return newest first, strip configJson to keep memory low.
  // Filter out soft-deleted projects.
  return all
    .filter((p) => !p.deletedAt)
    .reverse()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ configJson: _unused, ...meta }) => meta)
}

export async function deleteLocalProject(id: string): Promise<void> {
  const db = await getDB()
  const project = await db.get("projects", id)
  if (!project) return
  project.deletedAt = new Date().toISOString()
  await db.put("projects", project)
}

export async function listTrashedLocalProjects(): Promise<LocalProjectMeta[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex("projects", "by-updated")
  return all
    .filter((p) => !!p.deletedAt)
    .reverse()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ configJson: _unused, ...meta }) => meta)
}

export async function restoreLocalProject(id: string): Promise<void> {
  const db = await getDB()
  const project = await db.get("projects", id)
  if (!project) return
  delete project.deletedAt
  await db.put("projects", project)
}

export async function permanentDeleteLocalProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("projects", id)
}

export async function purgeExpiredLocalTrash(): Promise<void> {
  const db = await getDB()
  const all = await db.getAll("projects")
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  for (const p of all) {
    if (p.deletedAt && now - new Date(p.deletedAt).getTime() > sevenDaysMs) {
      await db.delete("projects", p.id)
    }
  }
}

// ---------------------------------------------------------------------------
// Availability detection
// ---------------------------------------------------------------------------

export async function isIndexedDBAvailable(): Promise<boolean> {
  if (!globalThis.indexedDB) return false
  try {
    const probe = await openDB("__rackifai_probe", 1, {
      upgrade(db) {
        db.createObjectStore("test")
      },
    })
    probe.close()
    await deleteDB("__rackifai_probe")
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Reset the DB singleton — for tests only. No-op in production builds. */
export function __resetDB(): void {
  if (import.meta.env.PROD) return
  dbPromise?.then((db) => db.close()).catch(() => {})
  dbPromise = null
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidConfigJson(cj: unknown): cj is ConfigJson {
  if (!cj || typeof cj !== "object") return false
  const obj = cj as Record<string, unknown>
  return typeof obj.racks === "object" && typeof obj.devices === "object"
}
