import { useEffect, useState, useCallback } from "react"
import type { Canvas, Group, FabricObject } from "fabric"
import { RACK_DEFAULTS } from "./rack"
import { createDevice } from "./device"
import { findRackAtPoint, resolveSnap, uToY, getRackFramePosition } from "./snap"
import type { ContextMenuAction } from "@/components/device-context-menu"
import { useRackStore } from "@/store/rack-store"

export interface ContextMenuState {
  x: number
  y: number
  actions: ContextMenuAction[]
}

export function useContextMenu(
  canvasRef: React.RefObject<Canvas | null>,
  racksRef: React.RefObject<Map<string, Group>>,
  onRemoveRack?: (id: string) => void,
  onDuplicateRack?: (id: string) => void,
  onArchiveRack?: (id: string) => void,
) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const closeMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleContextMenu(e: { target?: FabricObject; e: Event; pointer: { x: number; y: number } }) {
      const mouseEvent = e.e as MouseEvent
      mouseEvent.preventDefault()
      mouseEvent.stopPropagation()

      const target = e.target as Group | undefined
      if (!target) {
        setContextMenu(null)
        return
      }

      const racks = racksRef.current
      if (!racks) return

      // Right-click on a rack (not a device)
      if (target.rackData && !target.deviceData) {
        const rackId = target.rackData.id
        const rackName = target.rackData.name
        const actions: ContextMenuAction[] = []
        if (onDuplicateRack) {
          actions.push({
            label: "Duplicate",
            onClick: () => onDuplicateRack(rackId),
          })
        }
        if (onArchiveRack) {
          actions.push({
            label: "Send to Cabinet",
            onClick: () => onArchiveRack(rackId),
          })
        }
        if (onRemoveRack) {
          actions.push({
            label: `Delete "${rackName}"`,
            danger: true,
            onClick: () => onRemoveRack(rackId),
          })
        }
        if (actions.length > 0) {
          setContextMenu({
            x: mouseEvent.clientX,
            y: mouseEvent.clientY,
            actions,
          })
        }
        return
      }

      const dd = target.deviceData
      if (!dd) {
        setContextMenu(null)
        return
      }

      const actions: ContextMenuAction[] = []

      // Find current rack
      const objCenter = target.getCenterPoint()
      const currentRack = findRackAtPoint(racks, objCenter.x, objCenter.y)

      // Duplicate
      actions.push({
        label: "Duplicate",
        onClick: () => {
          if (!currentRack) return
          const rd = currentRack.rackData!
          const { left: rackLeft, top: rackTop } = getRackFramePosition(currentRack)

          // Find first free slot
          for (let u = 1; u <= rd.uCount - dd.uHeight + 1; u++) {
            const localY = uToY(u + dd.uHeight - 1, rd.uCount)
            const snap = resolveSnap(currentRack, localY + RACK_DEFAULTS.uHeightPx / 2, dd.uHeight, dd.isFullDepth)
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
              })
              canvas!.requestRenderAll()
              break
            }
          }
        },
      })

      // Send to Cabinet (soft delete)
      actions.push({
        label: "Send to Cabinet",
        onClick: () => {
          useRackStore.getState().archiveDevice(dd.id)
          canvas!.remove(target)
          canvas!.requestRenderAll()
        },
      })

      // Delete permanently
      actions.push({
        label: "Delete",
        danger: true,
        onClick: () => {
          useRackStore.getState().removeDevice(dd.id)
          canvas!.remove(target)
          canvas!.requestRenderAll()
        },
      })

      setContextMenu({
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
        actions,
      })
    }

    canvas.on("mouse:down", (e: { e: Event }) => {
      const mouseEvent = e.e as MouseEvent
      if (mouseEvent.button !== 2) setContextMenu(null)
    })

    // Use contextmenu event on the canvas element for right-click
    const canvasEl = canvas.upperCanvasEl
    const handleNativeContextMenu = (e: Event) => {
      e.preventDefault()
    }
    canvasEl.addEventListener("contextmenu", handleNativeContextMenu)

    canvas.on("mouse:down", (opt: { target?: FabricObject; e: Event; pointer?: { x: number; y: number } }) => {
      const mouseEvent = opt.e as MouseEvent
      if (mouseEvent.button === 2) {
        mouseEvent.preventDefault()
        const target = opt.target as Group | undefined
        if (target?.deviceData || target?.rackData) {
          handleContextMenu({
            target,
            e: opt.e,
            pointer: opt.pointer ?? { x: 0, y: 0 },
          })
        }
      }
    })

    return () => {
      canvasEl.removeEventListener("contextmenu", handleNativeContextMenu)
    }
  }, [canvasRef, racksRef, onRemoveRack, onDuplicateRack, onArchiveRack])

  return { contextMenu, closeMenu }
}
