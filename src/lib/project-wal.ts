import type { ConfigJson } from "@/types/project"
import { saveLocalProject, loadLocalProject } from "./local-db"

/** Max WAL payload size in bytes — skip for very large projects to avoid localStorage quota errors. */
const MAX_WAL_SIZE = 2 * 1024 * 1024 // 2MB

interface WalEntry {
  id: string
  configJson: ConfigJson
  name: string
  timestamp: number
}

function walKey(projectId: string): string {
  return `rackifai-wal-${projectId}`
}

/**
 * Synchronously write a WAL snapshot to localStorage for the given project.
 * Called from beforeunload / visibilitychange as a fallback for async IndexedDB writes.
 */
export function writeWal(
  projectId: string,
  name: string,
  configJson: ConfigJson,
): void {
  try {
    const payload = JSON.stringify({
      id: projectId,
      configJson,
      name,
      timestamp: Date.now(),
    } satisfies WalEntry)

    // Skip if payload exceeds safe size
    if (payload.length > MAX_WAL_SIZE) return

    localStorage.setItem(walKey(projectId), payload)
  } catch {
    // localStorage full or unavailable — best-effort only
  }
}

/** Remove WAL entry after successful IndexedDB save. */
export function clearWal(projectId: string): void {
  try {
    localStorage.removeItem(walKey(projectId))
  } catch {
    // Ignore
  }
}

/**
 * Replay a WAL entry into IndexedDB if it's newer than the stored version.
 * Returns `true` if a replay occurred.
 */
export async function replayWal(projectId: string): Promise<boolean> {
  let raw: string | null
  try {
    raw = localStorage.getItem(walKey(projectId))
  } catch {
    return false
  }
  if (!raw) return false

  let entry: WalEntry
  try {
    entry = JSON.parse(raw) as WalEntry
  } catch {
    // Corrupt WAL — discard
    clearWal(projectId)
    return false
  }

  // Compare WAL timestamp against IndexedDB updatedAt
  const existing = await loadLocalProject(projectId)
  if (existing) {
    const existingTime = new Date(existing.updatedAt).getTime()
    if (existingTime >= entry.timestamp) {
      // IndexedDB is already newer — discard stale WAL
      clearWal(projectId)
      return false
    }
  }

  // WAL is newer — replay into IndexedDB
  await saveLocalProject({
    id: entry.id,
    name: entry.name,
    storageMode: "local",
    configJson: entry.configJson,
    createdAt: existing?.createdAt ?? new Date(entry.timestamp).toISOString(),
    updatedAt: new Date(entry.timestamp).toISOString(),
  })

  clearWal(projectId)
  return true
}
