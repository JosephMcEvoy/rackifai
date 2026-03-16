import { useState, useMemo } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react"
import { DEVICE_CATEGORIES, DEVICE_COLORS, type DeviceCategory } from "@/canvas/device"
import { getCatalogDevices, type CatalogDevice } from "@/lib/catalog-data"
import { Button } from "@/components/ui/button"
import { CustomDeviceForm } from "@/components/custom-device-form"
import {
  useCustomDevicesStore,
  toCatalogDevice,
  type CustomDevice,
} from "@/store/custom-devices-store"

const MAX_VISIBLE = 100

function DeviceThumbnail({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) return <div className="w-1 self-stretch rounded-full flex-shrink-0 bg-muted" />

  return (
    <img
      src={url}
      alt={alt}
      className="w-8 h-5 object-contain flex-shrink-0 rounded"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

// --- Category labels ---

const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  server: "Servers",
  switch: "Switches",
  patch_panel: "Patch Panels",
  pdu: "PDUs",
  storage: "Storage",
  ups: "UPS",
  blank: "Blanks",
  other: "Other",
}

// --- Device Card (draggable) ---

function DeviceCard({
  device,
  isCustom,
  onEdit,
  onDelete,
}: {
  device: CatalogDevice
  isCustom?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: device.catalogId,
    data: { device },
  })

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  const color = DEVICE_COLORS[device.category]

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 p-2 cursor-grab active:cursor-grabbing hover:bg-accent/60 hover:border-border transition-all duration-150"
    >
      {/* Thumbnail or category indicator */}
      {device.frontImageUrl ? (
        <DeviceThumbnail url={device.frontImageUrl} alt={device.name} />
      ) : (
        <div
          className="w-1 self-stretch rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}

      {/* Device info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-foreground truncate">
            {device.name}
          </span>
          {isCustom && (
            <span className="flex-shrink-0 rounded bg-primary/20 px-1 py-0.5 text-[9px] font-medium text-primary">
              Custom
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {device.manufacturer} {device.model}
        </div>
      </div>

      {/* U-height badge */}
      <span className="flex-shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
        {device.uHeight}U
      </span>

      {/* Power draw */}
      {device.powerWatts > 0 && (
        <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {device.powerWatts}W
        </span>
      )}

      {/* Edit/Delete buttons for custom devices */}
      {isCustom && (
        <div className="flex-shrink-0 hidden group-hover:flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Edit device"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete device"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// --- Drag Overlay (ghost preview) ---

export function DeviceDragOverlay({ device }: { device: CatalogDevice }) {
  const color = DEVICE_COLORS[device.category]
  const height = Math.max(36, device.uHeight * 20)

  return (
    <div
      className="rounded-md border-2 px-3 flex items-center gap-2 pointer-events-none shadow-lg"
      style={{
        borderColor: color,
        backgroundColor: `${color}33`,
        height,
        width: 260,
      }}
    >
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-medium text-foreground truncate">
        {device.name}
      </span>
      <span className="ml-auto text-[10px] font-mono text-muted-foreground">
        {device.uHeight}U
      </span>
    </div>
  )
}

// --- Main Catalog Component ---

export function DeviceCatalog() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<DeviceCategory | "all">("all")
  const [activeManufacturer, setActiveManufacturer] = useState<string>("all")
  const [mfgDropdownOpen, setMfgDropdownOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<CustomDevice | null>(null)

  const customDevices = useCustomDevicesStore((s) => s.devices)
  const removeCustomDevice = useCustomDevicesStore((s) => s.removeDevice)

  const catalogDevices = useMemo(() => getCatalogDevices(), [])

  // Merge built-in and custom devices for filtering
  const allDevices = useMemo(() => {
    const customs: CatalogDevice[] = customDevices.map(toCatalogDevice)
    return [...catalogDevices, ...customs]
  }, [catalogDevices, customDevices])

  // Set of custom catalogIds for quick lookup
  const customIds = useMemo(
    () => new Set(customDevices.map((d) => d.catalogId)),
    [customDevices]
  )

  // Sorted list of manufacturers for dropdown
  const manufacturers = useMemo(() => {
    const set = new Set<string>()
    for (const d of catalogDevices) set.add(d.manufacturer)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [catalogDevices])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allDevices.filter((d) => {
      if (activeCategory !== "all" && d.category !== activeCategory) return false
      if (activeManufacturer !== "all" && d.manufacturer !== activeManufacturer) return false
      if (q && !`${d.name} ${d.manufacturer} ${d.model}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [search, activeCategory, activeManufacturer, allDevices])

  // Group by manufacturer, custom devices first as a separate section
  // Limit total rendered devices for performance
  const { customFiltered, builtinGrouped, totalCount, visibleCount } = useMemo(() => {
    const custom: CatalogDevice[] = []
    const builtin: CatalogDevice[] = []
    for (const d of filtered) {
      if (customIds.has(d.catalogId)) {
        custom.push(d)
      } else {
        builtin.push(d)
      }
    }

    const map = new Map<string, CatalogDevice[]>()
    let visible = custom.length
    for (const d of builtin) {
      if (visible >= MAX_VISIBLE) break
      const list = map.get(d.manufacturer) ?? []
      list.push(d)
      map.set(d.manufacturer, list)
      visible++
    }
    return {
      customFiltered: custom,
      builtinGrouped: map,
      totalCount: custom.length + builtin.length,
      visibleCount: visible,
    }
  }, [filtered, customIds])

  // Categories with counts (include custom devices)
  const categoriesWithCounts = useMemo(() => {
    const counts = new Map<DeviceCategory, number>()
    for (const d of allDevices) {
      counts.set(d.category, (counts.get(d.category) ?? 0) + 1)
    }
    return DEVICE_CATEGORIES
      .filter((c) => (counts.get(c) ?? 0) > 0)
      .map((c) => ({ category: c, count: counts.get(c) ?? 0 }))
  }, [allDevices])

  function handleEdit(catalogId: string) {
    const device = customDevices.find((d) => d.catalogId === catalogId)
    if (device) {
      setEditingDevice(device)
      setFormOpen(true)
    }
  }

  function handleDelete(catalogId: string) {
    removeCustomDevice(catalogId)
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open)
    if (!open) setEditingDevice(null)
  }

  const hasActiveFilter = search.length > 0 || activeCategory !== "all" || activeManufacturer !== "all"

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Device Catalog
          </h2>
          <span className="text-[10px] text-muted-foreground/70 tabular-nums font-mono">
            {allDevices.length.toLocaleString()}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search devices..."
            className="w-full rounded-lg border border-input/60 bg-background/60 pl-8 pr-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      {/* Manufacturer dropdown */}
      <div className="px-3 pb-2 relative">
        <button
          onClick={() => setMfgDropdownOpen(!mfgDropdownOpen)}
          className="w-full flex items-center justify-between rounded-lg border border-input/60 bg-background/60 px-2.5 py-1.5 text-xs text-foreground hover:bg-accent/50 hover:border-border transition-all"
        >
          <span className="truncate">
            {activeManufacturer === "all"
              ? `All manufacturers (${manufacturers.length})`
              : activeManufacturer}
          </span>
          <ChevronDown className={`h-3 w-3 flex-shrink-0 text-muted-foreground transition-transform ${mfgDropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {mfgDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMfgDropdownOpen(false)}
            />
            <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              <button
                onClick={() => { setActiveManufacturer("all"); setMfgDropdownOpen(false) }}
                className={`w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent transition-colors ${activeManufacturer === "all" ? "bg-accent text-accent-foreground" : "text-foreground"}`}
              >
                All manufacturers
              </button>
              {manufacturers.map((mfg) => (
                <button
                  key={mfg}
                  onClick={() => { setActiveManufacturer(mfg); setMfgDropdownOpen(false) }}
                  className={`w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent transition-colors ${activeManufacturer === mfg ? "bg-accent text-accent-foreground" : "text-foreground"}`}
                >
                  {mfg}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all duration-150 ${
            activeCategory === "all"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
              : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          All
        </button>
        {categoriesWithCounts.map(({ category, count }) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all duration-150 ${
              activeCategory === category
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {CATEGORY_LABELS[category]} <span className="opacity-60">{count}</span>
          </button>
        ))}
      </div>

      {/* Device list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* Prompt to search when no filters active */}
        {!hasActiveFilter && totalCount > MAX_VISIBLE && (
          <p className="text-[10px] text-muted-foreground py-2 text-center italic">
            Search or filter to narrow {totalCount.toLocaleString()} devices
          </p>
        )}

        {/* Custom devices section */}
        {customFiltered.length > 0 && (
          <div className="mb-3">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Custom Devices
            </h3>
            <div className="flex flex-col gap-1">
              {customFiltered.map((device) => (
                <DeviceCard
                  key={device.catalogId}
                  device={device}
                  isCustom
                  onEdit={() => handleEdit(device.catalogId)}
                  onDelete={() => handleDelete(device.catalogId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Built-in devices */}
        {builtinGrouped.size === 0 && customFiltered.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No devices found
          </p>
        )}
        {Array.from(builtinGrouped.entries()).map(([manufacturer, devices]) => (
          <div key={manufacturer} className="mb-3">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {manufacturer}
            </h3>
            <div className="flex flex-col gap-1">
              {devices.map((device) => (
                <DeviceCard key={device.catalogId} device={device} />
              ))}
            </div>
          </div>
        ))}

        {/* Truncation notice */}
        {visibleCount < totalCount && (
          <p className="text-[10px] text-muted-foreground py-2 text-center">
            Showing {visibleCount} of {totalCount.toLocaleString()} results — refine your search to see more
          </p>
        )}
      </div>

      {/* Add Custom Device button */}
      <div className="border-t border-border/60 p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
          onClick={() => {
            setEditingDevice(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Custom Device
        </Button>
      </div>

      {/* Custom device form dialog */}
      <CustomDeviceForm
        open={formOpen}
        onOpenChange={handleFormClose}
        editDevice={editingDevice}
      />
    </div>
  )
}
