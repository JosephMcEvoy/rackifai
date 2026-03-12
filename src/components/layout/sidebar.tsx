import { DeviceCatalog } from "@/components/device-catalog"

const SIDEBAR_WIDTH = 280 as const

export function Sidebar() {
  return (
    <aside
      className="flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <DeviceCatalog />
    </aside>
  )
}
