export type StorageMode = "local" | "cloud"

export interface ConfigJson {
  racks: Record<string, unknown>
  devices: Record<string, unknown>
  archivedItems?: unknown[]
  trashedItems?: unknown[]
}

export interface LocalProject {
  id: string
  name: string
  storageMode: "local"
  configJson: ConfigJson
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type LocalProjectMeta = Omit<LocalProject, "configJson">

/** Unified project summary used by the projects dialog (merges local + cloud). */
export interface UnifiedProjectSummary {
  id: string
  name: string
  storageMode: StorageMode
  createdAt: string
  updatedAt: string
}

/** Shape returned by localStorage key "rackifai-current-project". */
export interface ProjectRef {
  id: string
  storageMode: StorageMode
}
