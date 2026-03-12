import { describe, it, expect } from "vitest"
import { createDevice, DEVICE_COLORS, type DeviceCategory } from "./device"

const baseData = {
  catalogId: "cat-1",
  name: "Dell R640",
  manufacturer: "Dell",
  model: "PowerEdge R640",
  uHeight: 1,
  isFullDepth: true,
  startU: 1,
  powerWatts: 750,
  weightKg: 18,
  category: "server" as DeviceCategory,
}

describe("createDevice", () => {
  it("creates a device group with deviceData", () => {
    const device = createDevice({ data: baseData })
    expect(device.deviceData).toBeDefined()
    expect(device.deviceData!.name).toBe("Dell R640")
    expect(device.deviceData!.category).toBe("server")
  })

  it("assigns unique IDs", () => {
    const d1 = createDevice({ data: baseData })
    const d2 = createDevice({ data: baseData })
    expect(d1.deviceData!.id).not.toBe(d2.deviceData!.id)
  })

  it("sizes correctly based on U-height", () => {
    const d1 = createDevice({ data: { ...baseData, uHeight: 1 } })
    const d2 = createDevice({ data: { ...baseData, uHeight: 2 } })
    const d4 = createDevice({ data: { ...baseData, uHeight: 4 } })
    // Heights should scale with uHeightPx (20px per U)
    expect(d1.height).toBeLessThan(d2.height!)
    expect(d2.height).toBeLessThan(d4.height!)
  })

  it("positions at specified coordinates", () => {
    const device = createDevice({
      data: baseData,
      position: { x: 50, y: 100 },
    })
    expect(device.left).toBe(50)
    expect(device.top).toBe(100)
  })

  it("supports all device categories", () => {
    for (const category of Object.keys(DEVICE_COLORS) as DeviceCategory[]) {
      const device = createDevice({
        data: { ...baseData, category },
      })
      expect(device.deviceData!.category).toBe(category)
    }
  })

  it("locks scaling and rotation", () => {
    const device = createDevice({ data: baseData })
    expect(device.lockScalingX).toBe(true)
    expect(device.lockScalingY).toBe(true)
    expect(device.lockRotation).toBe(true)
  })

  it("includes deviceData in toObject serialization", () => {
    const device = createDevice({ data: baseData })
    const obj = device.toObject() as unknown as { deviceData: { name: string; manufacturer: string } }
    expect(obj.deviceData).toBeDefined()
    expect(obj.deviceData.name).toBe("Dell R640")
    expect(obj.deviceData.manufacturer).toBe("Dell")
  })

  it("preserves all data fields", () => {
    const device = createDevice({ data: baseData })
    const dd = device.deviceData!
    expect(dd.catalogId).toBe("cat-1")
    expect(dd.manufacturer).toBe("Dell")
    expect(dd.model).toBe("PowerEdge R640")
    expect(dd.uHeight).toBe(1)
    expect(dd.isFullDepth).toBe(true)
    expect(dd.startU).toBe(1)
    expect(dd.powerWatts).toBe(750)
    expect(dd.weightKg).toBe(18)
  })
})
