import { useEffect, useRef } from "react"
import { ActiveSelection } from "fabric"
import type { Canvas, Group, FabricObject } from "fabric"
import {
  resolveSnap,
  findRackAtPoint,
  toRackLocalY,
  getRackFramePosition,
  getOccupancy,
  autoShift,
  uToY,
  type SnapResult,
} from "./snap"
import { RACK_DEFAULTS, snapToGrid } from "./rack"
import { createDevice } from "./device"
import { useRackStore } from "@/store/rack-store"
import { cabinetDropElement } from "@/components/cabinet/cabinet-drop-ref"

interface DragState {
  originalLeft: number
  originalTop: number
  originalStartU: number
  sourceRackId: string | null
}

interface RackDragState {
  rackId: string
  originalLeft: number
  originalTop: number
  lastLeft: number
  lastTop: number
  devices: FabricObject[]
}

interface MultiRackDragState {
  initialLeft: number
  initialTop: number
  lastLeft: number
  lastTop: number
  devices: FabricObject[]
  rackIds: string[]
}

interface PreviewShift {
  deviceId: string
  originalTop: number
  originalStartU: number
  newStartU: number
}

interface PreviewState {
  shifts: PreviewShift[]
  rackId: string
  targetStartU: number
}

/**
 * Hook that adds snap-to-U and collision detection behavior
 * for device objects on the Fabric canvas.
 */
