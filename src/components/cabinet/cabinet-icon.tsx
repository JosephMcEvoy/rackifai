import { useRef, useEffect } from "react"
import { useRackStore } from "@/store/rack-store"
import { ArchiveIcon } from "lucide-react"
import { cabinetDropElement } from "./cabinet-drop-ref"

interface CabinetIconProps {
  onClick: () => void
}

export function CabinetIcon({ onClick }: CabinetIconProps) {
  const count = useRackStore((s) => s.archivedItems.length + s.trashedItems.length)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cabinetDropElement.current = ref.current
    return () => { cabinetDropElement.current = null }
  }, [])

  return (
    <button
      ref={ref}
      onClick={onClick}
      className="absolute top-4 left-4 z-30 flex items-center gap-1.5 rounded-lg border border-border bg-zinc-900/95 px-3 py-2 text-xs text-zinc-300 shadow-lg backdrop-blur transition-all hover:bg-zinc-800 hover:text-zinc-100 data-[drop-active=true]:scale-110 data-[drop-active=true]:border-emerald-500 data-[drop-active=true]:bg-emerald-900/80 data-[drop-active=true]:text-emerald-200"
      title="Open Cabinet"
    >
      <ArchiveIcon className="h-4 w-4" />
      <span className="min-w-[1ch] tabular-nums">{count}</span>
    </button>
  )
}
