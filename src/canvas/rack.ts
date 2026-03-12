import { Group, Rect, Path, FabricText, IText } from "fabric"

// --- Constants ---

export const RACK_DEFAULTS = {
  uHeightPx: 20,
  rackWidthPx: 300,
  railWidthPx: 24,
  nameHeightPx: 30,
  /** Side post / mounting rail width */
  postWidthPx: 22,
  /** Top/bottom cap height */
  capHeightPx: 20,
  cornerRadius: 6,
  /** Buffer between rack enclosures during collision detection */
  collisionBufferPx: 4,
  rackGapPx: 60,
  /** Fine grid snap for rack placement (px) */
  rackSnapPx: 10,
  frameStrokeWidth: 2,
  /** Inset so devices sit inside the frame border */
  get deviceInsetX() { return this.frameStrokeWidth / 2 },
  get deviceInsetY() { return this.frameStrokeWidth },
} as const

/** Common rack sizes shown as dropdown presets. */
export const RACK_SIZES = [12, 20, 24, 25, 42, 45, 47, 48] as const

/** Any positive integer — RACK_SIZES are presets only. */
export type RackSize = number

/** Convert rack width in inches to pixel width, scaled relative to 19" = 300px. */
export function widthInchesToPx(w?: number): number {
  return Math.round((w ?? 19) / 19 * 300)
}

export const RACK_COLORS = {
  frame: "#2a2a3e",
  frameBorder: "#4a4a6a",
  gridLine: "#1e1e32",
  uLabel: "#6b6b8a",
  nameText: "#e0e0e8",
  background: "#12121f",
  /** Rack cabinet body — enclosure, posts, and caps */
  enclosure: "#090910",
  /** Prominent outer border line */
  enclosureBorder: "#1a1a2e",
} as const satisfies Record<string, string>

// --- Types ---

export interface RackData {
  id: string
  name: string
  uCount: number
  rackWidthPx: number
  startingUnit: number
  descendingUnits: boolean
}

export interface CreateRackOptions {
  uCount?: number
  name?: string
  position?: { x: number; y: number }
  widthInches?: number
  startingUnit?: number
  descendingUnits?: boolean
}

// --- Fabric declaration merging for typed custom properties ---

declare module "fabric" {
  interface FabricObject {
    rackData?: RackData
  }
}

// --- Serialization: persist rackData through toJSON/toObject ---

const originalGroupToObject = Group.prototype.toObject as (
  this: Group,
  propertiesToInclude?: string[],
) => Record<string, unknown>;
(Group.prototype as unknown as Record<string, unknown>).toObject = function (
  this: Group,
  propertiesToInclude?: string[],
) {
  return originalGroupToObject.call(
    this,
    ["rackData", "deviceData"].concat(propertiesToInclude ?? []),
  )
}

// Non-interactive child defaults (spread into every group child)
const PASSIVE = { evented: false, selectable: false } as const

// --- Factory ---

