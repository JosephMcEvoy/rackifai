import { DeviceCatalog } from "@/components/device-catalog"

const SIDEBAR_WIDTH = 280 as const

export function Sidebar() {
  return (
    <aside
      className="flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden shadow-[4px_0_24px_-8px_rgba(0,0,0,0.3)]"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <DeviceCatalog />
    </aside>
  )
}
