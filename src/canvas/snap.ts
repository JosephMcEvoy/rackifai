import type { Group } from "fabric"
import { RACK_DEFAULTS, type RackData } from "./rack"
import { useRackStore, type DeviceFace, type RackFormFactor } from "@/store/rack-store"

// --- Types ---

export interface OccupancyEntry {
  deviceId: string
  startU: number
  endU: number // inclusive: startU + uHeight - 1
  isFullDepth: boolean
  face: DeviceFace
}

export interface SnapResult {
  valid: boolean
  rackId: string
  startU: number
  /** Pixel position relative to rack group origin */
  snapY: number
}

// --- Occupancy helpers ---

/** Build an occupancy list for a rack from the store (devices are top-level canvas objects, not rack group children). */
export function getOccupancy(
  rackId: string,
  excludeDeviceId?: string
): OccupancyEntry[] {
  const { devices } = useRackStore.getState()
  const entries: OccupancyEntry[] = []
  for (const ds of Object.values(devices)) {
    if (ds.rackId !== rackId || ds.id === excludeDeviceId) continue
    entries.push({
      deviceId: ds.id,
      startU: ds.startU,
      endU: ds.startU + ds.uHeight - 1,
      isFullDepth: ds.isFullDepth,
      face: ds.face ?? "front",
    })
  }
  return entries
}

/** Check whether a proposed placement collides with existing devices. */
export function hasCollision(
  occupancy: OccupancyEntry[],
  startU: number,
  uHeight: number,
  isFullDepth: boolean,
  face: DeviceFace = "front",
  rackFormFactor?: RackFormFactor
): boolean {
  const endU = startU + uHeight - 1
  for (const entry of occupancy) {
    // No vertical overlap → no collision
    if (endU < entry.startU || startU > entry.endU) continue
    // Either device is full-depth → always collision
    if (isFullDepth || entry.isFullDepth) return true
    // Both half-depth, same face → collision
    if (face === entry.face) return true
    // Both half-depth, different faces:
    // 2-post racks have no rear rail → collision even with different faces
    if (!rackFormFactor || rackFormFactor.startsWith("2-post")) return true
    // 4-post rack with different faces → no collision (front + rear can coexist)
  }
  return false
}

/** Convert a canvas-Y coordinate (relative to the rack group origin) to a U-number. */
export function yToU(y: number, uCount: number): number {
  // y=0 is top of rack (U=uCount), y=rackHeight is bottom (U=1)
  const rawU = uCount - y / RACK_DEFAULTS.uHeightPx
  return Math.round(rawU)
}

/** Convert a U-number to canvas-Y (top edge of that U-slot, relative to rack origin). */
export function uToY(startU: number, uCount: number): number {
  // U1 is at bottom → y = (uCount - 1) * uHeightPx
  return (uCount - startU) * RACK_DEFAULTS.uHeightPx
}

/** Clamp startU so the device fits within the rack. */
export function clampStartU(startU: number, uHeight: number, uCount: number): number {
  return Math.max(1, Math.min(uCount - uHeight + 1, startU))
}

// --- Snap target resolution ---

/**
 * Given a canvas-Y position within a rack, determine the best snap target.
 * The Y is relative to the rack group's coordinate origin (top-left of frame).
 */
export function resolveSnap(
  rackGroup: Group,
  canvasY: number,
  uHeight: number,
  isFullDepth: boolean,
  face: DeviceFace = "front",
  rackFormFactor?: RackFormFactor,
  excludeDeviceId?: string,
  allowOverlap?: boolean
): SnapResult {
  const rd = rackGroup.rackData as RackData
  const uCount = rd.uCount

  // Rear-face devices can't mount on 2-post racks (no rear rail)
  if (face === "rear" && (!rackFormFactor || rackFormFactor.startsWith("2-post"))) {
    const snapY = uToY(uHeight, uCount)
    return { valid: false, rackId: rd.id, startU: 1, snapY }
  }

  // Convert pointer Y to U-number (bottom of the device)
  // Pointer targets the vertical center of the device
  const centerOffsetU = uHeight / 2
  const rawU = yToU(canvasY, uCount) - centerOffsetU + 1
  const startU = clampStartU(Math.round(rawU), uHeight, uCount)

  const occupancy = getOccupancy(rd.id, excludeDeviceId)
  const valid = allowOverlap || !hasCollision(occupancy, startU, uHeight, isFullDepth, face, rackFormFactor)

  // Top edge pixel position for the device within the rack
  // Device top is at the top of startU+uHeight-1 (the topmost U it occupies)
  const snapY = uToY(startU + uHeight - 1, uCount)

  return { valid, rackId: rd.id, startU, snapY }
}