export function createRack(options?: CreateRackOptions): Group {
  const {
    uCount = 42,
    name = "Rack",
    position,
    widthInches,
    startingUnit = 1,
    descendingUnits = false,
  } = options ?? {}

  const rackId = crypto.randomUUID()
  const rackHeight = uCount * RACK_DEFAULTS.uHeightPx
  const rackWidthPx = widthInchesToPx(widthInches)
  const { nameHeightPx, cornerRadius, postWidthPx, capHeightPx, uHeightPx } = RACK_DEFAULTS

  // --- Outer enclosure (the cabinet shell) ---
  // Extends beyond the device area to create visible side posts and top/bottom caps
  const enclosure = new Rect({
    left: -postWidthPx,
    top: -capHeightPx,
    width: rackWidthPx + 2 * postWidthPx,
    height: rackHeight + 2 * capHeightPx,
    fill: RACK_COLORS.enclosure,
    stroke: RACK_COLORS.enclosureBorder,
    strokeWidth: 3,
    rx: cornerRadius,
    ry: cornerRadius,
    ...PASSIVE,
  })

  // --- Inner frame (device area background) ---
  const frame = new Rect({
    left: 0,
    top: 0,
    width: rackWidthPx,
    height: rackHeight,
    fill: RACK_COLORS.background,
    stroke: RACK_COLORS.frameBorder,
    strokeWidth: 1.5,
    ...PASSIVE,
  })

  // --- Gridlines as single Path ---
  // Lines extend across the posts so U boundaries are visible on the rails.
  // Symmetric extension preserves the path center for Rect-to-Path alignment.
  const gridPathData = Array.from({ length: uCount + 1 }, (_, i) => {
    const y = i * uHeightPx
    return `M ${-postWidthPx},${y} L ${rackWidthPx + postWidthPx},${y}`
  }).join(" ")

  const gridlines = new Path(gridPathData, {
    stroke: RACK_COLORS.gridLine,
    strokeWidth: 1,
    fill: "",
    ...PASSIVE,
  })

  // --- Side mounting posts (left and right rails) ---
  const leftPost = new Rect({
    left: -postWidthPx,
    top: 0,
    width: postWidthPx,
    height: rackHeight,
    fill: RACK_COLORS.enclosure,
    stroke: RACK_COLORS.enclosureBorder,
    strokeWidth: 1,
    ...PASSIVE,
  })

  const rightPost = new Rect({
    left: rackWidthPx,
    top: 0,
    width: postWidthPx,
    height: rackHeight,
    fill: RACK_COLORS.enclosure,
    stroke: RACK_COLORS.enclosureBorder,
    strokeWidth: 1,
    ...PASSIVE,
  })

  // --- Top & bottom cap bars (solid structural panels) ---
  const enclosureWidth = rackWidthPx + 2 * postWidthPx
  const capLipH = 2
  const topCap = new Rect({ left: -postWidthPx, top: -capHeightPx, width: enclosureWidth, height: capHeightPx, fill: RACK_COLORS.enclosure, ...PASSIVE })
  const bottomCap = new Rect({ left: -postWidthPx, top: rackHeight, width: enclosureWidth, height: capHeightPx, fill: RACK_COLORS.enclosure, ...PASSIVE })
  // Thin highlight lines at cap/device-area boundary for depth
  const topCapLip = new Rect({ left: -postWidthPx, top: -capLipH, width: enclosureWidth, height: capLipH, fill: RACK_COLORS.background, ...PASSIVE })
  const bottomCapLip = new Rect({ left: -postWidthPx, top: rackHeight, width: enclosureWidth, height: capLipH, fill: RACK_COLORS.background, ...PASSIVE })
  const capBars = [topCap, bottomCap, topCapLip, bottomCapLip]

  // --- U-position labels ---
  const labels = Array.from({ length: uCount }, (_, i) => {
    const uNumber = descendingUnits
      ? startingUnit + i
      : startingUnit + uCount - 1 - i
    return new FabricText(String(uNumber), {
      left: 4,
      top: i * uHeightPx + (uHeightPx - 10) / 2,
      fontSize: 10,
      fill: RACK_COLORS.uLabel,
      fontFamily: "monospace",
      ...PASSIVE,
    })
  })

  // Labels are added directly to the main group (not a sub-group)
  // so they can be individually aligned relative to the frame.

  // --- Rack name (editable IText above enclosure) ---
  const nameLabel = new IText(name, {
    left: rackWidthPx / 2,
    top: -(nameHeightPx + capHeightPx),
    fontSize: 14,
    fill: RACK_COLORS.nameText,
    fontFamily: "sans-serif",
    textAlign: "center",
    originX: "center",
    editable: true,
    hasControls: false,
  })

  // Assemble group
  // Order: enclosure (back) → frame → gridlines → posts → caps → labels → name (front)
  const rackGroup = new Group(
    [enclosure, frame, gridlines, leftPost, rightPost, ...capBars, ...labels, nameLabel],
    {
      left: snapToGrid(position?.x ?? 100, RACK_DEFAULTS.rackSnapPx),
      top: snapToGrid(position?.y ?? 80, RACK_DEFAULTS.rackSnapPx),
      subTargetCheck: true,
      interactive: true,
      objectCaching: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hasControls: false,
      hasBorders: false,
      perPixelTargetFind: true,
    }
  )

  // Fix Fabric v6 group positioning inconsistency:
  // Path objects use pathOffset internally, giving them different local
  // positions than Rect objects. Align all Rects to the gridlines Path
  // so everything renders at the correct position.
  const objs = rackGroup.getObjects()
  const groupedEnclosure = objs[0]
  const groupedFrame = objs[1]
  const groupedGrid = objs[2]
  const groupedLeftPost = objs[3]
  const groupedRightPost = objs[4]

  // Anchor: align inner frame to gridlines (both cover the same 0,0 → rackWidthPx,rackHeight area)
  groupedFrame.set({ left: groupedGrid.left, top: groupedGrid.top })
  // Enclosure is concentric with frame (same center, larger size)
  groupedEnclosure.set({ left: groupedFrame.left, top: groupedFrame.top })
  // Posts flank the frame — same center Y, offset center X
  groupedLeftPost.set({
    left: groupedFrame.left - rackWidthPx / 2 - postWidthPx / 2,
    top: groupedFrame.top,
  })
  groupedRightPost.set({
    left: groupedFrame.left + rackWidthPx / 2 + postWidthPx / 2,
    top: groupedFrame.top,
  })

  // Cap bars — top and bottom solid bars + lip highlights at indices 5..8
  const groupedTopCap = objs[5]
  const groupedBottomCap = objs[6]
  const groupedTopLip = objs[7]
  const groupedBottomLip = objs[8]
  groupedTopCap.set({
    left: groupedFrame.left,
    top: groupedFrame.top - rackHeight / 2 - capHeightPx / 2,
  })
  groupedBottomCap.set({
    left: groupedFrame.left,
    top: groupedFrame.top + rackHeight / 2 + capHeightPx / 2,
  })
  groupedTopLip.set({
    left: groupedFrame.left,
    top: groupedFrame.top - rackHeight / 2 - capLipH / 2,
  })
  groupedBottomLip.set({
    left: groupedFrame.left,
    top: groupedFrame.top + rackHeight / 2 + capLipH / 2,
  })

  // Align each U-label just inside the left post's right edge
  const labelStartIdx = 5 + capBars.length
  const labelLeftEdge = groupedLeftPost.left + postWidthPx / 2 - 11
  for (let l = 0; l < labels.length; l++) {
    const label = objs[labelStartIdx + l]
    const centerY = groupedFrame.top - rackHeight / 2 + l * uHeightPx + uHeightPx / 2
    label.set({ left: labelLeftEdge, top: centerY })
  }

  // Attach typed custom data
  rackGroup.rackData = { id: rackId, name, uCount, rackWidthPx, startingUnit, descendingUnits }

  return rackGroup
}

export function snapToGrid(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize
}
