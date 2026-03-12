import { Group, Rect, FabricText, FabricImage, type Canvas } from "fabric"
import { RACK_DEFAULTS, RACK_COLORS } from "./rack"
import type { DeviceFace } from "@/store/rack-store"

// --- Constants ---

export const DEVICE_CATEGORIES = [
  "server",
  "switch",
  "patch_panel",
  "pdu",
  "storage",
  "ups",
  "blank",
  "other",
] as const

export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number]

export const DEVICE_COLORS: Record<DeviceCategory, string> = {
  server: "#2563eb",
  switch: "#16a34a",
  patch_panel: "#ca8a04",
  pdu: "#dc2626",
  storage: "#7c3aed",
  ups: "#ea580c",
  blank: "#374151",
  other: "#6b7280",
}

// Dimmed background versions for the device body
const DEVICE_BG_COLORS: Record<DeviceCategory, string> = {
  server: "#1e3a5f",
  switch: "#14532d",
  patch_panel: "#422006",
  pdu: "#450a0a",
  storage: "#2e1065",
  ups: "#431407",
  blank: "#1f2937",
  other: "#1f2937",
}

// --- Types ---

export interface DeviceData {
  id: string
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
  rackId?: string
  face?: DeviceFace
}

export interface CreateDeviceOptions {
  data: Omit<DeviceData, "id">
  position?: { x: number; y: number }
  rackWidthPx?: number
  /** Render as a non-interactive ghost (opposite-face device showing through) */
  isGhost?: boolean
}

// --- Fabric declaration merging ---

declare module "fabric" {
  interface FabricObject {
    deviceData?: DeviceData
    _isImageOverlay?: boolean
    _isGhost?: boolean
  }
}

// Non-interactive child defaults (spread into every group child)
const PASSIVE = { evented: false, selectable: false, strokeWidth: 0, objectCaching: false } as const

// --- Factory ---

export function createDevice(options: CreateDeviceOptions): Group {
  const { data, position, rackWidthPx, isGhost = false } = options
  const deviceId = crypto.randomUUID()

  // Inset by frame stroke so devices sit inside the rack border
  const width = (rackWidthPx ?? RACK_DEFAULTS.rackWidthPx) - RACK_DEFAULTS.frameStrokeWidth
  const height = data.uHeight * RACK_DEFAULTS.uHeightPx - RACK_DEFAULTS.deviceInsetY - RACK_DEFAULTS.deviceInsetX
  const color = DEVICE_COLORS[data.category]
  const bgColor = DEVICE_BG_COLORS[data.category]
  const indicatorWidth = 4
  const isRear = data.face === "rear"

  // Fabric v6 groups treat children's left/top as CENTER coordinates
  // (originX/Y are converted to "center" on enterGroup). Position each
  // child by its center so FitContentLayout computes a symmetric bbox.
  const cx = width / 2
  const cy = height / 2

  // Category indicator bar — left edge for front, right edge for rear
  const colorBase = new Rect({
    left: cx,
    top: cy,
    width,
    height,
    fill: color,
    rx: 2,
    ry: 2,
    ...PASSIVE,
  })

  // Inset background covers everything except the indicator strip
  const bgInset = new Rect({
    left: isRear
      ? (width - indicatorWidth) / 2
      : indicatorWidth + (width - indicatorWidth) / 2,
    top: cy,
    width: width - indicatorWidth,
    height,
    fill: bgColor,
    ...PASSIVE,
  })

  // Device name label — create first to measure width for centering
  const nameLabel = new FabricText(data.name, {
    left: 0,
    top: 0,
    fontSize: height > 20 ? 12 : 10,
    lineHeight: 1,
    fill: RACK_COLORS.nameText,
    fontFamily: "sans-serif",
    fontWeight: "bold",
    ...PASSIVE,
  })
  const namePadLeft = isRear ? 8 : indicatorWidth + 8
  const nameTop = height > 20 ? 3 : 2
  nameLabel.set({
    left: namePadLeft + nameLabel.width / 2,
    top: nameTop + nameLabel.height / 2,
  })

  // Manufacturer/model subtext (only if device is 2U+)
  const children: (Rect | FabricText)[] = [colorBase, bgInset, nameLabel]

  if (data.uHeight >= 2) {
    const subtext = new FabricText(
      `${data.manufacturer} ${data.model}`.trim(),
      {
        left: 0,
        top: 0,
        fontSize: 9,
        lineHeight: 1,
        fill: RACK_COLORS.uLabel,
        fontFamily: "sans-serif",
        ...PASSIVE,
      }
    )
    subtext.set({
      left: namePadLeft + subtext.width / 2,
      top: 18 + subtext.height / 2,
    })
    children.push(subtext)
  }

  // Half-depth indicator (right side mark)
  if (!data.isFullDepth) {
    const markWidth = 4
    const halfDepthMark = new Rect({
      left: (width - 6) + markWidth / 2,
      top: 2 + (height - 4) / 2,
      width: markWidth,
      height: height - 4,
      fill: "transparent",
      stroke: RACK_COLORS.uLabel,
      strokeWidth: 1,
      strokeDashArray: [2, 2],
      evented: false,
      selectable: false,
    })
    children.push(halfDepthMark)
  }

  const deviceGroup = new Group(children, {
    left: position?.x ?? 0,
    top: position?.y ?? 0,
    originX: "left",
    originY: "top",
    objectCaching: false,
    strokeWidth: 0,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasControls: false,
    // Ghost devices are non-interactive (opposite-face showing through)
    ...(isGhost && { selectable: false, evented: false, opacity: 0.3 }),
  })

  deviceGroup.deviceData = {
    id: deviceId,
    ...data,
  }
  if (isGhost) deviceGroup._isGhost = true

  return deviceGroup
}

// --- Image overlay ---

export async function overlayDeviceImage(group: Group, imageUrl: string, canvas: Canvas): Promise<void> {
  try {
    const img = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" })
    if (!img || !img.width || !img.height) return

    // Get device rect dimensions and position from colorBase (first child)
    const colorBase = group.item(0) as Rect
    const targetW = colorBase.width ?? group.width ?? 100
    const targetH = colorBase.height ?? group.height ?? 20

    // Stretch to fill — elevation images represent the full rack-width device face
    const scaleX = targetW / img.width
    const scaleY = targetH / img.height

    // Match colorBase's group-relative position and origin (set by enterGroup)
    img.set({
      left: colorBase.left,
      top: colorBase.top,
      originX: colorBase.originX,
      originY: colorBase.originY,
      scaleX,
      scaleY,
      evented: false,
      selectable: false,
      strokeWidth: 0,
    })
    img._isImageOverlay = true

    // Directly splice into _objects to bypass layout recalculation
    // (group.add/insertAt triggers FitContentLayout which resizes the group)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    ;(img as any).group = group
    ;(img as any).canvas = canvas
    ;(group as any)._objects.splice(2, 0, img)
    /* eslint-enable @typescript-eslint/no-explicit-any */
    group.dirty = true
    canvas.requestRenderAll()
  } catch {
    // Image load failed — silently skip
  }
}

export function removeImageOverlays(group: Group): void {
  // Directly splice out of _objects to bypass layout recalculation
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const objects = (group as any)._objects as any[]
  /* eslint-enable @typescript-eslint/no-explicit-any */
  let removed = false
  for (let i = objects.length - 1; i >= 0; i--) {
    if (objects[i]._isImageOverlay) {
      objects.splice(i, 1)
      removed = true
    }
  }
  if (removed) group.dirty = true
}
