import type { StorageAdapter } from "./storage-adapter"
import type { ConfigJson, UnifiedProjectSummary } from "@/types/project"
import {
  saveLocalProject,
  loadLocalProject,
  listLocalProjects,
  deleteLocalProject,
  listTrashedLocalProjects,
  restoreLocalProject,
  permanentDeleteLocalProject,
} from "./local-db"

export class LocalStorageAdapter implements StorageAdapter {
  async save(id: string, name: string, configJson: ConfigJson): Promise<void> {
    // Preserve original createdAt if the project already exists
    const existing = await loadLocalProject(id)
    await saveLocalProject({
      id,
      name,
      storageMode: "local",
      configJson,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  async load(
    id: string,
  ): Promise<{ name: string; configJson: ConfigJson } | undefined> {
    const project = await loadLocalProject(id)
    if (!project) return undefined
    return { name: project.name, configJson: project.configJson }
  }

  async list(): Promise<UnifiedProjectSummary[]> {
    const projects = await listLocalProjects()
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      storageMode: "local" as const,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  }

  async delete(id: string): Promise<void> {
    await deleteLocalProject(id)
  }

  async create(
    name: string,
    configJson?: ConfigJson,
  ): Promise<{ id: string; name: string }> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await saveLocalProject({
      id,
      name,
      storageMode: "local",
      configJson: configJson ?? { racks: {}, devices: {} },
      createdAt: now,
      updatedAt: now,
    })
    return { id, name }
  }

  async listTrashed(): Promise<UnifiedProjectSummary[]> {
    const projects = await listTrashedLocalProjects()
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      storageMode: "local" as const,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    }))
  }

  async restore(id: string): Promise<void> {
    await restoreLocalProject(id)
  }

  async permanentDelete(id: string): Promise<void> {
    await permanentDeleteLocalProject(id)
  }
}
