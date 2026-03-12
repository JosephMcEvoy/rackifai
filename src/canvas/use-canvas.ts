import { useEffect, useRef } from "react"
import { ActiveSelection, Canvas, Point, type FabricObject } from "fabric"
import { useRackStore } from "@/store/rack-store"

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_SENSITIVITY = 0.999

const CANVAS_BG = "#12121f"
const GRID_SIZE = 20
const GRID_DOT_RADIUS = 1
const GRID_DOT_COLOR = "rgba(255, 255, 255, 0.15)"

export function useCanvas(
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const canvasRef = useRef<Canvas | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Guard against React StrictMode double-mount
    if (canvasRef.current) return

    const canvasEl = container.querySelector("canvas")
    if (!canvasEl) return

    let disposed = false
    let resizeRafId: number | null = null
    let zoomRafId: number | null = null

    // Initialize Fabric canvas
    const canvas = new Canvas(canvasEl, {
      backgroundColor: CANVAS_BG,
      selection: true,
      preserveObjectStacking: true,
      // Use Ctrl+Click (or Cmd+Click) for multi-select instead of Shift+Click
      selectionKey: "ctrlKey",
    })
    canvasRef.current = canvas

    // Disable resize/rotate controls on area selections (ActiveSelection)
    function disableSelectionControls() {
      const sel = canvas.getActiveObject()
      if (sel instanceof ActiveSelection) {
        sel.set({
          hasControls: false,
          hasBorders: false,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
          perPixelTargetFind: true,
        })
        canvas.requestRenderAll()
      }
    }
    canvas.on("selection:created", disableSelectionControls)
    canvas.on("selection:updated", disableSelectionControls)

    const { width, height } = container.getBoundingClientRect()
    canvas.setDimensions({ width, height })

    // Grid dots — injected between background and objects by patching _renderObjects.
    // Fabric v6 render order: clear → background → viewport transform → _renderObjects → after:render
    const origRenderObjects = canvas._renderObjects.bind(canvas)
    canvas._renderObjects = function (ctx: CanvasRenderingContext2D, objects: FabricObject[]) {
      if (useRackStore.getState().showGrid) {
        const vpt = canvas.viewportTransform
        if (vpt) {
          const zoom = canvas.getZoom()
          const panX = vpt[4]
          const panY = vpt[5]
          const cw = canvas.getWidth()
          const ch = canvas.getHeight()

          ctx.save()
          ctx.setTransform(zoom, 0, 0, zoom, panX, panY)
          ctx.fillStyle = GRID_DOT_COLOR

          const startX = Math.floor(-panX / zoom / GRID_SIZE) * GRID_SIZE
          const startY = Math.floor(-panY / zoom / GRID_SIZE) * GRID_SIZE
          const endX = Math.ceil((cw - panX) / zoom / GRID_SIZE) * GRID_SIZE
          const endY = Math.ceil((ch - panY) / zoom / GRID_SIZE) * GRID_SIZE

          const r = GRID_DOT_RADIUS
          for (let x = startX; x <= endX; x += GRID_SIZE) {
            for (let y = startY; y <= endY; y += GRID_SIZE) {
              ctx.beginPath()
              ctx.arc(x, y, r, 0, Math.PI * 2)
              ctx.fill()
            }
          }
          ctx.restore()
        }
      }
      origRenderObjects(ctx, objects)
    }

    // Re-render canvas when grid toggle changes
    const unsubGrid = useRackStore.subscribe(
      (s) => s.showGrid,
      () => canvas.requestRenderAll(),
    )

    // ResizeObserver (RAF-gated)
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return
      const entry = entries[0]
      if (!entry) return
      if (resizeRafId) cancelAnimationFrame(resizeRafId)
      resizeRafId = requestAnimationFrame(() => {
        if (disposed) return
        const { width: w, height: h } = entry.contentRect
        canvas.setDimensions({ width: w, height: h })
        canvas.requestRenderAll()
      })
    })
    resizeObserver.observe(container)

    // Zoom: scroll wheel (RAF-gated)
    let pendingZoomDelta = 0
    let pendingZoomPoint = { x: 0, y: 0 }

    canvas.on("mouse:wheel", (opt) => {
      pendingZoomDelta += opt.e.deltaY
      pendingZoomPoint = { x: opt.e.offsetX, y: opt.e.offsetY }
      opt.e.preventDefault()
      // Don't stopPropagation — dnd-kit needs to see wheel events for scroll tracking

      if (zoomRafId) return
      zoomRafId = requestAnimationFrame(() => {
        if (disposed) return
        let zoom = canvas.getZoom()
        zoom *= ZOOM_SENSITIVITY ** pendingZoomDelta
        zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
        canvas.zoomToPoint(new Point(pendingZoomPoint.x, pendingZoomPoint.y), zoom)
        pendingZoomDelta = 0
        zoomRafId = null
      })
    })

    // Pan: space + drag
    let isPanning = false
    let spaceDown = false
    let lastPosX = 0
    let lastPosY = 0

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // Skip pan activation when editing IText
      const activeObj = canvas.getActiveObject()
      if (activeObj && "isEditing" in activeObj && activeObj.isEditing) return
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault()
        spaceDown = true
        const upper = canvas.upperCanvasEl
        if (upper) upper.style.cursor = "grab"
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown = false
        isPanning = false
        canvas.selection = true
        const upper = canvas.upperCanvasEl
        if (upper) upper.style.cursor = "default"
      }
    }

    canvas.on("mouse:down", (opt) => {
      if (!(opt.e instanceof MouseEvent)) return

      // Middle mouse button pan
      if (opt.e.button === 1) {
        opt.e.preventDefault()
        isPanning = true
        canvas.selection = false
        lastPosX = opt.e.clientX
        lastPosY = opt.e.clientY
        const upper = canvas.upperCanvasEl
        if (upper) upper.style.cursor = "grabbing"
        return
      }

      // Space + left click pan
      if (spaceDown) {
        isPanning = true
        canvas.selection = false
        lastPosX = opt.e.clientX
        lastPosY = opt.e.clientY
        const upper = canvas.upperCanvasEl
        if (upper) upper.style.cursor = "grabbing"
      }
    })

    canvas.on("mouse:move", (opt) => {
      if (!isPanning || !(opt.e instanceof MouseEvent)) return
      const vpt = canvas.viewportTransform
      if (!vpt) return
      vpt[4] += opt.e.clientX - lastPosX
      vpt[5] += opt.e.clientY - lastPosY
      canvas.requestRenderAll()
      lastPosX = opt.e.clientX
      lastPosY = opt.e.clientY
    })

    canvas.on("mouse:up", () => {
      if (isPanning) {
        const vpt = canvas.viewportTransform
        if (vpt) canvas.setViewportTransform([...vpt] as typeof vpt)
        isPanning = false
        canvas.selection = true
        const upper = canvas.upperCanvasEl
        if (upper) upper.style.cursor = spaceDown ? "grab" : "default"
      }
    })

    // Prevent browser default middle-click behavior (auto-scroll)
    const canvasUpper = canvas.upperCanvasEl
    const preventMiddleDefault = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault()
    }
    if (canvasUpper) canvasUpper.addEventListener("mousedown", preventMiddleDefault)

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)

    // Cleanup
    return () => {
      disposed = true
      spaceDown = false
      isPanning = false

      if (resizeRafId) cancelAnimationFrame(resizeRafId)
      if (zoomRafId) cancelAnimationFrame(zoomRafId)

      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
      if (canvasUpper) canvasUpper.removeEventListener("mousedown", preventMiddleDefault)

      unsubGrid()
      resizeObserver.disconnect()
      canvas.dispose()
      canvasRef.current = null
    }
    // containerRef is a stable React ref -- its identity never changes,
    // so omitting it from deps is safe. This effect runs once on mount.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return canvasRef
}
