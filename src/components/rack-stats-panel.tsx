import { useState, useMemo } from "react"
import { useRackStore } from "@/store/rack-store"
import { DEVICE_COLORS, type DeviceCategory } from "@/canvas/device"

const CATEGORY_LABELS: Record<string, string> = {
  server: "Server",
  switch: "Switch",
  patch_panel: "Patch Panel",
  pdu: "PDU",
  storage: "Storage",
  ups: "UPS",
  blank: "Blank",
  other: "Other",
}

// Thresholds
const POWER_WARNING_120V_AMPS = 20
const POWER_WARNING_208V_AMPS = 30
const WEIGHT_WARNING_KG = 907 // ~2000 lbs
const CAPACITY_WARNING_PERCENT = 80

interface RackStats {
  rackId: string
  rackName: string
  uCount: number
  usedU: number
  totalPower: number
  totalWeight: number
  deviceCount: number
  categoryBreakdown: Partial<Record<DeviceCategory, number>>
}

function computeRackStats(
  rackId: string,
  rackName: string,
  uCount: number,
  devices: { uHeight: number; powerWatts: number; weightKg: number; category: DeviceCategory }[]
): RackStats {
  const categoryBreakdown: Partial<Record<DeviceCategory, number>> = {}
  let usedU = 0
  let totalPower = 0
  let totalWeight = 0

  for (const d of devices) {
    usedU += d.uHeight
    totalPower += d.powerWatts
    totalWeight += d.weightKg
    categoryBreakdown[d.category] = (categoryBreakdown[d.category] ?? 0) + 1
  }

  return {
    rackId,
    rackName,
    uCount,
    usedU,
    totalPower,
    totalWeight,
    deviceCount: devices.length,
    categoryBreakdown,
  }
}