export function useSnap(
  canvasRef: React.RefObject<Canvas | null>,
  racksRef: React.RefObject<Map<string, Group>>
) {
  const lastSnapRef = useRef<SnapResult | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const rackDragRef = useRef<RackDragState | null>(null)
  const multiRackDragRef = useRef<MultiRackDragState | null>(null)
  const previewRef = useRef<PreviewState | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleMoving(e: { target: FabricObject; e: Event }) {
      const target = e.target as Group
      const mouseEvent = e.e as MouseEvent

      // Update cabinet drop-zone highlight during any drag
      const cabinetEl = cabinetDropElement.current
      const hasArchivable = target.deviceData || target.rackData ||
        (target instanceof ActiveSelection && target.getObjects().some((o) => {
          const g = o as Group
          return g.deviceData || g.rackData
        }))
      if (cabinetEl && hasArchivable) {
        // Disable pointer events on cabinet icon so Fabric receives mouseup during drag
        // (moved here from mouse:down so simple click-to-select doesn't block the icon)
        cabinetEl.style.pointerEvents = "none"
        const rect = cabinetEl.getBoundingClientRect()
        const isOver =
          mouseEvent.clientX >= rect.left && mouseEvent.clientX <= rect.right &&
          mouseEvent.clientY >= rect.top && mouseEvent.clientY <= rect.bottom
        cabinetEl.dataset.dropActive = isOver ? "true" : ""
      }

      // Multi-rack movement — move associated devices along with selection
      if (target instanceof ActiveSelection) {
        const mrs = multiRackDragRef.current
        if (mrs && mrs.devices.length > 0) {
          const rawLeft = target.left ?? 0
          const rawTop = target.top ?? 0
          const snappedLeft = snapToGrid(rawLeft, RACK_DEFAULTS.rackSnapPx)
          const snappedTop = snapToGrid(rawTop, RACK_DEFAULTS.rackSnapPx)
          target.set({ left: snappedLeft, top: snappedTop })
          target.setCoords()
          const dx = snappedLeft - mrs.lastLeft
          const dy = snappedTop - mrs.lastTop
          mrs.lastLeft = snappedLeft
          mrs.lastTop = snappedTop
          for (const dev of mrs.devices) {
            dev.set({ left: (dev.left ?? 0) + dx, top: (dev.top ?? 0) + dy })
            dev.setCoords()
          }
          canvas!.requestRenderAll()
        }
        return
      }

      // Rack movement — snap to invisible grid and drag devices along
      if (target.rackData) {
        const rs = rackDragRef.current
        if (!rs || rs.rackId !== target.rackData.id) return

        // Snap rack position to fine grid
        const rawLeft = target.left ?? 0
        const rawTop = target.top ?? 0
        const snappedLeft = snapToGrid(rawLeft, RACK_DEFAULTS.rackSnapPx)
        const snappedTop = snapToGrid(rawTop, RACK_DEFAULTS.rackSnapPx)

        // Prevent rack-to-rack overlap — resolve each axis independently
        let finalLeft = snappedLeft
        let finalTop = snappedTop
        const rackMap = racksRef.current
        if (racksOverlap(target, finalLeft, finalTop, rackMap)) {
          // Try keeping X, allow Y
          const xBlocked = racksOverlap(target, finalLeft, rs.lastTop, rackMap)
          // Try keeping Y, allow X
          const yBlocked = racksOverlap(target, rs.lastLeft, finalTop, rackMap)
          if (xBlocked) finalLeft = rs.lastLeft
          if (yBlocked) finalTop = rs.lastTop
          // If both axes individually fine but combined overlaps, constrain both
          if (!xBlocked && !yBlocked) {
            finalLeft = rs.lastLeft
            finalTop = rs.lastTop
          }
        }

        target.set({ left: finalLeft, top: finalTop })
        target.setCoords()

        const dx = finalLeft - rs.lastLeft
        const dy = finalTop - rs.lastTop
        rs.lastLeft = finalLeft
        rs.lastTop = finalTop
        for (const dev of rs.devices) {
          dev.set({ left: (dev.left ?? 0) + dx, top: (dev.top ?? 0) + dy })
          dev.setCoords()
        }
        canvas!.requestRenderAll()
        return
      }

      const dd = target.deviceData
      if (!dd) return

      const racks = racksRef.current
      if (!racks) return

      const objCenter = target.getCenterPoint()
      const rack = findRackAtPoint(racks, objCenter.x, objCenter.y)

      if (!rack) {
        // Outside any rack — restore preview, clear snap
        if (previewRef.current) {
          restorePreviewShifts(canvas!, previewRef.current)
          previewRef.current = null
        }
        lastSnapRef.current = null
        return
      }

      const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)
      target.set({ left: rackLeft + RACK_DEFAULTS.deviceInsetX })

      const localY = toRackLocalY(rack, objCenter.y)
      const storeState = useRackStore.getState()
      const face = storeState.viewFace
      const storeRack = storeState.racks[rack.rackData!.id]
      const snap = resolveSnap(rack, localY, dd.uHeight, dd.isFullDepth, face, storeRack?.formFactor, dd.id, storeRack?.allowOverlap)

      // If snap target unchanged from current preview, keep it (avoids recalculation)
      const currentPreview = previewRef.current
      if (currentPreview && currentPreview.rackId === snap.rackId && currentPreview.targetStartU === snap.startU) {
        target.set({ top: rackTop + snap.snapY + RACK_DEFAULTS.deviceInsetY })
        target.setCoords()
        canvas!.requestRenderAll()
        return
      }

      // Target changed — restore previous preview
      if (currentPreview) {
        restorePreviewShifts(canvas!, currentPreview)
        previewRef.current = null
      }

      if (snap.valid) {
        // No collision — snap to target U
        target.set({ top: rackTop + snap.snapY + RACK_DEFAULTS.deviceInsetY })
        target.setCoords()
        lastSnapRef.current = snap
      } else if (storeRack && !storeRack.allowOverlap) {
        // Collision — try auto-shift preview
        const occupancy = getOccupancy(snap.rackId, dd.id)
        const result = autoShift(occupancy, snap.startU, dd.uHeight, dd.isFullDepth, face, storeRack.uCount, storeRack.formFactor)

        if (!result.overflow && result.shifts.length > 0) {
          // Snap dragged device to target U
          target.set({ top: rackTop + snap.snapY + RACK_DEFAULTS.deviceInsetY })
          target.setCoords()

          // Show shifted devices at preview positions
          const shifts: PreviewShift[] = []
          for (const shift of result.shifts) {
            for (const obj of canvas!.getObjects()) {
              const objDd = (obj as Group).deviceData
              if (objDd?.id === shift.deviceId) {
                const device = storeState.devices[shift.deviceId]
                if (device) {
                  shifts.push({
                    deviceId: shift.deviceId,
                    originalTop: obj.top ?? 0,
                    originalStartU: objDd.startU,
                    newStartU: shift.newStartU,
                  })
                  const newY = rackTop + uToY(shift.newStartU + device.uHeight - 1, storeRack.uCount) + RACK_DEFAULTS.deviceInsetY
                  obj.set({ top: newY })
                  obj.setCoords()
                }
                break
              }
            }
          }

          previewRef.current = { shifts, rackId: snap.rackId, targetStartU: snap.startU }
          lastSnapRef.current = { ...snap, valid: true }
        } else {
          // Overflow — no preview, leave as invalid
          lastSnapRef.current = snap
        }
      } else {
        lastSnapRef.current = snap
      }

      canvas!.requestRenderAll()
    }

    function handleModified(e: { target: FabricObject; e: Event }) {
      const target = e.target as Group
      const mouseEvent = e.e as MouseEvent

      // Check if dropped over cabinet drop zone
      const cabinetEl = cabinetDropElement.current
      let overCabinet = false
      if (cabinetEl) {
        // Restore pointer events (disabled in handleDragStart)
        cabinetEl.style.pointerEvents = ""
        const rect = cabinetEl.getBoundingClientRect()
        overCabinet =
          mouseEvent.clientX >= rect.left && mouseEvent.clientX <= rect.right &&
          mouseEvent.clientY >= rect.top && mouseEvent.clientY <= rect.bottom
        cabinetEl.dataset.dropActive = "" // clear highlight
      }

      // Multi-selection dropped on cabinet → archive all devices in the selection
      if (overCabinet && target instanceof ActiveSelection) {
        const objects = target.getObjects() as Group[]
        const devices = objects.filter((o) => o.deviceData)
        if (devices.length > 0) {
          const deviceIds = new Set<string>()
          const archiveItems: Array<{ id: string; type: "rack" | "device" }> = []
          for (const o of devices) {
            const id = o.deviceData!.id
            deviceIds.add(id)
            archiveItems.push({ id, type: "device" })
          }
          useRackStore.getState().batchArchive(archiveItems)

          // Hide immediately, defer removal so Fabric's mouseup finishes cleanly
          target.set({ visible: false, selectable: false, evented: false })
          canvas!.requestRenderAll()
          const c = canvas!
          requestAnimationFrame(() => {
            c.discardActiveObject()
            for (const obj of [...c.getObjects()]) {
              const dd = (obj as Group).deviceData
              if (dd && deviceIds.has(dd.id)) c.remove(obj)
            }
            c.requestRenderAll()
          })
          return
        }
      }

      // Multi-rack drag finished — sync all rack positions to store
      if (target instanceof ActiveSelection) {
        const mrs = multiRackDragRef.current
        if (mrs && mrs.rackIds.length > 0) {
          multiRackDragRef.current = null
          const totalDx = mrs.lastLeft - mrs.initialLeft
          const totalDy = mrs.lastTop - mrs.initialTop
          if (totalDx !== 0 || totalDy !== 0) {
            const storeRacks = useRackStore.getState().racks
            for (const rackId of mrs.rackIds) {
              const storeRack = storeRacks[rackId]
              if (storeRack) {
                useRackStore.getState().updateRack(rackId, {
                  left: storeRack.left + totalDx,
                  top: storeRack.top + totalDy,
                })
              }
            }
          }
          return
        }
      }

      // Rack dropped on cabinet → archive entire rack
      if (target.rackData && overCabinet) {
        const rackId = target.rackData.id
        const rs = rackDragRef.current
        rackDragRef.current = null

        // Revert rack position before archiving (visual cleanup)
        if (rs) {
          target.set({ left: rs.originalLeft, top: rs.originalTop })
          target.setCoords()
          for (const dev of rs.devices) {
            const dx = rs.originalLeft - rs.lastLeft
            const dy = rs.originalTop - rs.lastTop
            dev.set({ left: (dev.left ?? 0) + dx, top: (dev.top ?? 0) + dy })
            dev.setCoords()
          }
        }

        // Capture child device IDs
        const storeDevices = useRackStore.getState().devices
        const rackDeviceIds = new Set(
          Object.values(storeDevices).filter((d) => d.rackId === rackId).map((d) => d.id)
        )

        // Archive in store
        useRackStore.getState().archiveRack(rackId)

        // Remove child device canvas objects
        const devicesToRemove = canvas!.getObjects().filter((obj) => {
          const objDd = (obj as Group).deviceData
          return objDd != null && rackDeviceIds.has(objDd.id)
        })
        for (const dev of devicesToRemove) canvas!.remove(dev)

        // Hide rack + devices immediately, defer removal so Fabric's mouseup finishes cleanly
        target.set({ visible: false, selectable: false, evented: false })
        for (const dev of devicesToRemove) dev.set({ visible: false, selectable: false, evented: false })
        racksRef.current.delete(rackId)
        canvas!.requestRenderAll()
        const c = canvas!
        requestAnimationFrame(() => {
          c.discardActiveObject()
          c.remove(target)
          for (const dev of devicesToRemove) c.remove(dev)
          c.requestRenderAll()
        })
        return
      }

      // Sync rack position to store after normal drag
      if (target.rackData) {
        rackDragRef.current = null
        useRackStore.getState().updateRack(target.rackData.id, {
          left: target.left ?? 0,
          top: target.top ?? 0,
        })
        return
      }

      const dd = target.deviceData
      if (!dd) return

      // Resume undo history — pause was called in handleDragStart.
      // Resume BEFORE store mutations so each mutation is recorded.
      useRackStore.temporal.getState().resume()

      // Device dropped on cabinet → archive device
      if (overCabinet) {
        lastSnapRef.current = null
        const dragState = dragStateRef.current
        dragStateRef.current = null
        const preview = previewRef.current
        previewRef.current = null

        // Restore any active preview shifts
        if (preview) restorePreviewShifts(canvas!, preview)

        useRackStore.getState().archiveDevice(dd.id)

        // Hide immediately, defer removal so Fabric's mouseup finishes cleanly
        target.set({ visible: false, selectable: false, evented: false })
        canvas!.requestRenderAll()
        const c = canvas!
        requestAnimationFrame(() => {
          c.discardActiveObject()
          c.remove(target)
          c.requestRenderAll()
        })

        // If the device came from a rack and had a saved position, no revert needed
        void dragState
        return
      }

      const snap = lastSnapRef.current
      const dragState = dragStateRef.current
      const preview = previewRef.current
      lastSnapRef.current = null
      dragStateRef.current = null
      previewRef.current = null

      if (!snap || !snap.valid) {
        // Restore any active preview (canvas positions only, no store mutations)
        if (preview) {
          restorePreviewShifts(canvas!, preview)
        }
        // Revert dragged device to original position
        if (dragState) {
          target.set({ left: dragState.originalLeft, top: dragState.originalTop })
          target.setCoords()
          dd.startU = dragState.originalStartU
          target.deviceData = dd
        }
        if (snap && !snap.valid) {
          shakeAndRevert(target, canvas!)
        }
        canvas!.requestRenderAll()
        return
      }

      // Valid snap — commit to store
      const racks = racksRef.current
      if (!racks) return
      const rack = findRackByIdFromMap(racks, snap.rackId)
      if (!rack) return

      const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)
      const deviceInsetX = RACK_DEFAULTS.deviceInsetX
      const targetRackWidthPx = rack.rackData?.rackWidthPx ?? RACK_DEFAULTS.rackWidthPx

      // Check if device needs resizing (moving between racks of different widths)
      const sourceRackId = dragState?.sourceRackId
      const sourceRack = sourceRackId ? findRackByIdFromMap(racks, sourceRackId) : null
      const sourceRackWidthPx = sourceRack?.rackData?.rackWidthPx ?? RACK_DEFAULTS.rackWidthPx
      const needsResize = sourceRackId !== snap.rackId && targetRackWidthPx !== sourceRackWidthPx

      if (preview && preview.shifts.length > 0) {
        // Commit auto-shift preview: batch all moves as single undo step
        const moves = preview.shifts.map((s) => ({
          deviceId: s.deviceId,
          rackId: snap.rackId,
          startU: s.newStartU,
        }))
        moves.push({ deviceId: dd.id, rackId: snap.rackId, startU: snap.startU })
        useRackStore.getState().batchMoveDevices(moves)

        // Update deviceData.startU on shifted canvas objects
        for (const shift of preview.shifts) {
          for (const obj of canvas!.getObjects()) {
            const objDd = (obj as Group).deviceData
            if (objDd?.id === shift.deviceId) {
              objDd.startU = shift.newStartU
              ;(obj as Group).deviceData = objDd
              break
            }
          }
        }

        // Finalize dragged device position
        const finalX = rackLeft + deviceInsetX
        const finalY = rackTop + snap.snapY + RACK_DEFAULTS.deviceInsetY
        if (needsResize) {
          dd.startU = snap.startU
          resizeDeviceForRack(target, targetRackWidthPx, { x: finalX, y: finalY }, canvas!)
        } else {
          target.set({ left: finalX, top: finalY })
          target.setCoords()
          dd.startU = snap.startU
          target.deviceData = dd
          canvas!.bringObjectToFront(target)
        }
      } else {
        // Simple move (no auto-shift)
        const finalX = rackLeft + deviceInsetX
        const finalY = rackTop + snap.snapY + RACK_DEFAULTS.deviceInsetY
        if (needsResize) {
          dd.startU = snap.startU
          resizeDeviceForRack(target, targetRackWidthPx, { x: finalX, y: finalY }, canvas!)
        } else {
          target.set({ left: finalX, top: finalY })
          target.setCoords()
          dd.startU = snap.startU
          target.deviceData = dd
          canvas!.bringObjectToFront(target)
        }
        useRackStore.getState().moveDevice(dd.id, snap.rackId, snap.startU)
      }

      canvas!.requestRenderAll()
    }

    function handleDragStart(e: { target?: FabricObject }) {
      if (!e.target) return
      const target = e.target as Group

      // Note: pointer-events on cabinet icon are disabled in handleMoving (not here)
      // so that a simple click-to-select doesn't permanently block the icon.

      // Multi-rack drag — collect devices from all racks in the selection
      if (target instanceof ActiveSelection) {
        const objects = target.getObjects() as Group[]
        const rackObjects = objects.filter((o) => o.rackData)
        if (rackObjects.length > 0) {
          const rackIds = rackObjects.map((r) => r.rackData!.id)
          const storeDevices = useRackStore.getState().devices
          const allRackDeviceIds = new Set(
            Object.values(storeDevices)
              .filter((d) => d.rackId != null && rackIds.includes(d.rackId))
              .map((d) => d.id)
          )
          // Exclude devices already in the selection (Fabric moves those automatically)
          const selectionDeviceIds = new Set(
            objects.filter((o) => o.deviceData).map((o) => o.deviceData!.id)
          )
          const devices: FabricObject[] = []
          for (const obj of canvas!.getObjects()) {
            const dd = (obj as Group).deviceData
            if (dd && allRackDeviceIds.has(dd.id) && !selectionDeviceIds.has(dd.id)) {
              devices.push(obj)
            }
          }
          multiRackDragRef.current = {
            initialLeft: target.left ?? 0,
            initialTop: target.top ?? 0,
            lastLeft: target.left ?? 0,
            lastTop: target.top ?? 0,
            devices,
            rackIds,
          }
        }
        return
      }

      // Clear multi-rack state when starting a non-ActiveSelection interaction
      multiRackDragRef.current = null

      // Pause undo history during drag so the entire move is one undo step
      if (target.deviceData) {
        useRackStore.temporal.getState().pause()
      }

      // Rack drag — find all devices belonging to this rack (by store association)
      if (target.rackData) {
        const rackId = target.rackData.id
        const storeDevices = useRackStore.getState().devices
        const rackDeviceIds = new Set(
          Object.values(storeDevices).filter((d) => d.rackId === rackId).map((d) => d.id)
        )
        const devices: FabricObject[] = []
        for (const obj of canvas!.getObjects()) {
          const dd = (obj as Group).deviceData
          if (dd && rackDeviceIds.has(dd.id)) {
            devices.push(obj)
          }
        }
        rackDragRef.current = {
          rackId,
          originalLeft: target.left ?? 0,
          originalTop: target.top ?? 0,
          lastLeft: target.left ?? 0,
          lastTop: target.top ?? 0,
          devices,
        }
        return
      }

      const dd = target.deviceData
      if (!dd) return

      // Bring device to front so it renders above all racks during drag
      canvas!.bringObjectToFront(target)

      // Store original position for revert
      const racks = racksRef.current
      const objCenter = target.getCenterPoint()
      const sourceRack = racks ? findRackAtPoint(racks, objCenter.x, objCenter.y) : null

      dragStateRef.current = {
        originalLeft: target.left ?? 0,
        originalTop: target.top ?? 0,
        originalStartU: dd.startU,
        sourceRackId: sourceRack?.rackData?.id ?? null,
      }
    }

    canvas.on("object:moving", handleMoving as never)
    canvas.on("object:modified", handleModified as never)
    canvas.on("mouse:down", handleDragStart as never)

    return () => {
      canvas.off("object:moving", handleMoving as never)
      canvas.off("object:modified", handleModified as never)
      canvas.off("mouse:down", handleDragStart as never)
    }
  }, [canvasRef, racksRef])
}

