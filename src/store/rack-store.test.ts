import { describe, it, expect, beforeEach } from "vitest"
import { useRackStore } from "./rack-store"
import type { RackState, DeviceState } from "./rack-store"

function makeRack(overrides?: Partial<RackState>): RackState {
  return { id: "rack-1", name: "Rack A", uCount: 42, left: 100, top: 80, ...overrides }
}

function makeDevice(overrides?: Partial<DeviceState>): DeviceState {
  return {
    id: "dev-1",
    rackId: "rack-1",
    catalogId: "cat-1",
    name: "Server",
    manufacturer: "Dell",
    model: "R760",
    uHeight: 2,
    isFullDepth: true,
    startU: 1,
    powerWatts: 1100,
    weightKg: 28,
    category: "server",
    ...overrides,
  }
}

describe("rack-store", () => {
  beforeEach(() => {
    useRackStore.setState({
      projectName: "Test Project",
      racks: {},
      devices: {},
      selectedDeviceIds: [],
    })
    useRackStore.temporal.getState().clear()
  })

  describe("racks", () => {
    it("adds and retrieves a rack", () => {
      const { addRack } = useRackStore.getState()
      addRack(makeRack())
      expect(useRackStore.getState().racks["rack-1"]).toBeDefined()
      expect(useRackStore.getState().racks["rack-1"].name).toBe("Rack A")
    })

    it("removes a rack and its devices", () => {
      const { addRack, placeDevice, removeRack } = useRackStore.getState()
      addRack(makeRack())
      placeDevice(makeDevice())
      removeRack("rack-1")
      expect(useRackStore.getState().racks["rack-1"]).toBeUndefined()
      expect(useRackStore.getState().devices["dev-1"]).toBeUndefined()
    })

    it("updates rack properties", () => {
      const { addRack, updateRack } = useRackStore.getState()
      addRack(makeRack())
      updateRack("rack-1", { name: "Rack B" })
      expect(useRackStore.getState().racks["rack-1"].name).toBe("Rack B")
    })
  })

  describe("devices", () => {
    it("places a device", () => {
      const { addRack, placeDevice } = useRackStore.getState()
      addRack(makeRack())
      placeDevice(makeDevice())
      expect(useRackStore.getState().devices["dev-1"]).toBeDefined()
    })

    it("moves a device to a new rack and U", () => {
      const { addRack, placeDevice, moveDevice } = useRackStore.getState()
      addRack(makeRack())
      addRack(makeRack({ id: "rack-2", name: "Rack B" }))
      placeDevice(makeDevice())
      moveDevice("dev-1", "rack-2", 10)
      const dev = useRackStore.getState().devices["dev-1"]
      expect(dev.rackId).toBe("rack-2")
      expect(dev.startU).toBe(10)
    })

    it("removes a device and clears from selection", () => {
      const { addRack, placeDevice, selectDevice, removeDevice } = useRackStore.getState()
      addRack(makeRack())
      placeDevice(makeDevice())
      selectDevice("dev-1")
      removeDevice("dev-1")
      expect(useRackStore.getState().devices["dev-1"]).toBeUndefined()
      expect(useRackStore.getState().selectedDeviceIds).not.toContain("dev-1")
    })
  })

  describe("selection", () => {
    it("selects a single device", () => {
      const { selectDevice } = useRackStore.getState()
      selectDevice("dev-1")
      expect(useRackStore.getState().selectedDeviceIds).toEqual(["dev-1"])
    })

    it("additive selection toggles", () => {
      const { selectDevice } = useRackStore.getState()
      selectDevice("dev-1")
      selectDevice("dev-2", true)
      expect(useRackStore.getState().selectedDeviceIds).toEqual(["dev-1", "dev-2"])
      selectDevice("dev-1", true) // toggle off
      expect(useRackStore.getState().selectedDeviceIds).toEqual(["dev-2"])
    })

    it("clears selection", () => {
      const { selectDevice, clearSelection } = useRackStore.getState()
      selectDevice("dev-1")
      clearSelection()
      expect(useRackStore.getState().selectedDeviceIds).toEqual([])
    })
  })

  describe("undo/redo", () => {
    it("undoes device placement", () => {
      const { addRack, placeDevice } = useRackStore.getState()
      addRack(makeRack())
      placeDevice(makeDevice())
      expect(useRackStore.getState().devices["dev-1"]).toBeDefined()

      useRackStore.temporal.getState().undo()
      expect(useRackStore.getState().devices["dev-1"]).toBeUndefined()
    })

    it("redoes undone action", () => {
      const { addRack, placeDevice } = useRackStore.getState()
      addRack(makeRack())
      placeDevice(makeDevice())

      useRackStore.temporal.getState().undo()
      expect(useRackStore.getState().devices["dev-1"]).toBeUndefined()

      useRackStore.temporal.getState().redo()
      expect(useRackStore.getState().devices["dev-1"]).toBeDefined()
    })

    it("does not track selection changes in history", () => {
      const { selectDevice, clearSelection } = useRackStore.getState()
      const pastLenBefore = useRackStore.temporal.getState().pastStates.length

      selectDevice("dev-1")
      clearSelection()

      const pastLenAfter = useRackStore.temporal.getState().pastStates.length
      // Selection changes should not add to undo history
      expect(pastLenAfter).toBe(pastLenBefore)
    })
  })

  describe("computed", () => {
    it("calculates total power for a rack", () => {
      const { addRack, placeDevice, getTotalPower } = useRackStore.getState()
      addRack(makeRack())
      placeDevice(makeDevice({ id: "d1", powerWatts: 500 }))
      placeDevice(makeDevice({ id: "d2", powerWatts: 300, startU: 5 }))
      expect(getTotalPower("rack-1")).toBe(800)
    })

    it("calculates total weight for a rack", () => {
      const { addRack, placeDevice, getTotalWeight } = useRackStore.getState()
      addRack(makeRack())
      placeDevice(makeDevice({ id: "d1", weightKg: 20 }))
      placeDevice(makeDevice({ id: "d2", weightKg: 15, startU: 5 }))
      expect(getTotalWeight("rack-1")).toBe(35)
    })

    it("builds occupancy map", () => {
      const { addRack, placeDevice, getRackOccupancy } = useRackStore.getState()
      addRack(makeRack())
      placeDevice(makeDevice({ id: "d1", startU: 1, uHeight: 2 }))
      const occ = getRackOccupancy("rack-1")
      expect(occ.get(1)).toHaveLength(1)
      expect(occ.get(2)).toHaveLength(1)
      expect(occ.get(3)).toBeUndefined()
    })
  })
})