// --- Auto-shift algorithm ---

export interface ShiftResult {
  shifts: Array<{ deviceId: string; newStartU: number }>
  overflow: boolean
}

/**
 * Attempt to shift existing devices to make room for a new placement.
 * Cascades through multiple devices if needed. Returns overflow if rack is too full.
 */
export function autoShift(
  occupancy: OccupancyEntry[],
  startU: number,
  uHeight: number,
  isFullDepth: boolean,
  face: DeviceFace,
  uCount: number,
  rackFormFactor?: RackFormFactor
): ShiftResult {
  // Find all devices that collide with the proposed range
  const endU = startU + uHeight - 1
  const colliding = occupancy.filter((entry) => {
    if (endU < entry.startU || startU > entry.endU) return false
    // Apply same face-aware collision rules
    if (isFullDepth || entry.isFullDepth) return true
    if (face === entry.face) return true
    if (!rackFormFactor || rackFormFactor.startsWith("2-post")) return true
    return false
  })

  if (colliding.length === 0) return { shifts: [], overflow: false }

  // Calculate free space above and below
  const allOccupiedUs = new Set<number>()
  for (const e of occupancy) {
    for (let u = e.startU; u <= e.endU; u++) allOccupiedUs.add(u)
  }
  let freeAbove = 0
  for (let u = endU + 1; u <= uCount; u++) {
    if (!allOccupiedUs.has(u)) freeAbove++
  }
  let freeBelow = 0
  for (let u = startU - 1; u >= 1; u--) {
    if (!allOccupiedUs.has(u)) freeBelow++
  }

  // Try direction with more space first (bias down on tie)
  const directions: Array<"down" | "up"> = freeBelow >= freeAbove ? ["down", "up"] : ["up", "down"]

  for (const direction of directions) {
    const result = tryShift(occupancy, startU, uHeight, isFullDepth, face, uCount, rackFormFactor, colliding, direction)
    if (result) return result
  }

  return { shifts: [], overflow: true }
}

/** Check if two devices would collide given face/depth rules. */
function wouldCollide(
  aIsFullDepth: boolean, aFace: DeviceFace,
  bIsFullDepth: boolean, bFace: DeviceFace,
  rackFormFactor?: RackFormFactor,
): boolean {
  if (aIsFullDepth || bIsFullDepth) return true
  if (aFace === bFace) return true
  if (!rackFormFactor || rackFormFactor.startsWith("2-post")) return true
  return false
}

