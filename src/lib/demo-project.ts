import type { DeviceCategory } from "@/canvas/device"

/**
 * Demo project data for showcasing the tool.
 * Represents a realistic small datacenter rack with common enterprise gear.
 */
export interface DemoDevice {
  name: string
  manufacturer: string
  model: string
  uHeight: number
  isFullDepth: boolean
  startU: number
  powerWatts: number
  weightKg: number
  category: DeviceCategory
}

export const DEMO_RACK_NAME = "DC-1 Rack A01"

export const DEMO_DEVICES: DemoDevice[] = [
  // Top of rack: network switches
  {
    name: "Core Switch",
    manufacturer: "Cisco",
    model: "Catalyst 9300-48P",
    uHeight: 1,
    isFullDepth: true,
    startU: 42,
    powerWatts: 715,
    weightKg: 8.2,
    category: "switch",
  },
  {
    name: "ToR Switch",
    manufacturer: "Arista",
    model: "7050SX3-48YC8",
    uHeight: 1,
    isFullDepth: true,
    startU: 41,
    powerWatts: 350,
    weightKg: 9.1,
    category: "switch",
  },
  // Patch panel
  {
    name: "Patch Panel 48-Port",
    manufacturer: "Panduit",
    model: "CP48BLY",
    uHeight: 2,
    isFullDepth: false,
    startU: 39,
    powerWatts: 0,
    weightKg: 1.4,
    category: "patch_panel",
  },
  // Servers
  {
    name: "Web Server 1",
    manufacturer: "Dell",
    model: "PowerEdge R760",
    uHeight: 2,
    isFullDepth: true,
    startU: 37,
    powerWatts: 800,
    weightKg: 24.5,
    category: "server",
  },
  {
    name: "Web Server 2",
    manufacturer: "Dell",
    model: "PowerEdge R760",
    uHeight: 2,
    isFullDepth: true,
    startU: 35,
    powerWatts: 800,
    weightKg: 24.5,
    category: "server",
  },
  {
    name: "App Server",
    manufacturer: "HPE",
    model: "ProLiant DL380 Gen11",
    uHeight: 2,
    isFullDepth: true,
    startU: 33,
    powerWatts: 1000,
    weightKg: 22.0,
    category: "server",
  },
  {
    name: "DB Server",
    manufacturer: "Dell",
    model: "PowerEdge R760",
    uHeight: 2,
    isFullDepth: true,
    startU: 31,
    powerWatts: 1200,
    weightKg: 28.0,
    category: "server",
  },
  // Blank filler
  {
    name: "Blank Panel",
    manufacturer: "Generic",
    model: "1U Blank",
    uHeight: 1,
    isFullDepth: false,
    startU: 30,
    powerWatts: 0,
    weightKg: 0.3,
    category: "blank",
  },
  // Storage
  {
    name: "NAS Storage",
    manufacturer: "NetApp",
    model: "AFF A250",
    uHeight: 2,
    isFullDepth: true,
    startU: 28,
    powerWatts: 850,
    weightKg: 22.7,
    category: "storage",
  },
  // More servers
  {
    name: "Backup Server",
    manufacturer: "HPE",
    model: "ProLiant DL380 Gen11",
    uHeight: 2,
    isFullDepth: true,
    startU: 26,
    powerWatts: 750,
    weightKg: 22.0,
    category: "server",
  },
  // UPS
  {
    name: "UPS",
    manufacturer: "APC",
    model: "Smart-UPS SRT 5000VA",
    uHeight: 3,
    isFullDepth: true,
    startU: 3,
    powerWatts: 0,
    weightKg: 63.6,
    category: "ups",
  },
  // PDU
  {
    name: "PDU Primary",
    manufacturer: "APC",
    model: "AP8853",
    uHeight: 1,
    isFullDepth: false,
    startU: 1,
    powerWatts: 0,
    weightKg: 5.4,
    category: "pdu",
  },
  {
    name: "PDU Secondary",
    manufacturer: "APC",
    model: "AP8853",
    uHeight: 1,
    isFullDepth: false,
    startU: 2,
    powerWatts: 0,
    weightKg: 5.4,
    category: "pdu",
  },
]
