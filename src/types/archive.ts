import type { RackState, DeviceState } from "@/store/rack-store"

export type ArchivedItemType = "rack" | "device"

export interface ArchivedItem {
  id: string
  type: ArchivedItemType
  name: string
  archivedAt: number
  rackState?: RackState
  deviceStates?: DeviceState[]
  deviceState?: DeviceState
  originalRackId?: string
  category?: string
}

export interface TrashedItem extends ArchivedItem {
  trashedAt: number
}
