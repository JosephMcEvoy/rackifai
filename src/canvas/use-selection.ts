import { useEffect } from "react"
import type { Canvas, Group } from "fabric"
import type { DeviceData } from "./device"
import type { RackData } from "./rack"

export interface SelectionState {
  devices: DeviceData[]
  rack: RackData | null
}

/**
 * Hook that tracks selection and notifies parent via callback.
 * Reports both device and rack selections.
 */
export function useSelection(
  canvasRef: React.RefObject<Canvas | null>,
  onSelectionChange?: (selection: SelectionState) => void
) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !onSelectionChange) return

    function updateSelection() {
      const activeObjects = canvas!.getActiveObjects()

      const devices = activeObjects
        .map((o) => (o as Group).deviceData)
        .filter((dd): dd is DeviceData => !!dd)

      // Single rack selected (not devices)
      let rack: RackData | null = null
      if (devices.length === 0 && activeObjects.length === 1) {
        const rd = (activeObjects[0] as Group).rackData
        if (rd) rack = rd
      }

      onSelectionChange!({ devices, rack })
    }

    function clearAll() {
      onSelectionChange!({ devices: [], rack: null })
    }

    canvas.on("selection:created", updateSelection)
    canvas.on("selection:updated", updateSelection)
    canvas.on("selection:cleared", clearAll)
    canvas.on("object:modified", updateSelection)
    canvas.on("object:removed" as never, updateSelection)

    return () => {
      canvas.off("selection:created", updateSelection)
      canvas.off("selection:updated", updateSelection)
      canvas.off("selection:cleared", clearAll)
      canvas.off("object:modified", updateSelection)
      canvas.off("object:removed" as never, updateSelection)
    }
  }, [canvasRef, onSelectionChange])
}
