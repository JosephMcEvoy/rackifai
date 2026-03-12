import { useState, useEffect, useCallback } from "react"
import { useAppAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PopoverContent } from "@/components/ui/popover"
import { listLocalProjects } from "@/lib/local-db"
import { syncProjectToCloud } from "@/lib/project-sync"
import type { LocalProjectMeta } from "@/types/project"

interface SyncPromptBalloonProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSynced?: (localId: string, cloudId: string) => void
  onDismiss?: (localIds: string[]) => void
}

type SyncStatus = "pending" | "syncing" | "done" | "error"

interface SyncItem {
  project: LocalProjectMeta
  checked: boolean
  status: SyncStatus
  cloudId?: string
  error?: string
}

export function SyncPromptBalloon({
  open,
  onOpenChange,
  onSynced,
  onDismiss,
}: SyncPromptBalloonProps) {
  const { getToken } = useAppAuth()
  const [items, setItems] = useState<SyncItem[]>([])
  const [syncing, setSyncing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load local projects when balloon opens
  useEffect(() => {
    if (!open) return
    async function load() {
      try {
        const locals = await listLocalProjects()
        setItems(
          locals.map((p) => ({
            project: p,
            checked: true,
            status: "pending" as SyncStatus,
          })),
        )
        setLoadError(null)
      } catch {
        setLoadError("Failed to load local projects")
      }
    }
    load()
  }, [open])

  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.project.id === id ? { ...item, checked: !item.checked } : item,
      ),
    )
  }, [])

  const handleSync = useCallback(async () => {
    const toSync = items.filter((i) => i.checked && i.status === "pending")
    if (toSync.length === 0) return

    setSyncing(true)

    for (const item of toSync) {
      setItems((prev) =>
        prev.map((i) =>
          i.project.id === item.project.id ? { ...i, status: "syncing" } : i,
        ),
      )

      try {
        const { cloudId } = await syncProjectToCloud(item.project.id, getToken)
        setItems((prev) =>
          prev.map((i) =>
            i.project.id === item.project.id
              ? { ...i, status: "done", cloudId }
              : i,
          ),
        )
        onSynced?.(item.project.id, cloudId)
      } catch (err) {
        setItems((prev) =>
          prev.map((i) =>
            i.project.id === item.project.id
              ? {
                  ...i,
                  status: "error",
                  error: err instanceof Error ? err.message : "Sync failed",
                }
              : i,
          ),
        )
      }
    }

    setSyncing(false)
  }, [items, getToken, onSynced])

  const checkedCount = items.filter((i) => i.checked && i.status === "pending").length
  const allDone = items.length > 0 && items.every((i) => i.status === "done" || !i.checked)

  function formatDate(ts: string) {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  }

  if (!open) return null

  return (
    <PopoverContent
      align="center"
      sideOffset={8}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onInteractOutside={() => {
        onDismiss?.(items.map((i) => i.project.id))
        onOpenChange(false)
      }}
      className="w-72 p-3 space-y-2"
    >
      <div>
        <p className="text-sm font-medium">Sync Local Projects</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You have local projects in this browser. Sync them to the cloud?
        </p>
      </div>

      {loadError && <p className="text-xs text-destructive">{loadError}</p>}

      <div className="max-h-36 overflow-y-auto space-y-0.5">
        {items.map((item) => (
          <label
            key={item.project.id}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggleItem(item.project.id)}
              disabled={item.status !== "pending"}
              className="accent-primary"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.project.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {formatDate(item.project.updatedAt)}
              </div>
            </div>
            <div className="shrink-0 text-[10px]">
              {item.status === "syncing" && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
              {item.status === "done" && (
                <span className="text-green-500">Synced</span>
              )}
              {item.status === "error" && (
                <span className="text-destructive" title={item.error}>
                  Failed
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-1.5 pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => {
            onDismiss?.(items.map((i) => i.project.id))
            onOpenChange(false)
          }}
          disabled={syncing}
        >
          {allDone ? "Done" : "Dismiss"}
        </Button>
        {!allDone && (
          <Button
            size="sm"
            className="h-6 text-xs px-2"
            onClick={handleSync}
            disabled={syncing || checkedCount === 0}
          >
            {syncing
              ? "Syncing..."
              : `Sync ${checkedCount} to Cloud`}
          </Button>
        )}
      </div>
    </PopoverContent>
  )
}
