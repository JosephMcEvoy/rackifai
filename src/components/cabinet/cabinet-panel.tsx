import { useEffect, useRef, useState } from "react"
import { XIcon, ArchiveIcon, Trash2Icon } from "lucide-react"
import { useRackStore } from "@/store/rack-store"
import { CabinetItemCard } from "./cabinet-item-card"
import { TrashItemCard } from "@/components/trash/trash-item-card"
import type { ArchivedItem } from "@/types/archive"

type Tab = "cabinet" | "trash"

interface CabinetPanelProps {
  open: boolean
  onClose: () => void
  onReconcile?: () => void
}

export function CabinetPanel({ open, onClose, onReconcile }: CabinetPanelProps) {
  const archivedItems = useRackStore((s) => s.archivedItems)
  const trashedItems = useRackStore((s) => s.trashedItems)
  const [tab, setTab] = useState<Tab>("cabinet")
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  // Purge expired trash when switching to trash tab
  useEffect(() => {
    if (open && tab === "trash") {
      useRackStore.getState().purgeExpiredTrash()
    }
  }, [open, tab])

  if (!open) return null

  const sortedArchived = [...archivedItems].sort((a, b) => b.archivedAt - a.archivedAt)
  const sortedTrashed = [...trashedItems].sort((a, b) => b.trashedAt - a.trashedAt)

  function handleRestore(item: ArchivedItem) {
    if (item.type === "device" && item.originalRackId) {
      const racks = useRackStore.getState().racks
      if (!racks[item.originalRackId]) {
        useRackStore.getState().restoreItem(item.id)
        return
      }
    }
    useRackStore.getState().restoreItem(item.id)
    onReconcile?.()
  }

  return (
    <div
      ref={panelRef}
      className="absolute top-14 left-4 z-40 flex w-80 flex-col rounded-lg border border-zinc-700/80 bg-zinc-900/98 shadow-2xl backdrop-blur"
      style={{ maxHeight: "400px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700/60 px-3 py-2">
        <div className="flex items-center gap-1">
          {/* Tabs */}
          <button
            onClick={() => setTab("cabinet")}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
              tab === "cabinet"
                ? "bg-zinc-700/60 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ArchiveIcon className="h-3.5 w-3.5" />
            Cabinet
            <span className="rounded bg-zinc-700/60 px-1 py-0.5 text-[10px] tabular-nums text-zinc-400">
              {archivedItems.length}
            </span>
          </button>
          <button
            onClick={() => setTab("trash")}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
              tab === "trash"
                ? "bg-zinc-700/60 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Trash2Icon className="h-3.5 w-3.5" />
            Trash
            {trashedItems.length > 0 && (
              <span className="rounded bg-zinc-700/60 px-1 py-0.5 text-[10px] tabular-nums text-zinc-400">
                {trashedItems.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-1">
          {tab === "trash" && trashedItems.length > 0 && (
            <button
              onClick={() => useRackStore.getState().emptyTrash()}
              className="rounded px-1.5 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-900/30"
            >
              Empty
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {tab === "cabinet" && (
          <>
            {sortedArchived.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ArchiveIcon className="mb-2 h-8 w-8 text-zinc-700" />
                <p className="text-xs text-zinc-500">No items in cabinet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sortedArchived.map((item) => (
                  <CabinetItemCard
                    key={item.id}
                    item={item}
                    onRestore={() => handleRestore(item)}
                    onDelete={() => useRackStore.getState().trashItem(item.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {tab === "trash" && (
          <>
            {sortedTrashed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Trash2Icon className="mb-2 h-8 w-8 text-zinc-700" />
                <p className="text-xs text-zinc-500">Trash is empty</p>
                <p className="mt-1 text-[10px] text-zinc-600">Items are auto-purged after 7 days</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sortedTrashed.map((item) => (
                  <TrashItemCard
                    key={item.id}
                    item={item}
                    onRestore={() => useRackStore.getState().restoreFromTrash(item.id)}
                    onDelete={() => useRackStore.getState().permanentDeleteFromTrash(item.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
