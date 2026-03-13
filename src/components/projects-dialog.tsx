import { useState, useEffect, useCallback, useMemo } from "react"
import { useAppAuth } from "@/lib/auth-context"
import { Trash2, CloudUpload, CloudDownload, Loader2, RotateCcw, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LocalStorageAdapter } from "@/lib/local-storage-adapter"
import { CloudStorageAdapter } from "@/lib/cloud-storage-adapter"
import { syncProjectToCloud, moveProjectToLocal } from "@/lib/project-sync"
import type { StorageMode, UnifiedProjectSummary } from "@/types/project"

interface ProjectsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpen: (projectId: string, storageMode: StorageMode) => void
  onNew: (projectId: string, name: string, storageMode: StorageMode) => void
  currentProjectId: string | null
  storageMode: StorageMode
  isSignedIn: boolean
}

const localAdapter = new LocalStorageAdapter()

export function ProjectsDialog({
  open,
  onOpenChange,
  onOpen,
  onNew,
  currentProjectId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  storageMode: _currentStorageMode,
  isSignedIn,
}: ProjectsDialogProps) {
  const { getToken } = useAppAuth()
  const [projects, setProjects] = useState<UnifiedProjectSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [moveToLocalTarget, setMoveToLocalTarget] = useState<UnifiedProjectSummary | null>(null)
  const [tab, setTab] = useState<"active" | "trash">("active")
  const [trashedProjects, setTrashedProjects] = useState<UnifiedProjectSummary[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [permDeleteId, setPermDeleteId] = useState<string | null>(null)

  const cloudAdapter = useMemo(() => new CloudStorageAdapter(getToken), [getToken])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch both sources in parallel — skip cloud if not signed in
      const [localProjects, cloudProjects, localTrashed, cloudTrashed] = await Promise.all([
        localAdapter.list().catch(() => [] as UnifiedProjectSummary[]),
        isSignedIn
          ? cloudAdapter.list().catch(() => [] as UnifiedProjectSummary[])
          : ([] as UnifiedProjectSummary[]),
        localAdapter.listTrashed().catch(() => [] as UnifiedProjectSummary[]),
        isSignedIn
          ? cloudAdapter.listTrashed().catch(() => [] as UnifiedProjectSummary[])
          : ([] as UnifiedProjectSummary[]),
      ])

      // Merge and sort by updatedAt descending
      const merged = [...localProjects, ...cloudProjects].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      setProjects(merged)

      const mergedTrashed = [...localTrashed, ...cloudTrashed].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      setTrashedProjects(mergedTrashed)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, cloudAdapter])

  useEffect(() => {
    if (open) {
      setTab("active")
      refresh()
    }
  }, [open, refresh])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      // Default: signed-in → cloud, guest → local
      const mode: StorageMode = isSignedIn ? "cloud" : "local"
      const adapter = mode === "local" ? localAdapter : cloudAdapter
      const project = await adapter.create(name)
      setNewName("")
      onNew(project.id, name, mode)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(project: UnifiedProjectSummary) {
    setDeletingId(project.id)
    setError(null)
    try {
      const adapter = project.storageMode === "local" ? localAdapter : cloudAdapter
      await adapter.delete(project.id)
      setProjects((prev) => prev.filter((p) => p.id !== project.id))
      // Add to trash list immediately so the Trash tab updates without re-opening
      setTrashedProjects((prev) => [{ ...project, updatedAt: new Date().toISOString() }, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSync(project: UnifiedProjectSummary) {
    if (project.storageMode !== "local") return
    setSyncingId(project.id)
    setError(null)
    try {
      const { cloudId } = await syncProjectToCloud(project.id, getToken)
      // If syncing the active project, switch to the new cloud copy
      if (project.id === currentProjectId) {
        onOpen(cloudId, "cloud")
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync project")
    } finally {
      setSyncingId(null)
    }
  }

  async function confirmMoveToLocal() {
    const project = moveToLocalTarget
    if (!project) return
    setMoveToLocalTarget(null)
    setSyncingId(project.id)
    setError(null)
    try {
      const { localId } = await moveProjectToLocal(project.id, getToken)
      if (project.id === currentProjectId) {
        onOpen(localId, "local")
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move project to local")
    } finally {
      setSyncingId(null)
    }
  }

  async function handleRestore(project: UnifiedProjectSummary) {
    setRestoringId(project.id)
    setError(null)
    try {
      const adapter = project.storageMode === "local" ? localAdapter : cloudAdapter
      await adapter.restore(project.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore project")
    } finally {
      setRestoringId(null)
    }
  }

  async function handlePermanentDelete(project: UnifiedProjectSummary) {
    setPermDeleteId(project.id)
    setError(null)
    try {
      const adapter = project.storageMode === "local" ? localAdapter : cloudAdapter
      await adapter.permanentDelete(project.id)
      setTrashedProjects((prev) => prev.filter((p) => p.id !== project.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to permanently delete project")
    } finally {
      setPermDeleteId(null)
    }
  }

  function formatDate(ts: string) {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Projects</DialogTitle>
          <DialogDescription>
            Create, open, or delete rack design projects.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 border-b border-border">
          <button
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "active"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("active")}
          >
            Active
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "trash"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("trash")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Trash
            {trashedProjects.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                {trashedProjects.length}
              </span>
            )}
          </button>
        </div>

        {tab === "active" && (
          <>
            {/* New project form */}
            <form onSubmit={handleCreate} className="flex gap-2">
              <Input
                placeholder="New project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={creating || !newName.trim()} size="sm">
                {creating ? "Creating..." : "Create"}
              </Button>
            </form>

            {/* Project list */}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {loading && projects.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
              )}
              {!loading && projects.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No projects yet. Create one above.
                </p>
              )}
              {projects.map((p) => {
                const isCurrent = p.id === currentProjectId
                const isBusy = deletingId === p.id || syncingId === p.id
                return (
                  <div
                    key={`${p.storageMode}-${p.id}`}
                    className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
                      isCurrent
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50 cursor-pointer"
                    }`}
                    onClick={() => {
                      if (isCurrent) return
                      onOpen(p.id, p.storageMode)
                      onOpenChange(false)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.name}</span>
                        <Badge
                          variant={p.storageMode === "local" ? "secondary" : "outline"}
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {p.storageMode === "local" ? "Local" : "Cloud"}
                        </Badge>
                        {isCurrent && (
                          <span className="text-[10px] text-primary">Current</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(p.updatedAt)}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {p.storageMode === "local" && (
                        <span title={isSignedIn ? "Sync to cloud" : "Sign in to sync to cloud"}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            disabled={isBusy || !isSignedIn}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSync(p)
                            }}
                          >
                            {syncingId === p.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <CloudUpload className="h-3.5 w-3.5" />}
                          </Button>
                        </span>
                      )}
                      {isSignedIn && p.storageMode === "cloud" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          disabled={isBusy}
                          title="Move to local storage"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMoveToLocalTarget(p)
                          }}
                        >
                          {syncingId === p.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <CloudDownload className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <span title={isCurrent ? "Cannot delete the active project" : "Delete project"}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={isBusy || isCurrent}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(p)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === "trash" && (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {loading && trashedProjects.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            )}
            {!loading && trashedProjects.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Trash is empty. Deleted projects appear here for 7 days.
              </p>
            )}
            {trashedProjects.map((p) => {
              const isBusy = restoringId === p.id || permDeleteId === p.id
              return (
                <div
                  key={`${p.storageMode}-${p.id}`}
                  className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate text-muted-foreground">{p.name}</span>
                      <Badge
                        variant={p.storageMode === "local" ? "secondary" : "outline"}
                        className="text-[10px] px-1.5 py-0 shrink-0"
                      >
                        {p.storageMode === "local" ? "Local" : "Cloud"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(p.updatedAt)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      disabled={isBusy}
                      title="Restore project"
                      onClick={() => handleRestore(p)}
                    >
                      {restoringId === p.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RotateCcw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={isBusy}
                      title="Delete permanently"
                      onClick={() => handlePermanentDelete(p)}
                    >
                      {permDeleteId === p.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <XCircle className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!moveToLocalTarget} onOpenChange={(open) => { if (!open) setMoveToLocalTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to local storage?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the cloud copy and save the project locally only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMoveToLocal}>Move to local</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