// --- Helpers ---

function restorePreviewShifts(canvas: Canvas, preview: PreviewState) {
  for (const shift of preview.shifts) {
    for (const obj of canvas.getObjects()) {
      const objDd = (obj as Group).deviceData
      if (objDd?.id === shift.deviceId) {
        obj.set({ top: shift.originalTop })
        obj.setCoords()
        break
      }
    }
  }
}

/** Replace a device canvas object with one sized for a different rack width. */
function resizeDeviceForRack(
  target: Group,
  rackWidthPx: number,
  position: { x: number; y: number },
  canvas: Canvas
): Group {
  const dd = target.deviceData!
  const replacement = createDevice({ data: dd, position, rackWidthPx })
  replacement.deviceData = dd
  canvas.remove(target)
  canvas.add(replacement)
  canvas.bringObjectToFront(replacement)
  return replacement
}

function findRackByIdFromMap(racks: Map<string, Group>, rackId: string): Group | null {
  for (const [, rack] of racks) {
    if (rack.rackData?.id === rackId) return rack
  }
  return null
}

/**
 * Get the frame rectangle (left, top, width, height) for a rack,
 * using the frame's actual position derived from the group origin.
 */
function getRackFrameRect(rack: Group, groupLeft?: number, groupTop?: number) {
  const rd = rack.rackData!
  const { left: frameLeft, top: frameTop } = getRackFramePosition(rack)
  // Offset from group origin to frame origin
  const ofsX = frameLeft - (rack.left ?? 0)
  const ofsY = frameTop - (rack.top ?? 0)
  // Use enclosure bounds (posts + caps) for collision detection
  const { postWidthPx, capHeightPx } = RACK_DEFAULTS
  return {
    left: (groupLeft ?? rack.left ?? 0) + ofsX - postWidthPx,
    top: (groupTop ?? rack.top ?? 0) + ofsY - capHeightPx,
    width: (rd.rackWidthPx ?? RACK_DEFAULTS.rackWidthPx) + 2 * postWidthPx,
    height: rd.uCount * RACK_DEFAULTS.uHeightPx + 2 * capHeightPx,
  }
}

