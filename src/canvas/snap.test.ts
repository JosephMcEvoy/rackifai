import { describe, it, expect } from "vitest"
import {
  hasCollision,
  yToU,
  uToY,
  clampStartU,
  type OccupancyEntry,
} from "./snap"
import { RACK_DEFAULTS } from "./rack"

describe("yToU", () => {
  it("maps top of 42U rack (y=0) to U42", () => {
    expect(yToU(0, 42)).toBe(42)
  })

  it("maps bottom of 42U rack to U1", () => {
    const y = 41 * RACK_DEFAULTS.uHeightPx
    expect(yToU(y, 42)).toBe(1)
  })

  it("rounds to nearest U", () => {
    // Slightly below U42 boundary
    expect(yToU(5, 42)).toBe(42)
  })
})

describe("uToY", () => {
  it("U42 top edge is at y=0 in a 42U rack", () => {
    expect(uToY(42, 42)).toBe(0)
  })

  it("U1 top edge is at y = 41 * uHeightPx", () => {
    expect(uToY(1, 42)).toBe(41 * RACK_DEFAULTS.uHeightPx)
  })

  it("is inverse of yToU for aligned positions", () => {
    for (let u = 1; u <= 42; u++) {
      const y = uToY(u, 42)
      expect(yToU(y, 42)).toBe(u)
    }
  })
})

describe("clampStartU", () => {
  it("clamps below 1 to 1", () => {
    expect(clampStartU(0, 2, 42)).toBe(1)
    expect(clampStartU(-5, 1, 42)).toBe(1)
  })

  it("clamps a 4U device so it doesn't exceed rack height", () => {
    // 4U device starting at U40 would occupy U40-43 — out of bounds
    expect(clampStartU(40, 4, 42)).toBe(39)
  })

  it("allows max valid position", () => {
    // 1U device at U42 is fine
    expect(clampStartU(42, 1, 42)).toBe(42)
    // 2U device at U41 occupies U41-42 — fine
    expect(clampStartU(41, 2, 42)).toBe(41)
  })
})

describe("hasCollision", () => {
  const occupancy: OccupancyEntry[] = [
    { deviceId: "a", startU: 1, endU: 4, isFullDepth: true, face: "front" },
    { deviceId: "b", startU: 10, endU: 10, isFullDepth: true, face: "front" },
    { deviceId: "c", startU: 20, endU: 20, isFullDepth: false, face: "front" },
  ]

  it("detects collision with existing full-depth device", () => {
    expect(hasCollision(occupancy, 3, 2, true)).toBe(true)
  })

  it("allows placement in empty slot", () => {
    expect(hasCollision(occupancy, 5, 2, true)).toBe(false)
  })

  it("detects collision when new device spans into occupied range", () => {
    expect(hasCollision(occupancy, 8, 4, true)).toBe(true) // spans 8-11, overlaps 10
  })

  it("allows two half-depth devices on different faces in a 4-post rack", () => {
    expect(hasCollision(occupancy, 20, 1, false, "rear", "4-post-cabinet")).toBe(false)
  })

  it("blocks two half-depth devices on the same face", () => {
    expect(hasCollision(occupancy, 20, 1, false, "front")).toBe(true)
  })

  it("blocks full-depth device over half-depth device", () => {
    expect(hasCollision(occupancy, 20, 1, true)).toBe(true)
  })

  it("blocks half-depth device over full-depth device", () => {
    expect(hasCollision(occupancy, 10, 1, false)).toBe(true)
  })

  it("allows placement just above occupied range", () => {
    expect(hasCollision(occupancy, 5, 1, true)).toBe(false)
  })

  it("allows placement just below occupied range", () => {
    // Device "b" is at U10. Placing at U9 with 1U should be fine
    expect(hasCollision(occupancy, 9, 1, true)).toBe(false)
  })
})
