import type { ConfigJson, UnifiedProjectSummary } from "@/types/project"

/** Unified interface for project persistence — local (IndexedDB) or cloud (API). */
export interface StorageAdapter {
  save(id: string, name: string, configJson: ConfigJson): Promise<void>
  load(id: string): Promise<{ name: string; configJson: ConfigJson } | undefined>
  list(): Promise<UnifiedProjectSummary[]>
  delete(id: string): Promise<void>
  create(name: string, configJson?: ConfigJson): Promise<{ id: string; name: string }>
  listTrashed(): Promise<UnifiedProjectSummary[]>
  restore(id: string): Promise<void>
  permanentDelete(id: string): Promise<void>
}
