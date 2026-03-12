import { forwardRef, useState, useCallback, useRef, useImperativeHandle } from "react"
import { useDroppable } from "@dnd-kit/core"
import { RackCanvas, type RackCanvasHandle } from "@/components/rack-canvas"
import { PropertiesPanel } from "@/components/properties-panel"
import { RackPropertiesPanel } from "@/components/rack-properties-panel"
import { RackStatsPanel } from "@/components/rack-stats-panel"
import { CabinetIcon } from "@/components/cabinet/cabinet-icon"
import { CabinetPanel } from "@/components/cabinet/cabinet-panel"
import type { RackData } from "@/canvas/rack"
import type { SelectionState } from "@/canvas/use-selection"

export const CanvasArea = forwardRef<RackCanvasHandle>(function CanvasArea(_props, ref) {
  const { setNodeRef, isOver } = useDroppable({ id: "rack-canvas-drop" })
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [selectedRack, setSelectedRack] = useState<RackData | null>(null)
  const [cabinetOpen, setCabinetOpen] = useState(false)
  const canvasHandleRef = useRef<RackCanvasHandle>(null)

  // Forward both the local ref and the parent ref
  useImperativeHandle(ref, () => canvasHandleRef.current!, [])

  const handleSelectionChange = useCallback((selection: SelectionState) => {
    setSelectedDeviceIds(selection.devices.map((d) => d.id))
    setSelectedRack(selection.rack)
  }, [])

  const handleRestore = useCallback(() => {
    canvasHandleRef.current?.reconcile()
  }, [])

  const showDevicePanel = selectedDeviceIds.length > 0
  const showRackPanel = !showDevicePanel && selectedRack !== null

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden">
      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={setNodeRef}
          className={`relative flex-1 overflow-hidden bg-background transition-shadow ${
            isOver ? "ring-2 ring-primary/40 ring-inset" : ""
          }`}
        >
          <RackCanvas ref={canvasHandleRef} onSelectionChange={handleSelectionChange} />
          <CabinetIcon onClick={() => setCabinetOpen((v) => !v)} />
          <CabinetPanel open={cabinetOpen} onClose={() => setCabinetOpen(false)} onReconcile={handleRestore} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-[5] pointer-events-none">
        <div className="pointer-events-auto">
          <RackStatsPanel />
        </div>
      </div>
      <aside
        className={`absolute top-0 right-0 h-full w-72 z-10 border-l border-border bg-card overflow-y-auto transition-transform duration-300 ease-in-out ${
          showDevicePanel || showRackPanel
            ? "translate-x-0"
            : "translate-x-full"
        }`}
      >
        {showDevicePanel && <PropertiesPanel deviceIds={selectedDeviceIds} />}
        {showRackPanel && <RackPropertiesPanel rackId={selectedRack!.id} />}
      </aside>
    </div>
  )
})
