import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"

export type ExportFormat = "svg" | "pdf" | "vsdx"
export type PageSize = "a4" | "letter" | "a3"
export type Orientation = "portrait" | "landscape"

export interface ExportSettings {
  format: ExportFormat
  pageSize: PageSize
  orientation: Orientation
  includeHeader: boolean
  /** VSDX: embed device images in the export */
  includeImages: boolean
}

interface ExportModalProps {
  open: boolean
  onClose: () => void
  onExport: (settings: ExportSettings) => void
}

const FORMAT_INFO: Record<ExportFormat, { label: string; desc: string }> = {
  svg: { label: "SVG", desc: "Vector graphics, editable in Inkscape" },
  pdf: { label: "PDF", desc: "Print-ready, vector quality" },
  vsdx: { label: "Visio (.vsdx)", desc: "Microsoft Visio / draw.io" },
}

export function ExportModal({ open, onClose, onExport }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("svg")
  const [pageSize, setPageSize] = useState<PageSize>("letter")
  const [orientation, setOrientation] = useState<Orientation>("portrait")
  const [includeHeader, setIncludeHeader] = useState(true)
  const [includeImages, setIncludeImages] = useState(false)

  const handleExport = useCallback(() => {
    onExport({ format, pageSize, orientation, includeHeader, includeImages })
    onClose()
  }, [format, pageSize, orientation, includeHeader, includeImages, onExport, onClose])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-[420px] rounded-lg border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-base font-medium text-foreground mb-4">Export Rack Layout</h2>

        {/* Format selector */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
            Format
          </label>
          <div className="flex gap-2">
            {(Object.keys(FORMAT_INFO) as ExportFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-md border px-3 py-2 text-left transition-colors ${
                  format === f
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                <div className="text-xs font-medium">{FORMAT_INFO[f].label}</div>
                <div className="text-[10px] text-muted-foreground">{FORMAT_INFO[f].desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* PDF-specific options */}
        {format === "pdf" && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Page Size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as PageSize)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
              >
                <option value="letter">Letter (8.5" x 11")</option>
                <option value="a4">A4 (210mm x 297mm)</option>
                <option value="a3">A3 (297mm x 420mm)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Orientation</label>
              <div className="flex gap-2">
                {(["portrait", "landscape"] as Orientation[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOrientation(o)}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
                      orientation === o
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Include header (SVG/PDF only) */}
        {format !== "vsdx" && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHeader}
              onChange={(e) => setIncludeHeader(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-xs text-foreground">Include title block</span>
          </label>
        )}

        {/* Visio-specific options */}
        {format === "vsdx" && (
          <div className="mb-3 space-y-2">
            <div className="text-[10px] text-muted-foreground mb-2">
              Front and rear views are included for each rack.
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(e) => setIncludeImages(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-xs text-foreground">Include device images</span>
            </label>
          </div>
        )}

        {/* Spacer before actions */}
        <div className="mb-5" />

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport}>
            Export {FORMAT_INFO[format].label}
          </Button>
        </div>
      </div>
    </div>
  )
}
