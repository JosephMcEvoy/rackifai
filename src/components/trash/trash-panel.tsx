import { useEffect } from "react"
import { XIcon, Trash2Icon } from "lucide-react"
import { useRackStore } from "@/store/rack-store"
import { TrashItemCard } from "./trash-item-card"

interface TrashPanelProps {
  open: boolean
  onClose: () => void
}

export function TrashPanel({ open, onClose }: TrashPanelProps) {
  const trashedItems = useRackStore((s) => s.trashedItems)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  // Purge expired items when panel opens
  useEffect(() => {
    if (open) {
      useRackStore.getState().purgeExpiredTrash()
    }
  }, [open])

  if (!open) return null

  const sorted = [...trashedItems].sort((a, b) => b.trashedAt - a.trashedAt)

  return (
    <div
      className="absolute top-14 left-4 z-40 flex w-80 flex-col rounded-lg border border-zinc-700/80 bg-zinc-900/98 shadow-2xl backdrop-blur"
      style={{ maxHeight: "400px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Trash2Icon className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-200">Trash</span>
          <span className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
            {trashedItems.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {trashedItems.length > 0 && (
            <button
              onClick={() => useRackStore.getState().emptyTrash()}
              className="rounded px-1.5 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-900/30"
            >
              Empty Trash
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
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Trash2Icon className="mb-2 h-8 w-8 text-zinc-700" />
            <p className="text-xs text-zinc-500">Trash is empty</p>
            <p className="mt-1 text-[10px] text-zinc-600">Items are auto-purged after 7 days</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorted.map((item) => (
              <TrashItemCard
                key={item.id}
                item={item}
                onRestore={() => useRackStore.getState().restoreFromTrash(item.id)}
                onDelete={() => useRackStore.getState().permanentDeleteFromTrash(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
