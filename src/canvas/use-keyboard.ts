import { useEffect } from "react"
import type { Canvas, Group } from "fabric"
import { ActiveSelection } from "fabric"
import { createDevice } from "./device"
import { createRack, RACK_DEFAULTS, widthInchesToPx } from "./rack"
import { findRackAtPoint, resolveSnap, uToY, getRackFramePosition } from "./snap"
import { useRackStore } from "@/store/rack-store"

/**
 * Hook that adds keyboard shortcuts for device manipulation.
 * - Ctrl+Z: undo
 * - Ctrl+Shift+Z / Ctrl+Y: redo
 * - Delete/Backspace: remove selected devices
 * - Ctrl+A: select all racks and devices on canvas
 * - Ctrl+D: duplicate selected devices
 * - Escape: deselect all
 */
export function useKeyboard(
  canvasRef: React.RefObject<Canvas | null>,
  racksRef: React.RefObject<Map<string, Group>>
) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function isTyping(e: KeyboardEvent): boolean {
      const target = e.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
      // Check if editing Fabric IText
      const activeObj = canvas!.getActiveObject()
      if (activeObj && "isEditing" in activeObj && activeObj.isEditing) return true
      return false
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTyping(e)) return

      // Ctrl+Z — undo
      if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        useRackStore.temporal.getState().undo()
        reconcileCanvas(canvas!, racksRef.current!)
        return
      }

      // Ctrl+Shift+Z or Ctrl+Y — redo
      if (
        (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
        (e.key.toLowerCase() === "y" && (e.ctrlKey || e.metaKey) && !e.shiftKey)
      ) {
        e.preventDefault()
        useRackStore.temporal.getState().redo()
        reconcileCanvas(canvas!, racksRef.current!)
        return
      }

      const activeObjects = canvas!.getActiveObjects()

      // Delete / Backspace — send selected items to cabinet (soft delete)
      if (e.key === "Delete" || e.key === "Backspace") {
        const devices = activeObjects.filter((o) => (o as Group).deviceData)
        const rackObjects = activeObjects.filter((o) => (o as Group).rackData && !(o as Group).deviceData)
        if (devices.length === 0 && rackObjects.length === 0) return
        e.preventDefault()
        canvas!.discardActiveObject()

        // Build batch archive list
        const archiveItems: Array<{ id: string; type: "rack" | "device" }> = []
        for (const obj of rackObjects) {
          archiveItems.push({ id: (obj as Group).rackData!.id, type: "rack" })
        }
        for (const obj of devices) {
          archiveItems.push({ id: (obj as Group).deviceData!.id, type: "device" })
        }

        // Archive all items in store (copies state to cabinet, then removes)
        useRackStore.getState().batchArchive(archiveItems)

        // Remove standalone device canvas objects
        for (const obj of devices) {
          canvas!.remove(obj)
        }

        // Remove racks and their child device canvas objects
        for (const obj of rackObjects) {
          const rd = (obj as Group).rackData!
          // Remove child device canvas objects that belonged to this rack
          for (const canvasObj of [...canvas!.getObjects()]) {
            const dd = (canvasObj as Group).deviceData
            if (dd && dd.rackId === rd.id) {
              canvas!.remove(canvasObj)
            }
          }
          canvas!.remove(obj)
          racksRef.current!.delete(rd.id)
        }
        canvas!.requestRenderAll()
        return
      }

      // Ctrl+A — select all racks and devices (exclude ghosts)
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const allDevices = canvas!.getObjects().filter((o) => {
          const g = o as Group
          return (g.deviceData || g.rackData) && !g._isGhost
        })
        if (allDevices.length === 0) return
        if (allDevices.length === 1) {
          canvas!.setActiveObject(allDevices[0])
        } else {
          const sel = new ActiveSelection(allDevices, { canvas: canvas! })
          canvas!.setActiveObject(sel)
        }
        canvas!.requestRenderAll()
        return
      }

      // Ctrl+D — duplicate selected devices
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const devices = activeObjects.filter((o) => (o as Group).deviceData) as Group[]
        if (devices.length === 0) return

        const racks = racksRef.current
        if (!racks) return

        for (const dev of devices) {
          const dd = dev.deviceData!
          const objCenter = dev.getCenterPoint()
          const rack = findRackAtPoint(racks, objCenter.x, objCenter.y)
          if (!rack) continue

          const rd = rack.rackData!
          const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)

          // Find first free slot
          for (let u = 1; u <= rd.uCount - dd.uHeight + 1; u++) {
            const localY = uToY(u + dd.uHeight - 1, rd.uCount) + RACK_DEFAULTS.uHeightPx / 2
            const face = useRackStore.getState().viewFace
            const storeRack = useRackStore.getState().racks[rd.id]
            const snap = resolveSnap(rack, localY, dd.uHeight, dd.isFullDepth, face, storeRack?.formFactor)
            if (snap.valid) {
              const newDev = createDevice({
                data: {
                  catalogId: dd.catalogId,
                  name: dd.name,
                  manufacturer: dd.manufacturer,
                  model: dd.model,
                  uHeight: dd.uHeight,
                  isFullDepth: dd.isFullDepth,
                  startU: snap.startU,
                  powerWatts: dd.powerWatts,
                  weightKg: dd.weightKg,
                  category: dd.category,
                  face,
                },
                position: {
                  x: rackLeft,
                  y: rackTop + snap.snapY,
                },
              })
              canvas!.add(newDev)
              // Sync to store for undo/redo
              const newDd = newDev.deviceData!
              useRackStore.getState().placeDevice({
                id: newDd.id,
                rackId: rd.id,
                catalogId: newDd.catalogId,
                name: newDd.name,
                manufacturer: newDd.manufacturer,
                model: newDd.model,
                uHeight: newDd.uHeight,
                isFullDepth: newDd.isFullDepth,
                startU: snap.startU,
                powerWatts: newDd.powerWatts,
                weightKg: newDd.weightKg,
                category: newDd.category,
                face,
              })
              break
            }
          }
        }
        canvas!.requestRenderAll()
        return
      }

      // Escape — deselect all
      if (e.key === "Escape") {
        canvas!.discardActiveObject()
        canvas!.requestRenderAll()
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [canvasRef, racksRef])
}

