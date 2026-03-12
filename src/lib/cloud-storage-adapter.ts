import type { StorageAdapter } from "./storage-adapter"
import type { ConfigJson, UnifiedProjectSummary } from "@/types/project"
import {
  listProjects,
  loadProject,
  createProject,
  deleteProject,
  listTrashedProjects,
  restoreProject,
  permanentDeleteProject,
  authHeaders,
} from "./api-helpers"

/**
 * Cloud storage adapter — wraps existing API helpers.
 * Normalizes the `rackConfigurations[0].configJson` shape into flat `configJson`.
 */
export class CloudStorageAdapter implements StorageAdapter {
  private getToken: () => Promise<string | null>

  constructor(getToken: () => Promise<string | null>) {
    this.getToken = getToken
  }

  async save(id: string, name: string, configJson: ConfigJson): Promise<void> {
    const token = await this.getToken()
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ name, configJson }),
    })
    if (!res.ok) throw new Error(`Save failed: ${res.status}`)
  }

  async load(
    id: string,
  ): Promise<{ name: string; configJson: ConfigJson } | undefined> {
    const token = await this.getToken()
    const detail = await loadProject(id, token)
    const config = detail.rackConfigurations[0]?.configJson
    if (!config) return undefined
    return {
      name: detail.name,
      configJson: config as ConfigJson,
    }
  }

  async list(): Promise<UnifiedProjectSummary[]> {
    const token = await this.getToken()
    const projects = await listProjects(token)
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      storageMode: "cloud" as const,
      // Normalize: cloud may return epoch-second strings or ISO — ensure ISO for consistency
      createdAt: normalizeTimestamp(p.createdAt),
      updatedAt: normalizeTimestamp(p.updatedAt),
    }))
  }

  async delete(id: string): Promise<void> {
    const token = await this.getToken()
    await deleteProject(id, token)
  }

  async create(
    name: string,
    configJson?: ConfigJson,
  ): Promise<{ id: string; name: string }> {
    const token = await this.getToken()
    return createProject(name, configJson, token)
  }
  async listTrashed(): Promise<UnifiedProjectSummary[]> {
    const token = await this.getToken()
    const projects = await listTrashedProjects(token)
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      storageMode: "cloud" as const,
      createdAt: normalizeTimestamp(p.createdAt),
      updatedAt: normalizeTimestamp(p.updatedAt),
    }))
  }

  async restore(id: string): Promise<void> {
    const token = await this.getToken()
    await restoreProject(id, token)
  }

  async permanentDelete(id: string): Promise<void> {
    const token = await this.getToken()
    await permanentDeleteProject(id, token)
  }
}

/** Ensure timestamps are ISO 8601 strings regardless of source format. */
function normalizeTimestamp(ts: string): string {
  // If it looks like a unix epoch (all digits), convert
  if (/^\d+$/.test(ts)) {
    const num = Number(ts)
    // Seconds vs milliseconds heuristic: if < 1e12, it's seconds
    const ms = num < 1e12 ? num * 1000 : num
    return new Date(ms).toISOString()
  }
  // Already ISO or parseable — validate
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toISOString()
}
