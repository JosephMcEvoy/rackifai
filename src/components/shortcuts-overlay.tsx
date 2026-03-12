import { useEffect } from "react"

const SHORTCUTS = [
  { keys: "Ctrl+Z", action: "Undo" },
  { keys: "Ctrl+Shift+Z / Ctrl+Y", action: "Redo" },
  { keys: "Ctrl+S", action: "Save" },
  { keys: "Ctrl+E", action: "Export" },
  { keys: "Ctrl+A", action: "Select all" },
  { keys: "Ctrl+D", action: "Duplicate" },
  { keys: "Delete", action: "Remove selected" },
  { keys: "Escape", action: "Deselect / Close" },
  { keys: "?", action: "Show shortcuts" },
  { keys: "+ / -", action: "Zoom in / out" },
  { keys: "0", action: "Fit to screen" },
  { keys: "Space + drag", action: "Pan canvas" },
]

interface ShortcutsOverlayProps {
  open: boolean
  onClose: () => void
}

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-[360px] rounded-lg border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-base font-medium text-foreground mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{s.action}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Press ? or Esc to close
          </button>
        </div>
      </div>
    </div>
  )
}
