import { useRackStore } from "@/store/rack-store"
import { Trash2Icon } from "lucide-react"

interface TrashIconProps {
  onClick: () => void
}

export function TrashIcon({ onClick }: TrashIconProps) {
  const count = useRackStore((s) => s.trashedItems.length)

  return (
    <button
      onClick={onClick}
      className="absolute top-16 left-4 z-30 flex items-center gap-1.5 rounded-lg border border-border bg-zinc-900/95 px-3 py-2 text-xs text-zinc-300 shadow-lg backdrop-blur transition-all hover:bg-zinc-800 hover:text-zinc-100"
      title="Open Trash"
    >
      <Trash2Icon className="h-4 w-4" />
      <span className="min-w-[1ch] tabular-nums">{count}</span>
    </button>
  )
}
