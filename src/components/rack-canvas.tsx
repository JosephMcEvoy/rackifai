import { useRef, useImperativeHandle, forwardRef, useCallback, useEffect } from "react"
import { Point, type Group } from "fabric"
import { RACK_DEFAULTS } from "@/canvas/rack"
import { useCanvas } from "@/canvas/use-canvas"
import { useRack } from "@/canvas/use-rack"
import { useSnap } from "@/canvas/use-snap"
import { useContextMenu } from "@/canvas/use-context-menu"
import { useKeyboard, reconcileCanvas } from "@/canvas/use-keyboard"
import { useSelection } from "@/canvas/use-selection"
import { DeviceContextMenu } from "@/components/device-context-menu"
import { exportSvg } from "@/lib/export-svg"
import { exportPdf } from "@/lib/export-pdf"
import { useRackStore } from "@/store/rack-store"
import type { CatalogDevice } from "@/lib/catalog-data"
import type { DeviceState } from "@/store/rack-store"
import type { SelectionState } from "@/canvas/use-selection"
import type { ExportSettings } from "@/components/export-modal"

export interface RackCanvasHandle {
  dropDeviceFromCatalog: (device: CatalogDevice, domX: number, domY: number) => boolean
  restoreDeviceFromCabinet: (deviceState: DeviceState, archiveId: string, domX: number, domY: number) => boolean
  exportCanvas: (settings: ExportSettings) => void
  addRack: () => string
  undo: () => void
  redo: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomFit: () => void
  getZoom: () => number
  reconcile: () => void
}

interface RackCanvasProps {
  onSelectionChange?: (selection: SelectionState) => void
}