/**
 * After undo/redo, sync Fabric canvas to match the current store state.
 * Does a full sync: removes stale racks/devices, repositions moved ones, adds missing ones.
 */
export function reconcileCanvas(
  canvas: Canvas,
  racks: Map<string, Group>,
) {
  const { racks: storeRacks, devices: storeDevices, viewFace } = useRackStore.getState()
  let changed = false

  // --- Reconcile racks ---

  // Remove canvas racks not in store, or those with visual property mismatches
  for (const [id, rackGroup] of racks) {
    const storeRack = storeRacks[id]
    const rd = rackGroup.rackData

    // Rack deleted from store
    const shouldRemove = !storeRack
    // Visual property mismatch — must rebuild
    const visualMismatch = storeRack && rd && (
      storeRack.uCount !== rd.uCount ||
      widthInchesToPx(storeRack.widthInches) !== rd.rackWidthPx ||
      (storeRack.startingUnit ?? 1) !== rd.startingUnit ||
      (storeRack.descendingUnits ?? false) !== rd.descendingUnits
    )

    if (shouldRemove || visualMismatch) {
      // Remove devices that were on this rack from canvas (by ID, not bounding box)
      const rackId = rd?.id ?? id
      for (const obj of [...canvas.getObjects()]) {
        const dd = (obj as Group).deviceData
        if (!dd) continue
        // Remove if: belongs to this rack (will be recreated) OR orphaned (not in store)
        const storeDevice = storeDevices[dd.id]
        if (!storeDevice || storeDevice.rackId === rackId) {
          canvas.remove(obj)
        }
      }
      canvas.remove(rackGroup)
      racks.delete(id)
      changed = true
    }
  }

  // Add racks from store that are missing on canvas (deleted above or newly added)
  for (const [id, rs] of Object.entries(storeRacks)) {
    if (!racks.has(id)) {
      const rack = createRack({
        name: rs.name,
        uCount: rs.uCount,
        position: { x: rs.left, y: rs.top },
        widthInches: rs.widthInches,
        startingUnit: rs.startingUnit,
        descendingUnits: rs.descendingUnits,
      })
      rack.rackData!.id = id
      canvas.add(rack)
      racks.set(id, rack)
      changed = true
    }
  }

  // --- Reconcile devices ---

  // Build a map of canvas device objects by ID
  const canvasDevices = new Map<string, Group>()
  for (const obj of canvas.getObjects()) {
    const dd = (obj as Group).deviceData
    if (dd) canvasDevices.set(dd.id, obj as Group)
  }

  // Remove canvas objects whose ID is NOT in the store
  for (const [id, obj] of canvasDevices) {
    if (!(id in storeDevices)) {
      canvas.remove(obj)
      canvasDevices.delete(id)
      changed = true
    }
  }

  // Reposition or add devices from store — opposite-face devices as ghosts
  for (const [id, ds] of Object.entries(storeDevices)) {
    const isGhost = (ds.face ?? "front") !== viewFace

    const rack = findRackById(racks, ds.rackId)
    if (!rack) continue

    const rd = rack.rackData!
    const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)
    const targetTop = rackTop + uToY(ds.startU + ds.uHeight - 1, rd.uCount)

    const existing = canvasDevices.get(id)
    const rackLeft_inset = rackLeft + RACK_DEFAULTS.deviceInsetX
    const targetTop_inset = targetTop + RACK_DEFAULTS.deviceInsetY

    // If ghost status changed (face was toggled via undo/redo), recreate the object
    if (existing && (!!existing._isGhost !== isGhost)) {
      canvas.remove(existing)
      canvasDevices.delete(id)
      // Fall through to create below
    }

    const existingAfterCheck = canvasDevices.get(id)
    if (existingAfterCheck) {
      // Reposition if needed
      const curLeft = existingAfterCheck.left ?? 0
      const curTop = existingAfterCheck.top ?? 0
      if (Math.abs(curLeft - rackLeft_inset) > 1 || Math.abs(curTop - targetTop_inset) > 1 ||
          existingAfterCheck.deviceData?.startU !== ds.startU) {
        existingAfterCheck.set({ left: rackLeft_inset, top: targetTop_inset })
        existingAfterCheck.setCoords()
        if (existingAfterCheck.deviceData) {
          existingAfterCheck.deviceData.startU = ds.startU
          existingAfterCheck.deviceData.rackId = ds.rackId
        }
        changed = true
      }
    } else {
      // Create canvas object for device that exists in store but not on canvas
      const dev = createDevice({
        data: {
          catalogId: ds.catalogId,
          name: ds.name,
          manufacturer: ds.manufacturer,
          model: ds.model,
          uHeight: ds.uHeight,
          isFullDepth: ds.isFullDepth,
          startU: ds.startU,
          powerWatts: ds.powerWatts,
          weightKg: ds.weightKg,
          category: ds.category,
          face: ds.face,
        },
        position: { x: rackLeft_inset, y: targetTop_inset },
        rackWidthPx: rd.rackWidthPx,
        isGhost,
      })
      // Preserve the original device ID so future undo/redo can find it
      dev.deviceData!.id = ds.id
      canvas.add(dev)
      changed = true
    }
  }

  if (changed) {
    canvas.discardActiveObject()
    canvas.requestRenderAll()
  }
}

function findRackById(racks: Map<string, Group>, rackId: string): Group | null {
  for (const [, rack] of racks) {
    if (rack.rackData?.id === rackId) return rack
  }
  return null
}