function tryShift(
  occupancy: OccupancyEntry[],
  targetStartU: number,
  targetUHeight: number,
  _targetIsFullDepth: boolean,
  _targetFace: DeviceFace,
  uCount: number,
  rackFormFactor: RackFormFactor | undefined,
  initialColliding: OccupancyEntry[],
  direction: "up" | "down"
): ShiftResult | null {
  const shifts = new Map<string, number>() // deviceId → newStartU
  const targetEndU = targetStartU + targetUHeight - 1

  // Build a mutable position map for all occupancy entries
  const positions = new Map<string, { startU: number; endU: number; uHeight: number; isFullDepth: boolean; face: DeviceFace }>()
  for (const e of occupancy) {
    positions.set(e.deviceId, {
      startU: e.startU,
      endU: e.endU,
      uHeight: e.endU - e.startU + 1,
      isFullDepth: e.isFullDepth,
      face: e.face,
    })
  }

  // Cursor tracks the next available U-slot edge in the shift direction.
  // For "down": cursor is the top of the next available slot below the target.
  // For "up": cursor is the bottom of the next available slot above the target.
  let cursor = direction === "down" ? targetStartU - 1 : targetEndU + 1

  // Sort: for "down", process highest-startU first (closest to target → packed tightly below).
  // For "up", process lowest-startU first (closest to target → packed tightly above).
  const sorted = [...initialColliding].sort((a, b) =>
    direction === "down" ? b.startU - a.startU : a.startU - b.startU
  )

  const queue = [...sorted]
  const processed = new Set<string>()

  while (queue.length > 0) {
    const entry = queue.shift()!
    if (processed.has(entry.deviceId)) continue
    processed.add(entry.deviceId)

    const pos = positions.get(entry.deviceId)!
    const h = pos.uHeight

    // Place device at cursor
    let newStartU: number
    if (direction === "down") {
      newStartU = cursor - h + 1
    } else {
      newStartU = cursor
    }

    // Bounds check
    if (newStartU < 1 || newStartU + h - 1 > uCount) return null

    const newEndU = newStartU + h - 1

    // Check if any unprocessed device sits at the new position and needs cascading
    for (const [otherId, otherPos] of positions) {
      if (otherId === entry.deviceId || processed.has(otherId)) continue
      // Check vertical overlap at new position
      if (newEndU < otherPos.startU || newStartU > otherPos.endU) continue
      // Check face-aware collision
      if (wouldCollide(pos.isFullDepth, pos.face, otherPos.isFullDepth, otherPos.face, rackFormFactor)) {
        // This device is in the way — add to queue for cascading
        if (!queue.some((e) => e.deviceId === otherId)) {
          queue.push({
            deviceId: otherId,
            startU: otherPos.startU,
            endU: otherPos.endU,
            isFullDepth: otherPos.isFullDepth,
            face: otherPos.face,
          })
        }
      }
    }

    shifts.set(entry.deviceId, newStartU)
    positions.set(entry.deviceId, { ...pos, startU: newStartU, endU: newEndU })

    // Advance cursor past this device
    if (direction === "down") {
      cursor = newStartU - 1
    } else {
      cursor = newStartU + h
    }
  }

  return {
    shifts: Array.from(shifts.entries()).map(([deviceId, newStartU]) => ({ deviceId, newStartU })),
    overflow: false,
  }
}

// --- Rack frame position helpers ---

/**
 * Get the rack frame's absolute top-left position on the canvas.
 * Inside a Fabric v6 group, all children use originX/Y = 'center',
 * so child.left/top represents the child's CENTER, not its top-left edge.
 * We subtract half the dimensions to get the top-left corner.
 */
export function getRackFramePosition(rackGroup: Group): { left: number; top: number } {
  // [0] = enclosure, [1] = inner frame (device area)
  const frame = rackGroup.getObjects()[1]
  const center = rackGroup.getCenterPoint()
  return {
    left: center.x + (frame.left ?? 0) - (frame.width ?? 0) / 2,
    top: center.y + (frame.top ?? 0) - (frame.height ?? 0) / 2,
  }
}

// --- Hit-test: is a point inside a rack? ---

/**
 * Find which rack (if any) contains the given absolute canvas point.
 * Returns the rack Group or null.
 */
export function findRackAtPoint(
  racks: Map<string, Group>,
  absX: number,
  absY: number
): Group | null {
  for (const rack of racks.values()) {
    const rd = rack.rackData
    if (!rd) continue

    const { left: frameLeft, top: frameTop } = getRackFramePosition(rack)
    const rackHeight = rd.uCount * RACK_DEFAULTS.uHeightPx
    const rackWidth = rd.rackWidthPx ?? RACK_DEFAULTS.rackWidthPx

    if (
      absX >= frameLeft &&
      absX <= frameLeft + rackWidth &&
      absY >= frameTop &&
      absY <= frameTop + rackHeight
    ) {
      return rack
    }
  }
  return null
}

/**
 * Convert absolute canvas coordinates to rack-local coordinates.
 * Returns Y relative to rack frame origin (top of rack = 0).
 */
export function toRackLocalY(rack: Group, absY: number): number {
  const { top: frameTop } = getRackFramePosition(rack)
  return absY - frameTop
}