export const RackCanvas = forwardRef<RackCanvasHandle, RackCanvasProps>(
  function RackCanvas({ onSelectionChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useCanvas(containerRef)
    const { racksRef, addRack, removeRack, duplicateRack, dropDeviceFromCatalog, restoreDeviceFromCabinet } = useRack(canvasRef)
    useSnap(canvasRef, racksRef)
    useKeyboard(canvasRef, racksRef)

    const archiveRack = useCallback(
      (id: string) => {
        const canvas = canvasRef.current
        const rack = racksRef.current.get(id)
        if (!canvas || !rack) return

        // Capture child device IDs before archiving (store will remove them)
        const storeDevices = useRackStore.getState().devices
        const rackDeviceIds = new Set(
          Object.values(storeDevices)
            .filter((d) => d.rackId === id)
            .map((d) => d.id)
        )

        // Archive in store (copies state to cabinet, then removes from racks/devices)
        useRackStore.getState().archiveRack(id)

        // Remove child device canvas objects
        const devicesToRemove = canvas.getObjects().filter((obj) => {
          const dd = (obj as Group).deviceData
          return dd != null && rackDeviceIds.has(dd.id)
        })
        for (const dev of devicesToRemove) canvas.remove(dev)

        // Remove rack canvas object
        canvas.remove(rack)
        racksRef.current.delete(id)
        canvas.requestRenderAll()
      },
      [canvasRef, racksRef]
    )

    const { contextMenu, closeMenu } = useContextMenu(canvasRef, racksRef, removeRack, duplicateRack, archiveRack)
    useSelection(canvasRef, onSelectionChange)

    const exportCanvas = useCallback(async (settings: ExportSettings) => {
      const store = useRackStore.getState()

      // Build export bundles from store data (used by SVG, PDF, and VSDX)
      const bundles = Object.values(store.racks).map(rack => ({
        rack: {
          id: rack.id,
          name: rack.name,
          uCount: rack.uCount,
          widthInches: rack.widthInches,
          startingUnit: rack.startingUnit,
          descendingUnits: rack.descendingUnits,
        },
        devices: store.getRackDevices(rack.id),
      }))

      if (settings.format === "svg") {
        exportSvg(bundles, {
          projectName: store.projectName,
          includeTitle: settings.includeHeader,
        })
      } else if (settings.format === "pdf") {
        await exportPdf(bundles, {
          projectName: store.projectName,
          pageSize: settings.pageSize,
          orientation: settings.orientation,
          includeHeader: settings.includeHeader,
        })
      } else if (settings.format === "vsdx") {
        const { exportVsdx } = await import("@/lib/export-vsdx")
        const { getDeviceImageUrl } = await import("@/lib/catalog-data")
        const vsdxRacks: Parameters<typeof exportVsdx>[0]["racks"] = []
        for (const [, rackGroup] of racksRef.current) {
          const rd = rackGroup.rackData
          if (!rd) continue
          vsdxRacks.push({ data: rd, devices: store.getRackDevices(rd.id) })
        }
        await exportVsdx({
          projectName: store.projectName,
          racks: vsdxRacks,
          includeImages: settings.includeImages,
          resolveImage: getDeviceImageUrl,
        })
      }
    }, [racksRef])

    const zoomIn = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const zoom = Math.min(canvas.getZoom() * 1.2, 5)
      const center = canvas.getCenterPoint()
      canvas.zoomToPoint(new Point(center.x, center.y), zoom)
    }, [canvasRef])

    const zoomOut = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const zoom = Math.max(canvas.getZoom() / 1.2, 0.1)
      const center = canvas.getCenterPoint()
      canvas.zoomToPoint(new Point(center.x, center.y), zoom)
    }, [canvasRef])

    const zoomFit = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (racksRef.current.size === 0) {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
        canvas.requestRenderAll()
        return
      }
      // Calculate bounding box using rack frame positions + known dimensions
      const { postWidthPx, capHeightPx, nameHeightPx, uHeightPx } = RACK_DEFAULTS
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const rack of racksRef.current.values()) {
        const rd = rack.rackData
        if (!rd) continue
        // getRackFramePosition equivalent: center + child frame offset
        const center = rack.getCenterPoint()
        const frame = rack.getObjects()[1] // inner frame
        const frameLeft = center.x + (frame.left ?? 0) - (frame.width ?? 0) / 2
        const frameTop = center.y + (frame.top ?? 0) - (frame.height ?? 0) / 2
        // Visual bounds: from name above to cap below, posts on sides
        const rackW = rd.rackWidthPx + 2 * postWidthPx
        const rackH = rd.uCount * uHeightPx + 2 * capHeightPx + nameHeightPx
        const x = frameLeft - postWidthPx
        const y = frameTop - capHeightPx - nameHeightPx
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x + rackW)
        maxY = Math.max(maxY, y + rackH)
      }
      const contentW = maxX - minX
      const contentH = maxY - minY
      const cx = minX + contentW / 2
      const cy = minY + contentH / 2
      const canvasW = canvas.getWidth()
      const canvasH = canvas.getHeight()
      const padding = 50
      const zoom = Math.min(
        (canvasW - padding * 2) / contentW,
        (canvasH - padding * 2) / contentH,
        1, // don't zoom in past 100%
      )
      const clampedZoom = Math.max(zoom, 0.1)
      canvas.setViewportTransform([
        clampedZoom, 0, 0, clampedZoom,
        canvasW / 2 - cx * clampedZoom,
        canvasH / 2 - cy * clampedZoom,
      ])
      canvas.requestRenderAll()
    }, [canvasRef, racksRef])

    // Center on content after initial load
    useEffect(() => {
      // Defer to next frame so racks are fully rendered on canvas
      const id = requestAnimationFrame(() => zoomFit())
      return () => cancelAnimationFrame(id)
    }, [zoomFit])

    const getZoom = useCallback(() => {
      return canvasRef.current?.getZoom() ?? 1
    }, [canvasRef])

    const undo = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      useRackStore.temporal.getState().undo()
      reconcileCanvas(canvas, racksRef.current)
    }, [canvasRef, racksRef])

    const redo = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      useRackStore.temporal.getState().redo()
      reconcileCanvas(canvas, racksRef.current)
    }, [canvasRef, racksRef])

    const reconcile = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      reconcileCanvas(canvas, racksRef.current)
    }, [canvasRef, racksRef])

    useImperativeHandle(ref, () => ({
      dropDeviceFromCatalog,
      restoreDeviceFromCabinet,
      exportCanvas,
      addRack,
      undo,
      redo,
      zoomIn,
      zoomOut,
      zoomFit,
      getZoom,
      reconcile,
    }), [dropDeviceFromCatalog, restoreDeviceFromCabinet, exportCanvas, addRack, undo, redo, zoomIn, zoomOut, zoomFit, getZoom, reconcile])

    return (
      <div ref={containerRef} className="absolute inset-0">
        <canvas />
        {contextMenu && (
          <DeviceContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={contextMenu.actions}
            onClose={closeMenu}
          />
        )}
      </div>
    )
  }
)