/** Check if moving `target` rack to (newLeft, newTop) would overlap any other rack. */
function racksOverlap(
  target: Group,
  newLeft: number,
  newTop: number,
  racks: Map<string, Group>
): boolean {
  if (!target.rackData) return false
  const a = getRackFrameRect(target, newLeft, newTop)
  const gap = RACK_DEFAULTS.collisionBufferPx

  for (const other of racks.values()) {
    if (other === target || !other.rackData) continue
    const b = getRackFrameRect(other)

    // AABB overlap check with minimum gap
    if (
      a.left < b.left + b.width + gap &&
      a.left + a.width + gap > b.left &&
      a.top < b.top + b.height + gap &&
      a.top + a.height + gap > b.top
    ) {
      return true
    }
  }
  return false
}

function shakeAndRevert(target: Group, canvas: Canvas) {
  const origLeft = target.left ?? 0
  const steps = [6, -6, 3, -3, 0]
  let i = 0

  function doShake() {
    if (i >= steps.length) {
      target.set({ left: origLeft })
      target.setCoords()
      canvas.requestRenderAll()
      return
    }
    target.set({ left: origLeft + steps[i] })
    target.setCoords()
    canvas.requestRenderAll()
    i++
    requestAnimationFrame(doShake)
  }
  requestAnimationFrame(doShake)
}
