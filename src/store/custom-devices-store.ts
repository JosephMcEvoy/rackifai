import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { DeviceCategory } from "@/canvas/device"
import type { CatalogDevice } from "@/lib/catalog-data"

export interface CustomDevice {
  catalogId: string
  name: string
  manufacturer: string
  model: string
  uHeight: number
  isFullDepth: boolean
  category: DeviceCategory
  powerWatts: number
  weightKg: number
  color: string
  notes: string
}

interface CustomDevicesState {
  devices: CustomDevice[]
  addDevice: (device: CustomDevice) => void
  updateDevice: (catalogId: string, device: CustomDevice) => void
  removeDevice: (catalogId: string) => void
}

export const useCustomDevicesStore = create<CustomDevicesState>()(
  persist(
    (set) => ({
      devices: [],

      addDevice: (device) =>
        set((state) => ({
          devices: [...state.devices, device],
        })),

      updateDevice: (catalogId, device) =>
        set((state) => ({
          devices: state.devices.map((d) =>
            d.catalogId === catalogId ? device : d
          ),
        })),

      removeDevice: (catalogId) =>
        set((state) => ({
          devices: state.devices.filter((d) => d.catalogId !== catalogId),
        })),
    }),
    {
      name: "rackifai-custom-devices",
    }
  )
)

/** Convert a CustomDevice to a CatalogDevice for drag-and-drop compatibility. */
export function toCatalogDevice(custom: CustomDevice): CatalogDevice {
  return {
    catalogId: custom.catalogId,
    name: custom.name,
    manufacturer: custom.manufacturer,
    model: custom.model,
    uHeight: custom.uHeight,
    isFullDepth: custom.isFullDepth,
    category: custom.category,
    powerWatts: custom.powerWatts,
    weightKg: custom.weightKg,
    frontImageUrl: null,
    rearImageUrl: null,
  }
}