export function RackStatsPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const racks = useRackStore((s) => s.racks)
  const devices = useRackStore((s) => s.devices)

  const stats = useMemo(() => {
    const rackIds = Object.keys(racks)
    return rackIds.map((rackId) => {
      const rack = racks[rackId]
      const rackDevices = Object.values(devices).filter((d) => d.rackId === rackId)
      return computeRackStats(rackId, rack.name, rack.uCount, rackDevices)
    })
  }, [racks, devices])

  const aggregate = useMemo(() => {
    const totals = {
      totalU: 0,
      usedU: 0,
      totalPower: 0,
      totalWeight: 0,
      deviceCount: 0,
      categoryBreakdown: {} as Partial<Record<DeviceCategory, number>>,
    }
    for (const s of stats) {
      totals.totalU += s.uCount
      totals.usedU += s.usedU
      totals.totalPower += s.totalPower
      totals.totalWeight += s.totalWeight
      totals.deviceCount += s.deviceCount
      for (const [cat, count] of Object.entries(s.categoryBreakdown)) {
        const key = cat as DeviceCategory
        totals.categoryBreakdown[key] = (totals.categoryBreakdown[key] ?? 0) + count
      }
    }
    return totals
  }, [stats])

  if (stats.length === 0) return null

  const capacityPercent = aggregate.totalU > 0 ? (aggregate.usedU / aggregate.totalU) * 100 : 0
  const amps120v = aggregate.totalPower / 120
  const amps208v = aggregate.totalPower / 208

  const powerWarning = amps120v > POWER_WARNING_120V_AMPS || amps208v > POWER_WARNING_208V_AMPS
  const weightWarning = aggregate.totalWeight > WEIGHT_WARNING_KG
  const capacityWarning = capacityPercent > CAPACITY_WARNING_PERCENT

  return (
    <div>
      {/* Centered grip handle */}
      <div className="flex justify-center items-center gap-2">
        {collapsed && powerWarning && <WarningBadge label="Power" />}
        {collapsed && weightWarning && <WarningBadge label="Weight" />}
        {collapsed && capacityWarning && <WarningBadge label="Capacity" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="group flex items-center justify-center w-20 py-1 rounded-t-lg border border-b-0 border-border/60 stats-glass text-muted-foreground hover:text-foreground transition-all"
          aria-label={collapsed ? "Show rack statistics" : "Hide rack statistics"}
        >
          <span className="flex gap-[3px]">
            <span className="w-1 h-1 rounded-full bg-current opacity-30 transition-all group-hover:bg-primary group-hover:opacity-100" />
            <span className="w-1 h-1 rounded-full bg-current opacity-30 transition-all group-hover:bg-primary group-hover:opacity-100" />
            <span className="w-1 h-1 rounded-full bg-current opacity-30 transition-all group-hover:bg-primary group-hover:opacity-100" />
            <span className="w-1 h-1 rounded-full bg-current opacity-30 transition-all group-hover:bg-primary group-hover:opacity-100" />
            <span className="w-1 h-1 rounded-full bg-current opacity-30 transition-all group-hover:bg-primary group-hover:opacity-100" />
          </span>
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 stats-glass px-4 pb-3 pt-2">
            {/* Aggregate stats */}
            <div className="grid grid-cols-4 gap-4 mb-3">
              {/* Capacity */}
              <StatCard
                label="Capacity"
                value={`${aggregate.usedU} / ${aggregate.totalU}U`}
                warning={capacityWarning}
              >
                <ProgressBar percent={capacityPercent} warning={capacityWarning} />
              </StatCard>

              {/* Power */}
              <StatCard
                label="Power"
                value={`${aggregate.totalPower.toLocaleString()}W`}
                warning={powerWarning}
              >
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {amps120v.toFixed(1)}A @ 120V · {amps208v.toFixed(1)}A @ 208V
                </div>
              </StatCard>

              {/* Weight */}
              <StatCard
                label="Weight"
                value={`${aggregate.totalWeight.toFixed(1)} kg`}
                warning={weightWarning}
              >
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {(aggregate.totalWeight * 2.205).toFixed(0)} lbs
                </div>
              </StatCard>

              {/* Device count */}
              <StatCard label="Devices" value={`${aggregate.deviceCount}`}>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(aggregate.categoryBreakdown).map(([cat, count]) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: DEVICE_COLORS[cat as DeviceCategory] }}
                      />
                      {count} {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                  ))}
                </div>
              </StatCard>
            </div>

            {/* Per-rack breakdown (only if multiple racks) */}
            {stats.length > 1 && (
              <div className="border-t border-border pt-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Per Rack
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {stats.map((s) => {
                    const pct = s.uCount > 0 ? (s.usedU / s.uCount) * 100 : 0
                    return (
                      <div key={s.rackId} className="text-xs">
                        <div className="font-medium text-foreground truncate">{s.rackName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {s.usedU}/{s.uCount}U · {s.totalPower}W · {s.deviceCount} dev
                        </div>
                        <ProgressBar percent={pct} warning={pct > CAPACITY_WARNING_PERCENT} small />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  warning,
  children,
}: {
  label: string
  value: string
  warning?: boolean
  children?: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-mono font-medium ${warning ? "text-amber-400" : "text-foreground"}`}>
        {value}
        {warning && <span className="ml-1 text-[10px]">⚠</span>}
      </div>
      {children}
    </div>
  )
}

function ProgressBar({ percent, warning, small }: { percent: number; warning?: boolean; small?: boolean }) {
  const h = small ? "h-1" : "h-1.5"
  return (
    <div className={`w-full ${h} rounded-full bg-muted/60 mt-1 overflow-hidden`}>
      <div
        className={`${h} rounded-full transition-all duration-500 ease-out ${
          warning ? "bg-amber-400 shadow-[0_0_8px_-1px_rgba(251,191,36,0.4)]" : "bg-primary shadow-[0_0_8px_-1px_rgba(37,99,235,0.3)]"
        }`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

function WarningBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
      ⚠ {label}
    </span>
  )
}
