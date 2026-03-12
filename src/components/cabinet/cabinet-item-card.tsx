import { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { ServerIcon, NetworkIcon, HardDriveIcon, BoxIcon, ZapIcon, PlugIcon, LayoutGridIcon, ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react"
import type { ArchivedItem } from "@/types/archive"
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

interface CabinetItemCardProps {
  item: ArchivedItem
  onRestore: () => void
  onDelete: () => void
}

export function CabinetItemCard({ item, onRestore, onDelete }: CabinetItemCardProps) {
  const [hovering, setHovering] = useState(false)

  const isRack = item.type === "rack"
  const canDrag = item.type === "device" && item.deviceState != null
  const deviceCount = item.deviceStates?.length ?? 0
  const icon = isRack ? <ArchiveIcon className="h-3.5 w-3.5" /> : getCategoryIcon(item.category)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `cabinet-${item.id}`,
    data: { cabinetItem: item },
    disabled: !canDrag,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={`group flex items-start gap-2 rounded-md border border-zinc-700/50 bg-zinc-800/80 px-2.5 py-2 transition-colors hover:border-zinc-600 hover:bg-zinc-800 ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
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
          {!isRack && item.originalRackId && <span>from rack · </span>}
          {formatRelativeTime(item.archivedAt)}
        </div>
      </div>
      {hovering && (
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onRestore()
            }}
            className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-900/30"
            title="Restore item"
          >
            <ArchiveRestoreIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
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
