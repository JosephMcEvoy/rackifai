import { useState } from "react"
import {
  ServerIcon,
  NetworkIcon,
  HardDriveIcon,
  BoxIcon,
  ZapIcon,
  PlugIcon,
  LayoutGridIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  Trash2Icon,
} from "lucide-react"
import type { TrashedItem } from "@/types/archive"
import type { DeviceCategory } from "@/canvas/device"

function getCategoryIcon(category?: string) {
  switch (category as DeviceCategory) {
    case "server": return <ServerIcon className="h-3.5 w-3.5" />
    case "switch": return <NetworkIcon className="h-3.5 w-3.5" />
    case "storage": return <HardDriveIcon className="h-3.5 w-3.5" />
    case "pdu": return <PlugIcon className="h-3.5 w-3.5" />
    case "ups": return <ZapIcon className="h-3.5 w-3.5" />
    case "patch_panel": return <LayoutGridIcon className="h-3.5 w-3.5" />
    default: return <BoxIcon className="h-3.5 w-3.5" />
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function daysUntilPurge(trashedAt: number): number {
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  const remaining = sevenDays - (Date.now() - trashedAt)
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
}

interface TrashItemCardProps {
  item: TrashedItem
  onRestore: () => void
  onDelete: () => void
}

export function TrashItemCard({ item, onRestore, onDelete }: TrashItemCardProps) {
  const [hovering, setHovering] = useState(false)

  const isRack = item.type === "rack"
  const deviceCount = item.deviceStates?.length ?? 0
  const icon = isRack ? <ArchiveIcon className="h-3.5 w-3.5" /> : getCategoryIcon(item.category)
  const purge = daysUntilPurge(item.trashedAt)

  return (
    <div
      className="group flex items-start gap-2 rounded-md border border-zinc-700/50 bg-zinc-800/80 px-2.5 py-2 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="mt-0.5 flex-shrink-0 text-zinc-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-zinc-200">{item.name}</div>
        <div className="mt-0.5 text-[10px] text-zinc-500">
          {isRack && deviceCount > 0 && <span>{deviceCount} device{deviceCount !== 1 ? "s" : ""} · </span>}
          deleted {formatRelativeTime(item.trashedAt)}
          {" · "}
          <span className={purge <= 1 ? "text-red-400" : ""}>
            {purge}d until purge
          </span>
        </div>
      </div>
      {hovering && (
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRestore()
            }}
            className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-900/30"
            title="Restore to Cabinet"
          >
            <ArchiveRestoreIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
            title="Delete permanently"
          >
            <Trash2Icon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
