import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { devtools, subscribeWithSelector } from "zustand/middleware"
import { temporal } from "zundo"
import type { DeviceCategory } from "@/canvas/device"
import type { ArchivedItem, TrashedItem } from "@/types/archive"

// --- Random project name generator ---

const ADJECTIVES = [
  "Crimson", "Velvet", "Silent", "Golden", "Cosmic", "Frozen", "Mighty",
  "Swift", "Blazing", "Gentle", "Noble", "Clever", "Brave", "Vivid",
  "Calm", "Dizzy", "Lucky", "Rusty", "Shiny", "Jolly", "Witty",
  "Fluffy", "Snappy", "Zesty", "Breezy", "Dapper", "Mellow", "Plucky",
]

const NOUNS = [
  "Falcon", "Panda", "Cactus", "Comet", "Otter", "Maple", "Penguin",
  "Thunder", "Compass", "Lantern", "Dolphin", "Bison", "Crystal", "Ember",
  "Acorn", "Badger", "Walrus", "Mango", "Parrot", "Rocket", "Tundra",
  "Marble", "Pickle", "Waffle", "Moose", "Turnip", "Goblet", "Sprout",
]

const SUFFIXES = [
  "Express", "Station", "Project", "Outpost", "Summit", "Circuit", "Cluster",
  "Depot", "Venture", "Forge", "Vault", "Nexus", "Haven", "Workshop",
  "Grid", "Lodge", "Hub", "Lab", "Base", "Zone", "Port", "Deck",
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateProjectName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(SUFFIXES)}`
}

// --- Types ---

// --- Rack enums ---

export const RACK_STATUSES = ["active", "planned", "reserved", "available", "deprecated"] as const
export type RackStatus = (typeof RACK_STATUSES)[number]

export const RACK_AIRFLOWS = ["front-to-rear", "rear-to-front"] as const
export type RackAirflow = (typeof RACK_AIRFLOWS)[number]

// --- Device enums ---

export const DEVICE_AIRFLOWS = [
  "front-to-rear",
  "rear-to-front",
  "left-to-right",
  "right-to-left",
  "side-to-rear",
  "rear-to-side",
  "bottom-to-top",
  "top-to-bottom",
  "passive",
  "mixed",
] as const
export type DeviceAirflow = (typeof DEVICE_AIRFLOWS)[number]

export const DEVICE_STATUSES = [
  "active",
  "offline",
  "planned",
  "staged",
  "failed",
  "inventory",
  "decommissioning",
] as const
export type DeviceStatus = (typeof DEVICE_STATUSES)[number]

export const DEVICE_FACES = ["front", "rear"] as const
export type DeviceFace = (typeof DEVICE_FACES)[number]

export const RACK_FORM_FACTORS = [
  "2-post-frame",
  "4-post-cabinet",
  "4-post-frame",
  "wall-mount-frame",
  "wall-mount-frame-vertical",
  "wall-mount-cabinet",
  "wall-mount-cabinet-vertical",
] as const
export type RackFormFactor = (typeof RACK_FORM_FACTORS)[number]

export const RACK_WIDTHS = [10, 19, 21, 23] as const
export type RackWidth = (typeof RACK_WIDTHS)[number]

export const DIMENSION_UNITS = ["mm", "in"] as const
export type DimensionUnit = (typeof DIMENSION_UNITS)[number]

export const WEIGHT_UNITS = ["kg", "g", "lb", "oz"] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]

export interface RackState {
  id: string
  name: string
  uCount: number

  // Canvas position (for undo/redo reconstruction)
  left: number
  top: number

  // Rack
  site?: string
  location?: string
  status?: RackStatus
  role?: string
  rackType?: string
  description?: string
  airflow?: RackAirflow
  tags?: string[]

  // Inventory Control
  facilityId?: string
  serialNumber?: string
  assetTag?: string

  // Tenancy
  tenantGroup?: string
  tenant?: string

  // Dimensions
  formFactor?: RackFormFactor
  widthInches?: number
  startingUnit?: number
  outerWidth?: number
  outerHeight?: number
  outerDepth?: number
  outerDimensionUnit?: DimensionUnit
  weight?: number
  maxWeight?: number
  weightUnit?: WeightUnit
  mountingDepth?: number
  descendingUnits?: boolean

  // Ownership
  ownerGroup?: string
  owner?: string

  // Other
  comments?: string

  // Collision
  allowOverlap?: boolean
}

export interface DeviceState {
  id: string
  rackId: string
  catalogId: string
  name: string
  manufacturer: string
  model: string
  uHeight: number
  isFullDepth: boolean
  startU: number
  powerWatts: number
  weightKg: number
  category: DeviceCategory

  // Device
  deviceRole?: string
  description?: string
  tags?: string[]

  // Hardware
  deviceType?: string
  airflow?: DeviceAirflow
  serialNumber?: string
  assetTag?: string

  // Location
  site?: string
  location?: string
  face?: DeviceFace
  latitude?: number
  longitude?: number

  // Management
  status?: DeviceStatus
  platform?: string
  configTemplate?: string

  // Virtualization
  cluster?: string

  // Tenancy
  tenantGroup?: string
  tenant?: string

  // Virtual Chassis
  virtualChassis?: string
  vcPosition?: number
  vcPriority?: number

  // Ownership
  ownerGroup?: string
  owner?: string

  // Other
  comments?: string
  localConfigContext?: string
}

export interface OccupancySlot {
  deviceId: string
  isFullDepth: boolean
  face: DeviceFace
}

interface RackStoreState {
  // Project
  projectName: string

  // Racks
  racks: Record<string, RackState>

  // Devices
  devices: Record<string, DeviceState>

  // Dirty tracking — incremented on every data mutation, used by autosave.
  // O(1) equality check replaces O(n) JSON.stringify comparison.
  _generation: number

  // Selection (excluded from undo history)
  selectedDeviceIds: string[]

  // Archive (excluded from undo history)
  archivedItems: ArchivedItem[]

  // Trash (excluded from undo history)
  trashedItems: TrashedItem[]

  // View state (excluded from undo history)
  viewFace: DeviceFace
  showDeviceImages: boolean
  showGrid: boolean
}

interface RackStoreActions {
  // Project
  setProjectName: (name: string) => void

  // Racks
  addRack: (rack: RackState) => void
  removeRack: (rackId: string) => void
  updateRack: (rackId: string, updates: Partial<RackState>) => void

  // Devices
  placeDevice: (device: DeviceState) => void
  moveDevice: (deviceId: string, targetRackId: string, targetU: number) => void
  batchMoveDevices: (moves: Array<{ deviceId: string; rackId: string; startU: number }>) => void
  removeDevice: (deviceId: string) => void
  updateDevice: (deviceId: string, updates: Partial<DeviceState>) => void

  // View
  setViewFace: (face: DeviceFace) => void
  setShowDeviceImages: (show: boolean) => void
  setShowGrid: (show: boolean) => void

  // Selection
  selectDevice: (id: string, additive?: boolean) => void
  selectDevices: (ids: string[]) => void
  clearSelection: () => void

  // Archive
  archiveRack: (rackId: string) => void
  archiveDevice: (deviceId: string) => void
  restoreItem: (archiveId: string) => void
  permanentDelete: (archiveId: string) => void
  batchArchive: (items: Array<{ id: string; type: "rack" | "device" }>) => void

  // Trash
  trashItem: (archiveId: string) => void
  restoreFromTrash: (trashId: string) => void
  permanentDeleteFromTrash: (trashId: string) => void
  emptyTrash: () => void
  purgeExpiredTrash: () => void

  // Computed helpers
  getRackDevices: (rackId: string) => DeviceState[]
  getRackOccupancy: (rackId: string) => Map<number, OccupancySlot[]>
  getTotalPower: (rackId: string) => number
  getTotalWeight: (rackId: string) => number
}

export type RackStore = RackStoreState & RackStoreActions

export const useRackStore = create<RackStore>()(
  devtools(
    subscribeWithSelector(
      temporal(
        immer((set, get) => ({
          // Initial state
          projectName: "",
          racks: {},
          devices: {},
          _generation: 0,
          selectedDeviceIds: [],
          archivedItems: [],
          trashedItems: [],
          viewFace: "front" as DeviceFace,
          showDeviceImages: false,
          showGrid: true,

          // Project
          setProjectName: (name) =>
            set((state) => {
              state.projectName = name
              state._generation++
            }),

          // Racks
          addRack: (rack) =>
            set((state) => {
              state.racks[rack.id] = {
                ...rack,
                formFactor: rack.formFactor ?? "4-post-cabinet",
                widthInches: rack.widthInches ?? 19,
              }
              state._generation++
            }),

          removeRack: (rackId) =>
            set((state) => {
              delete state.racks[rackId]
              for (const [id, device] of Object.entries(state.devices)) {
                if (device.rackId === rackId) {
                  delete state.devices[id]
                  state.selectedDeviceIds = state.selectedDeviceIds.filter((sid) => sid !== id)
                }
              }
              state._generation++
            }),

          updateRack: (rackId, updates) =>
            set((state) => {
              const rack = state.racks[rackId]
              if (!rack) return
              const oldUCount = rack.uCount
              Object.assign(rack, updates)
              // Remove devices that no longer fit when uCount shrinks
              const newUCount = rack.uCount
              if (newUCount < oldUCount) {
                for (const [id, device] of Object.entries(state.devices)) {
                  if (device.rackId !== rackId) continue
                  if (device.startU + device.uHeight - 1 > newUCount) {
                    delete state.devices[id]
                    state.selectedDeviceIds = state.selectedDeviceIds.filter((sid) => sid !== id)
                  }
                }
              }
              state._generation++
            }),

          // View
          setViewFace: (face) =>
            set((state) => {
              state.viewFace = face
            }),
          setShowDeviceImages: (show) =>
            set((state) => {
              state.showDeviceImages = show
            }),
          setShowGrid: (show) =>
            set((state) => {
              state.showGrid = show
            }),

          // Devices
          placeDevice: (device) =>
            set((state) => {
              state.devices[device.id] = { ...device, face: device.face ?? "front" }
              state._generation++
            }),

          moveDevice: (deviceId, targetRackId, targetU) =>
            set((state) => {
              const device = state.devices[deviceId]
              if (device) {
                device.rackId = targetRackId
                device.startU = targetU
                state._generation++
              }
            }),

          batchMoveDevices: (moves) =>
            set((state) => {
              for (const move of moves) {
                const device = state.devices[move.deviceId]
                if (device) {
                  device.rackId = move.rackId
                  device.startU = move.startU
                }
              }
              state._generation++
            }),

          removeDevice: (deviceId) =>
            set((state) => {
              delete state.devices[deviceId]
              state.selectedDeviceIds = state.selectedDeviceIds.filter((id) => id !== deviceId)
              state._generation++
            }),

          updateDevice: (deviceId, updates) =>
            set((state) => {
              const device = state.devices[deviceId]
              if (device) {
                Object.assign(device, updates)
                state._generation++
              }
            }),

          // Selection
          selectDevice: (id, additive = false) =>
            set((state) => {
              if (additive) {
                const idx = state.selectedDeviceIds.indexOf(id)
                if (idx >= 0) {
                  state.selectedDeviceIds.splice(idx, 1)
                } else {
                  state.selectedDeviceIds.push(id)
                }
              } else {
                state.selectedDeviceIds = [id]
              }
            }),

          selectDevices: (ids) =>
            set((state) => {
              state.selectedDeviceIds = ids
            }),

          clearSelection: () =>
            set((state) => {
              state.selectedDeviceIds = []
            }),

          // Archive
          archiveRack: (rackId) =>
            set((state) => {
              const rack = state.racks[rackId]
              if (!rack) return
              const childDevices = Object.values(state.devices).filter((d) => d.rackId === rackId)

              // Enforce 50-item cap — purge oldest if needed
              while (state.archivedItems.length >= 50) {
                state.archivedItems.shift()
              }

              state.archivedItems.push({
                id: crypto.randomUUID(),
                type: "rack",
                name: rack.name,
                archivedAt: Date.now(),
                rackState: rack,
                deviceStates: childDevices,
              })

              // Remove from active state
              childDevices.forEach((d) => {
                delete state.devices[d.id]
                state.selectedDeviceIds = state.selectedDeviceIds.filter((sid) => sid !== d.id)
              })
              delete state.racks[rackId]
              state._generation++
            }),

          archiveDevice: (deviceId) =>
            set((state) => {
              const device = state.devices[deviceId]
              if (!device) return

              while (state.archivedItems.length >= 50) {
                state.archivedItems.shift()
              }

              state.archivedItems.push({
                id: crypto.randomUUID(),
                type: "device",
                name: device.name,
                archivedAt: Date.now(),
                deviceState: device,
                originalRackId: device.rackId,
                category: device.category,
              })

              delete state.devices[deviceId]
              state.selectedDeviceIds = state.selectedDeviceIds.filter((sid) => sid !== deviceId)
              state._generation++
            }),

          restoreItem: (archiveId) =>
            set((state) => {
              const idx = state.archivedItems.findIndex((i) => i.id === archiveId)
              if (idx === -1) return
              const item = state.archivedItems[idx]

              if (item.type === "rack" && item.rackState) {
                state.racks[item.rackState.id] = item.rackState
                item.deviceStates?.forEach((d) => {
                  state.devices[d.id] = d
                })
              } else if (item.type === "device" && item.deviceState) {
                state.devices[item.deviceState.id] = item.deviceState
              }

              state.archivedItems.splice(idx, 1)
              state._generation++
            }),

          permanentDelete: (archiveId) =>
            set((state) => {
              state.archivedItems = state.archivedItems.filter((i) => i.id !== archiveId)
              state._generation++
            }),

          batchArchive: (items) =>
            set((state) => {
              const rackIds = items.filter((i) => i.type === "rack").map((i) => i.id)
              const deviceIds = items.filter((i) => i.type === "device").map((i) => i.id)

              // Filter out devices that belong to archived racks
              const standaloneDeviceIds = deviceIds.filter((did) => {
                const d = state.devices[did]
                return d && !rackIds.includes(d.rackId)
              })

              // Archive racks
              for (const rackId of rackIds) {
                const rack = state.racks[rackId]
                if (!rack) continue
                const childDevices = Object.values(state.devices).filter((d) => d.rackId === rackId)

                while (state.archivedItems.length >= 50) {
                  state.archivedItems.shift()
                }

                state.archivedItems.push({
                  id: crypto.randomUUID(),
                  type: "rack",
                  name: rack.name,
                  archivedAt: Date.now(),
                  rackState: rack,
                  deviceStates: childDevices,
                })

                childDevices.forEach((d) => {
                  delete state.devices[d.id]
                  state.selectedDeviceIds = state.selectedDeviceIds.filter((sid) => sid !== d.id)
                })
                delete state.racks[rackId]
              }

              // Archive standalone devices
              for (const deviceId of standaloneDeviceIds) {
                const device = state.devices[deviceId]
                if (!device) continue

                while (state.archivedItems.length >= 50) {
                  state.archivedItems.shift()
                }

                state.archivedItems.push({
                  id: crypto.randomUUID(),
                  type: "device",
                  name: device.name,
                  archivedAt: Date.now(),
                  deviceState: device,
                  originalRackId: device.rackId,
                  category: device.category,
                })

                delete state.devices[deviceId]
                state.selectedDeviceIds = state.selectedDeviceIds.filter((sid) => sid !== deviceId)
              }
              state._generation++
            }),

          // Trash
          trashItem: (archiveId) =>
            set((state) => {
              const idx = state.archivedItems.findIndex((i) => i.id === archiveId)
              if (idx === -1) return
              const item = state.archivedItems[idx]
              // Cap at 100 items (FIFO)
              while (state.trashedItems.length >= 100) {
                state.trashedItems.shift()
              }
              state.trashedItems.push({ ...item, trashedAt: Date.now() })
              state.archivedItems.splice(idx, 1)
              state._generation++
            }),

          restoreFromTrash: (trashId) =>
            set((state) => {
              const idx = state.trashedItems.findIndex((i) => i.id === trashId)
              if (idx === -1) return
              const item = state.trashedItems[idx]
              // Move back to archivedItems (strip trashedAt)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { trashedAt: _, ...archived } = item
              state.archivedItems.push(archived)
              state.trashedItems.splice(idx, 1)
              state._generation++
            }),

          permanentDeleteFromTrash: (trashId) =>
            set((state) => {
              state.trashedItems = state.trashedItems.filter((i) => i.id !== trashId)
              state._generation++
            }),

          emptyTrash: () =>
            set((state) => {
              state.trashedItems = []
              state._generation++
            }),

          purgeExpiredTrash: () =>
            set((state) => {
              const sevenDays = 7 * 24 * 60 * 60 * 1000
              const now = Date.now()
              state.trashedItems = state.trashedItems.filter(
                (i) => now - i.trashedAt <= sevenDays,
              )
            }),

          // Computed helpers
          getRackDevices: (rackId) => {
            const { devices } = get()
            return Object.values(devices).filter((d) => d.rackId === rackId)
          },

          getRackOccupancy: (rackId) => {
            const devices = get().getRackDevices(rackId)
            const map = new Map<number, OccupancySlot[]>()
            for (const device of devices) {
              for (let u = device.startU; u < device.startU + device.uHeight; u++) {
                const slots = map.get(u) ?? []
                slots.push({ deviceId: device.id, isFullDepth: device.isFullDepth, face: device.face ?? "front" })
                map.set(u, slots)
              }
            }
            return map
          },

          getTotalPower: (rackId) => {
            return get()
              .getRackDevices(rackId)
              .reduce((sum, d) => sum + d.powerWatts, 0)
          },

          getTotalWeight: (rackId) => {
            return get()
              .getRackDevices(rackId)
              .reduce((sum, d) => sum + d.weightKg, 0)
          },
        })),
        {
          // Only track rack/device state for undo, not selection/UI state
          partialize: (state) => ({
            projectName: state.projectName,
            racks: state.racks,
            devices: state.devices,
            _generation: state._generation,
          } as Pick<RackStoreState, "projectName" | "racks" | "devices" | "_generation">),
          // Skip recording if _generation hasn't changed (e.g. selection-only changes)
          equality: (pastState, currentState) =>
            (pastState as { _generation?: number })._generation === (currentState as { _generation?: number })._generation,
          limit: 50,
        }
      )
    ),
    { name: "rackifai.com", enabled: import.meta.env.DEV }
  )
)

// When undo/redo restores a device or rack to active state, remove the stale archive entry.
// (archivedItems is excluded from temporal, so it doesn't roll back automatically.)
useRackStore.subscribe((state, prevState) => {
  if (state.devices === prevState.devices && state.racks === prevState.racks) return
  if (state.archivedItems.length === 0) return

  const staleIds: string[] = []
  for (const item of state.archivedItems) {
    if (item.type === "device" && item.deviceState && item.deviceState.id in state.devices) {
      staleIds.push(item.id)
    } else if (item.type === "rack" && item.rackState && item.rackState.id in state.racks) {
      staleIds.push(item.id)
    }
  }

  if (staleIds.length > 0) {
    const idSet = new Set(staleIds)
    useRackStore.setState({
      archivedItems: state.archivedItems.filter((item) => !idSet.has(item.id)),
    })
  }
})

// --- Selector hooks ---

export function useRack(id: string) {
  return useRackStore((s) => s.racks[id])
}

export function useDevice(id: string) {
  return useRackStore((s) => s.devices[id])
}

export function useSelectedDeviceIds() {
  return useRackStore((s) => s.selectedDeviceIds)
}

// --- Undo/Redo helpers ---

/** Access the temporal store for undo/redo operations. */
export function useTemporalStore() {
  return useRackStore.temporal
}
