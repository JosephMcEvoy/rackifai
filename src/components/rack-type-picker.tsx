import { useState, useMemo } from "react"
import { ChevronDown, X } from "lucide-react"
import { getRackCatalogTypes, type CatalogRackType } from "@/lib/rack-catalog-data"
import type { RackFormFactor, DimensionUnit, WeightUnit } from "@/store/rack-store"

interface RackTypePickerProps {
  value: string
  onChange: (rackType: string, fills: RackTypeFills | null) => void
}

export interface RackTypeFills {
  formFactor?: RackFormFactor
  uCount?: number
  widthInches?: number
  outerWidth?: number
  outerHeight?: number
  outerDepth?: number
  outerDimensionUnit?: DimensionUnit
  weight?: number
  maxWeight?: number
  weightUnit?: WeightUnit
  mountingDepth?: number
  startingUnit?: number
}

const FORM_FACTOR_MAP: Record<string, RackFormFactor> = {
  "2-post-frame": "2-post-frame",
  "4-post-cabinet": "4-post-cabinet",
  "4-post-frame": "4-post-frame",
  "wall-mount-frame": "wall-mount-frame",
  "wall-mount-frame-vertical": "wall-mount-frame-vertical",
  "wall-mount-cabinet": "wall-mount-cabinet",
  "wall-mount-cabinet-vertical": "wall-mount-cabinet-vertical",
}

const VALID_WIDTHS = new Set([10, 19, 21, 23])
const VALID_DIM_UNITS = new Set(["mm", "in"])
const VALID_WEIGHT_UNITS = new Set(["kg", "g", "lb", "oz"])

function toFills(rt: CatalogRackType): RackTypeFills {
  const fills: RackTypeFills = {}

  if (rt.formFactor && FORM_FACTOR_MAP[rt.formFactor]) {
    fills.formFactor = FORM_FACTOR_MAP[rt.formFactor]
  }
  fills.uCount = rt.uHeight
  if (rt.width != null && VALID_WIDTHS.has(rt.width)) {
    fills.widthInches = rt.width
  }
  if (rt.outerWidth != null) fills.outerWidth = rt.outerWidth
  if (rt.outerHeight != null) fills.outerHeight = rt.outerHeight
  if (rt.outerDepth != null) fills.outerDepth = rt.outerDepth
  if (rt.outerDimensionUnit && VALID_DIM_UNITS.has(rt.outerDimensionUnit)) {
    fills.outerDimensionUnit = rt.outerDimensionUnit as DimensionUnit
  }
  if (rt.weight != null) fills.weight = rt.weight
  if (rt.maxWeight != null) fills.maxWeight = rt.maxWeight
  if (rt.weightUnit && VALID_WEIGHT_UNITS.has(rt.weightUnit)) {
    fills.weightUnit = rt.weightUnit as WeightUnit
  }
  if (rt.mountingDepth != null) fills.mountingDepth = rt.mountingDepth
  if (rt.startingUnit != null) fills.startingUnit = rt.startingUnit

  return fills
}

export function RackTypePicker({ value, onChange }: RackTypePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const rackTypes = useMemo(() => getRackCatalogTypes(), [])

  const grouped = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? rackTypes.filter((rt) =>
          `${rt.manufacturer} ${rt.model} ${rt.slug}`.toLowerCase().includes(q)
        )
      : rackTypes

    const map = new Map<string, CatalogRackType[]>()
    for (const rt of filtered) {
      const list = map.get(rt.manufacturer) ?? []
      list.push(rt)
      map.set(rt.manufacturer, list)
    }
    return map
  }, [rackTypes, search])

  const displayValue = useMemo(() => {
    if (!value) return null
    const rt = rackTypes.find((r) => r.slug === value)
    return rt ? `${rt.manufacturer} ${rt.model}` : value
  }, [value, rackTypes])

  if (rackTypes.length === 0) {
    // No rack types imported yet — fall back to plain input
    return (
      <input
        className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="Optional"
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
      />
    )
  }

  function handleSelect(rt: CatalogRackType) {
    onChange(rt.slug, toFills(rt))
    setOpen(false)
    setSearch("")
  }

  function handleClear() {
    onChange("", null)
    setOpen(false)
    setSearch("")
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-accent/50 transition-colors"
      >
        <span className="truncate text-left">
          {displayValue ?? <span className="text-muted-foreground">Select rack type...</span>}
        </span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); handleClear() }}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded p-0.5 hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch("") }} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-lg">
            <div className="p-1.5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rack types..."
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto px-1 pb-1">
              {value && (
                <button
                  onClick={handleClear}
                  className="w-full px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors rounded"
                >
                  Clear selection
                </button>
              )}
              {grouped.size === 0 && (
                <p className="px-2 py-2 text-xs text-muted-foreground text-center">
                  No rack types found
                </p>
              )}
              {Array.from(grouped.entries()).map(([manufacturer, types]) => (
                <div key={manufacturer}>
                  <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {manufacturer}
                  </p>
                  {types.map((rt) => (
                    <button
                      key={rt.slug}
                      onClick={() => handleSelect(rt)}
                      className={`w-full px-2 py-1 text-left text-xs hover:bg-accent transition-colors rounded flex items-center justify-between ${
                        value === rt.slug ? "bg-accent text-accent-foreground" : "text-foreground"
                      }`}
                    >
                      <span className="truncate">{rt.model}</span>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground ml-2">
                        {rt.uHeight}U
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
