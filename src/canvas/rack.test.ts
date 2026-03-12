import { describe, it, expect } from "vitest"
import { createRack } from "./rack"

describe("createRack", () => {
  it("creates a group with default 42U size", () => {
    const rack = createRack()
    expect(rack.rackData).toBeDefined()
    expect(rack.rackData!.uCount).toBe(42)
    expect(rack.rackData!.name).toBe("Rack")
  })

  it("creates a rack with custom options", () => {
    const rack = createRack({ uCount: 24, name: "Test Rack" })
    expect(rack.rackData!.uCount).toBe(24)
    expect(rack.rackData!.name).toBe("Test Rack")
  })

  it("assigns unique IDs", () => {
    const rack1 = createRack()
    const rack2 = createRack()
    expect(rack1.rackData!.id).not.toBe(rack2.rackData!.id)
  })

  it("positions rack at specified coordinates (snapped to 10px grid)", () => {
    const rack = createRack({ position: { x: 200, y: 100 } })
    expect(rack.left).toBe(200)
    expect(rack.top).toBe(100)
  })

  it("locks scaling on both axes", () => {
    const rack = createRack()
    expect(rack.lockScalingX).toBe(true)
    expect(rack.lockScalingY).toBe(true)
  })

  it("enables interactive and subTargetCheck for IText editing", () => {
    const rack = createRack()
    expect(rack.subTargetCheck).toBe(true)
    expect(rack.interactive).toBe(true)
  })

  it("supports all rack sizes", () => {
    for (const size of [24, 42, 48] as const) {
      const rack = createRack({ uCount: size })
      expect(rack.rackData!.uCount).toBe(size)
    }
  })

  it("includes rackData in toObject serialization", () => {
    const rack = createRack({ name: "Serialized" })
    const obj = rack.toObject() as unknown as { rackData: { name: string } }
    expect(obj.rackData).toBeDefined()
    expect(obj.rackData.name).toBe("Serialized")
  })
})
