import { useEffect, useRef } from "react"

export interface ContextMenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}

interface DeviceContextMenuProps {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

export function DeviceContextMenu({ x, y, actions, onClose }: DeviceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => {
            action.onClick()
            onClose()
          }}
          className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
            action.danger
              ? "text-destructive hover:bg-destructive/10"
              : "text-popover-foreground hover:bg-accent"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
