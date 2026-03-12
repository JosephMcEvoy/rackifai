import { loadLocalProject, deleteLocalProject, saveLocalProject } from "./local-db"
import { authHeaders, loadProject, deleteProject } from "./api-helpers"
import type { LocalProject } from "@/types/project"


/**
 * Sync a local project to the cloud.
 * Two-phase: POST to cloud → delete local. On POST failure, local copy stays.
 * Sends localId as idempotency key to prevent duplicate cloud copies on retry.
 */
export async function syncProjectToCloud(
  localId: string,
  getToken: () => Promise<string | null>,
): Promise<{ cloudId: string }> {
  // 1. Read from IndexedDB
  const local = await loadLocalProject(localId)
  if (!local) throw new Error("Local project not found")

  // 2. POST to cloud with idempotency key
  const token = await getToken()
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      name: local.name,
      configJson: local.configJson,
      idempotencyKey: localId,
    }),
  })
  if (!res.ok) throw new Error(`Cloud upload failed: ${res.status}`)
  const { id: cloudId } = (await res.json()) as { id: string; name: string }

  // 3. Delete local copy (safe — cloud copy exists)
  await deleteLocalProject(localId)

  return { cloudId }
}

/**
 * Move a cloud project to local storage.
 * Two-phase: save locally → delete cloud. If cloud delete fails, user has both copies (safe).
 */
export async function moveProjectToLocal(
  cloudId: string,
  getToken: () => Promise<string | null>,
): Promise<{ localId: string }> {
  const token = await getToken()

  // 1. Fetch full cloud project
  const cloud = await loadProject(cloudId, token)
  const configJson = cloud.rackConfigurations[0]?.configJson
  if (!configJson) throw new Error("Cloud project has no configuration data")

  // 2. Save to IndexedDB first (safe — cloud copy still exists)
  const localId = crypto.randomUUID()
  const now = new Date().toISOString()
  const localProject: LocalProject = {
    id: localId,
    name: cloud.name,
    storageMode: "local",
    configJson,
    createdAt: now,
    updatedAt: now,
  }
  await saveLocalProject(localProject)

  // 3. Delete cloud copy (safe — local copy exists)
  await deleteProject(cloudId, token)

  return { localId }
}

