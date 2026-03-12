import { useEffect, useCallback, useRef } from "react"
import type { Canvas, Group, IText } from "fabric"
import { createRack, RACK_DEFAULTS, snapToGrid, widthInchesToPx, type CreateRackOptions } from "./rack"
import { createDevice, overlayDeviceImage, removeImageOverlays, type DeviceCategory } from "./device"
import { uToY, findRackAtPoint, toRackLocalY, resolveSnap, getRackFramePosition, getOccupancy, autoShift } from "./snap"
import { getDeviceImageUrl, type CatalogDevice } from "@/lib/catalog-data"
import { useRackStore, type DeviceState } from "@/store/rack-store"

function restoreRacksFromStore(
  canvas: Canvas,
  racksRef: React.RefObject<Map<string, Group>>,
) {
  const { racks, devices } = useRackStore.getState()
  const rackEntries = Object.values(racks)

  // Create canvas rack objects from store state
  for (const rs of rackEntries) {
    const rack = createRack({
      name: rs.name,
      uCount: rs.uCount,
      position: { x: rs.left, y: rs.top },
      widthInches: rs.widthInches,
      startingUnit: rs.startingUnit,
      descendingUnits: rs.descendingUnits,
    })
    // Override the generated ID with the stored one
    rack.rackData!.id = rs.id
    canvas.add(rack)
    racksRef.current!.set(rs.id, rack)
  }

  // Create canvas device objects from store state
  // All devices are shown; opposite-face devices render as ghosts
  const viewFace = useRackStore.getState().viewFace
  for (const ds of Object.values(devices)) {
    const rack = racksRef.current!.get(ds.rackId)
    if (!rack) continue
    const rd = rack.rackData!
    const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)
    const isGhost = (ds.face ?? "front") !== viewFace
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
      position: {
        x: rackLeft + RACK_DEFAULTS.deviceInsetX,
        y: rackTop + uToY(ds.startU + ds.uHeight - 1, rd.uCount) + RACK_DEFAULTS.deviceInsetY,
      },
      rackWidthPx: rd.rackWidthPx,
      isGhost,
    })
    dev.deviceData!.id = ds.id
    canvas.add(dev)
    if (!isGhost) maybeOverlayImage(dev, canvas)
  }

}

function createDefaultRack(
  canvas: Canvas,
  racksRef: React.RefObject<Map<string, Group>>,
) {
  const rack = createRack({ name: "Rack A" })
  canvas.add(rack)
  const rackId = rack.rackData!.id
  racksRef.current!.set(rackId, rack)

  // Register rack in store for undo/redo tracking
  const rd = rack.rackData!
  useRackStore.getState().addRack({
    id: rackId,
    name: rd.name,
    uCount: rd.uCount,
    left: rack.left ?? 0,
    top: rack.top ?? 0,
    startingUnit: rd.startingUnit,
    descendingUnits: rd.descendingUnits,
  })

  // Add demo devices
  const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)
  const demoDevices: Array<{
    name: string; manufacturer: string; model: string
    uHeight: number; startU: number; category: DeviceCategory
  }> = [
    { name: "Core Switch", manufacturer: "Cisco", model: "Nexus 9336C", uHeight: 1, startU: 42, category: "switch" },
    { name: "Patch Panel", manufacturer: "Panduit", model: "CP48", uHeight: 1, startU: 41, category: "patch_panel" },
    { name: "App Server 1", manufacturer: "Dell", model: "R750", uHeight: 2, startU: 38, category: "server" },
    { name: "Storage Array", manufacturer: "NetApp", model: "AFF A250", uHeight: 4, startU: 1, category: "storage" },
  ]

  for (const d of demoDevices) {
    const dev = createDevice({
      data: {
        catalogId: "",
        name: d.name,
        manufacturer: d.manufacturer,
        model: d.model,
        uHeight: d.uHeight,
        isFullDepth: true,
        startU: d.startU,
        powerWatts: 0,
        weightKg: 0,
        category: d.category,
      },
      position: {
        x: rackLeft + RACK_DEFAULTS.deviceInsetX,
        y: rackTop + uToY(d.startU + d.uHeight - 1, rd.uCount) + RACK_DEFAULTS.deviceInsetY,
      },
    })
    canvas.add(dev)
    maybeOverlayImage(dev, canvas)

    const dd = dev.deviceData!
    useRackStore.getState().placeDevice({
      id: dd.id,
      rackId,
      catalogId: dd.catalogId,
      name: dd.name,
      manufacturer: dd.manufacturer,
      model: dd.model,
      uHeight: dd.uHeight,
      isFullDepth: dd.isFullDepth,
      startU: dd.startU,
      powerWatts: dd.powerWatts,
      weightKg: dd.weightKg,
      category: dd.category,
    })
  }
}

function maybeOverlayImage(dev: Group, canvas: Canvas) {
  if (!useRackStore.getState().showDeviceImages) return
  const dd = dev.deviceData!
  const face = useRackStore.getState().viewFace
  const url = getDeviceImageUrl(dd.catalogId, face)
  if (url) overlayDeviceImage(dev, url, canvas)
}

export function useRack(canvasRef: React.RefObject<Canvas | null>) {
  const racksRef = useRef<Map<string, Group>>(new Map())

  // Initialize racks on mount: restore from store if data exists, otherwise create defaults
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { racks } = useRackStore.getState()
    const hasStoreRacks = Object.keys(racks).length > 0

    if (hasStoreRacks) {
      restoreRacksFromStore(canvas, racksRef)
    } else {
      createDefaultRack(canvas, racksRef)
    }

    // Clear undo history so initial setup isn't undoable
    useRackStore.temporal.getState().clear()

    canvas.requestRenderAll()

    const currentRacks = racksRef.current
    return () => {
      currentRacks.forEach((r) => canvas.remove(r))
      currentRacks.clear()
    }
  }, [canvasRef])

  // Sync store rack changes to canvas — name updates in-place,
  // visual property changes (uCount, widthInches, startingUnit, descendingUnits)
  // trigger a full rack + device rebuild.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const unsub = useRackStore.subscribe(
      (s) => s.racks,
      (racks) => {
        let changed = false
        for (const [id, rackGroup] of racksRef.current) {
          const storeRack = racks[id]
          if (!storeRack || !rackGroup.rackData) continue
          const rd = rackGroup.rackData

          // Detect visual property changes that require a full rebuild
          const newWidthPx = widthInchesToPx(storeRack.widthInches)
          const visualChanged =
            storeRack.uCount !== rd.uCount ||
            newWidthPx !== rd.rackWidthPx ||
            (storeRack.startingUnit ?? 1) !== rd.startingUnit ||
            (storeRack.descendingUnits ?? false) !== rd.descendingUnits

          if (visualChanged) {
            // Remove device canvas objects belonging to this rack (by ID, not bounding box)
            const storeDevices = useRackStore.getState().devices
            const rackDeviceIds = new Set(
              Object.entries(storeDevices)
                .filter(([, d]) => d.rackId === id)
                .map(([did]) => did)
            )
            for (const obj of [...canvas.getObjects()]) {
              const dd = (obj as Group).deviceData
              if (!dd) continue
              // Remove if: belongs to this rack (will be recreated) OR orphaned (not in store at all)
              if (rackDeviceIds.has(dd.id) || !(dd.id in storeDevices)) {
                canvas.remove(obj)
              }
            }

            // Remove old rack group from canvas
            canvas.remove(rackGroup)

            // Create new rack with updated props
            const newRack = createRack({
              name: storeRack.name,
              uCount: storeRack.uCount,
              position: { x: storeRack.left, y: storeRack.top },
              widthInches: storeRack.widthInches,
              startingUnit: storeRack.startingUnit,
              descendingUnits: storeRack.descendingUnits,
            })
            newRack.rackData!.id = id
            canvas.add(newRack)
            racksRef.current.set(id, newRack)

            // Recreate all devices at correct positions/widths
            // Opposite-face devices render as ghosts
            const devices = useRackStore.getState().devices
            const currentViewFace = useRackStore.getState().viewFace
            const newRd = newRack.rackData!
            const { left: rackLeft, top: rackTop } = getRackFramePosition(newRack)
            for (const ds of Object.values(devices)) {
              if (ds.rackId !== id) continue
              const isGhost = (ds.face ?? "front") !== currentViewFace
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
                position: {
                  x: rackLeft + RACK_DEFAULTS.deviceInsetX,
                  y: rackTop + uToY(ds.startU + ds.uHeight - 1, newRd.uCount) + RACK_DEFAULTS.deviceInsetY,
                },
                rackWidthPx: newRd.rackWidthPx,
                isGhost,
              })
              dev.deviceData!.id = ds.id
              canvas.add(dev)
              if (!isGhost) maybeOverlayImage(dev, canvas)
            }

            changed = true
            continue
          }

          // Name-only change — update in-place
          if (storeRack.name !== rd.name) {
            rd.name = storeRack.name
            const nameLabel = rackGroup.getObjects().find(
              (o): o is IText => "isEditing" in o
            )
            if (nameLabel) {
              nameLabel.set({ text: storeRack.name })
              changed = true
            }
          }
        }
        if (changed) canvas.requestRenderAll()
      },
    )
    return unsub
  }, [canvasRef])

  // Subscribe to viewFace changes — rebuild device canvas objects when face toggles
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const unsub = useRackStore.subscribe(
      (s) => s.viewFace,
      (viewFace) => {
        // Remove all device canvas objects
        const toRemove = canvas.getObjects().filter((o) => (o as Group).deviceData)
        for (const obj of toRemove) canvas.remove(obj)

        // Recreate all devices — opposite-face devices as ghosts
        const devices = useRackStore.getState().devices
        for (const ds of Object.values(devices)) {
          const rack = racksRef.current.get(ds.rackId)
          if (!rack) continue
          const rd = rack.rackData!
          const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)
          const isGhost = (ds.face ?? "front") !== viewFace
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
            position: {
              x: rackLeft + RACK_DEFAULTS.deviceInsetX,
              y: rackTop + uToY(ds.startU + ds.uHeight - 1, rd.uCount) + RACK_DEFAULTS.deviceInsetY,
            },
            rackWidthPx: rd.rackWidthPx,
            isGhost,
          })
          dev.deviceData!.id = ds.id
          canvas.add(dev)
          if (!isGhost) maybeOverlayImage(dev, canvas)
        }

        canvas.requestRenderAll()
      },
    )
    return unsub
  }, [canvasRef])

  // Subscribe to showDeviceImages toggle — overlay or remove images on all devices
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const unsub = useRackStore.subscribe(
      (s) => s.showDeviceImages,
      (showImages) => {
        for (const obj of canvas.getObjects()) {
          const group = obj as Group
          if (!group.deviceData) continue
          if (showImages) {
            const dd = group.deviceData
            const face = useRackStore.getState().viewFace
            const url = getDeviceImageUrl(dd.catalogId, face)
            if (url) overlayDeviceImage(group, url, canvas)
          } else {
            removeImageOverlays(group)
          }
        }
        canvas.requestRenderAll()
      },
    )
    return unsub
  }, [canvasRef])

  const addRack = useCallback(
    (opts?: CreateRackOptions): string => {
      const canvas = canvasRef.current
      if (!canvas) throw new Error("Canvas not initialized")

      // Auto-position to the right of the top-right rack, centered on same Y
      let resolvedOpts = opts
      if (!opts?.position && racksRef.current.size > 0) {
        let maxRight = 0
        let topRightRack: Group | null = null
        for (const r of racksRef.current.values()) {
          const right = (r.left ?? 0) + (r.width ?? 0)
          if (right > maxRight) {
            maxRight = right
            topRightRack = r
          }
        }
        if (!topRightRack) {
          // Fallback: no valid rack found despite size > 0
          topRightRack = racksRef.current.values().next().value ?? null
        }
        const rawX = maxRight + RACK_DEFAULTS.rackGapPx
        // Align rack body centers: group top includes nameHeightPx above the rack body
        const anchorTop = topRightRack?.top ?? 0
        const anchorUCount = topRightRack?.rackData?.uCount ?? 42
        const anchorBodyCenter = anchorTop + RACK_DEFAULTS.nameHeightPx + (anchorUCount * RACK_DEFAULTS.uHeightPx) / 2
        const newUCount = opts?.uCount ?? 42
        const newBodyCenter = RACK_DEFAULTS.nameHeightPx + (newUCount * RACK_DEFAULTS.uHeightPx) / 2
        const rawY = anchorBodyCenter - newBodyCenter
        resolvedOpts = {
          ...opts,
          position: {
            x: snapToGrid(rawX, RACK_DEFAULTS.rackSnapPx),
            y: snapToGrid(rawY, RACK_DEFAULTS.rackSnapPx),
          },
        }
      }

      const rack = createRack(resolvedOpts)
      const id = rack.rackData!.id
      canvas.add(rack)
      racksRef.current.set(id, rack)

      // Sync to store for undo/redo and persistence
      const rd = rack.rackData!
      useRackStore.getState().addRack({
        id,
        name: rd.name,
        uCount: rd.uCount,
        left: rack.left ?? 0,
        top: rack.top ?? 0,
        widthInches: resolvedOpts?.widthInches,
        startingUnit: rd.startingUnit,
        descendingUnits: rd.descendingUnits,
      })

      canvas.requestRenderAll()
      return id
    },
    [canvasRef]
  )

  const removeRack = useCallback(
    (id: string) => {
      const canvas = canvasRef.current
      const rack = racksRef.current.get(id)
      if (!canvas || !rack) return

      // Remove all devices belonging to this rack from canvas (match by store rackId)
      const storeDevices = useRackStore.getState().devices
      const rackDeviceIds = new Set(
        Object.values(storeDevices).filter((d) => d.rackId === id).map((d) => d.id)
      )
      const devicesToRemove = canvas.getObjects().filter((obj) => {
        const dd = (obj as Group).deviceData
        return dd != null && rackDeviceIds.has(dd.id)
      })
      for (const dev of devicesToRemove) canvas.remove(dev)

      canvas.remove(rack)
      racksRef.current.delete(id)
      useRackStore.getState().removeRack(id)
      canvas.requestRenderAll()
    },
    [canvasRef]
  )

  /**
   * Drop a catalog device onto the canvas at DOM coordinates.
   * Translates DOM → canvas coords, finds the target rack, and snaps to U.
   * Returns true if the device was successfully placed.
   */
  const dropDeviceFromCatalog = useCallback(
    (catalogDevice: CatalogDevice, domX: number, domY: number): boolean => {
      const canvas = canvasRef.current
      if (!canvas) return false

      // Translate DOM coordinates to absolute canvas coordinates
      const canvasEl = canvas.getSelectionElement()
      const rect = canvasEl.getBoundingClientRect()
      const vpt = canvas.viewportTransform
      if (!vpt) return false

      // DOM → canvas absolute coords (accounting for zoom/pan)
      const absX = (domX - rect.left - vpt[4]) / vpt[0]
      const absY = (domY - rect.top - vpt[5]) / vpt[3]

      // Find which rack the drop landed on
      const rack = findRackAtPoint(racksRef.current, absX, absY)
      if (!rack) return false

      // Calculate snap position with face awareness
      const storeState = useRackStore.getState()
      const face = storeState.viewFace
      const storeRack = storeState.racks[rack.rackData!.id]
      const localY = toRackLocalY(rack, absY)
      const snap = resolveSnap(
        rack,
        localY,
        catalogDevice.uHeight,
        catalogDevice.isFullDepth,
        face,
        storeRack?.formFactor,
        undefined,
        storeRack?.allowOverlap
      )

      if (!snap.valid) {
        // Try auto-shift
        if (storeRack && !storeRack.allowOverlap) {
          const occupancy = getOccupancy(rack.rackData!.id)
          const result = autoShift(
            occupancy,
            snap.startU,
            catalogDevice.uHeight,
            catalogDevice.isFullDepth,
            face,
            storeRack.uCount,
            storeRack.formFactor
          )
          if (!result.overflow && result.shifts.length > 0) {
            // Batch all shifts as a single store mutation
            storeState.batchMoveDevices(
              result.shifts.map((s) => ({ deviceId: s.deviceId, rackId: snap.rackId, startU: s.newStartU }))
            )
            // Update canvas positions for shifted devices
            const { top: rackTop } = getRackFramePosition(rack)
            for (const shift of result.shifts) {
              for (const obj of canvas.getObjects()) {
                const objDd = (obj as Group).deviceData
                if (objDd?.id === shift.deviceId) {
                  const shiftedDevice = useRackStore.getState().devices[shift.deviceId]
                  if (shiftedDevice) {
                    const newY = rackTop + uToY(shift.newStartU + shiftedDevice.uHeight - 1, storeRack.uCount) + RACK_DEFAULTS.deviceInsetY
                    obj.set({ top: newY })
                    obj.setCoords()
                    objDd.startU = shift.newStartU
                    ;(obj as Group).deviceData = objDd
                  }
                  break
                }
              }
            }
            // Fall through to place the new device
          } else {
            return false
          }
        } else {
          return false
        }
      }

      // Create the device at the snapped position
      const rackData = rack.rackData!
      const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)
      const device = createDevice({
        data: {
          catalogId: catalogDevice.catalogId,
          name: catalogDevice.name,
          manufacturer: catalogDevice.manufacturer,
          model: catalogDevice.model,
          uHeight: catalogDevice.uHeight,
          isFullDepth: catalogDevice.isFullDepth,
          startU: snap.startU,
          powerWatts: catalogDevice.powerWatts,
          weightKg: catalogDevice.weightKg,
          category: catalogDevice.category,
          face,
        },
        position: {
          x: rackLeft + RACK_DEFAULTS.deviceInsetX,
          y: rackTop + snap.snapY + RACK_DEFAULTS.deviceInsetY,
        },
        rackWidthPx: rackData.rackWidthPx,
      })

      canvas.add(device)
      maybeOverlayImage(device, canvas)

      // Sync to store for undo/redo tracking
      const dd = device.deviceData!
      useRackStore.getState().placeDevice({
        id: dd.id,
        rackId: rack.rackData!.id,
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
      })

      canvas.requestRenderAll()
      return true
    },
    [canvasRef, racksRef]
  )

  const duplicateRack = useCallback(
    (sourceId: string): string | null => {
      const canvas = canvasRef.current
      const sourceRack = racksRef.current.get(sourceId)
      if (!canvas || !sourceRack?.rackData) return null

      const rd = sourceRack.rackData
      const storeSource = useRackStore.getState().racks[sourceId]

      // Create a new rack with same properties, auto-positioned
      const newId = addRack({
        name: `${rd.name} Copy`,
        uCount: rd.uCount,
        widthInches: storeSource?.widthInches,
        startingUnit: rd.startingUnit,
        descendingUnits: rd.descendingUnits,
      })

      // Copy all devices from the source rack
      const storeDevices = useRackStore.getState().devices
      const sourceDevices = Object.values(storeDevices).filter((d) => d.rackId === sourceId)
      const newRack = racksRef.current.get(newId)
      if (!newRack) return newId

      const { left: rackLeft, top: rackTop } = getRackFramePosition(newRack)
      const newRd = newRack.rackData!

      const viewFace = useRackStore.getState().viewFace
      for (const ds of sourceDevices) {
        const isGhost = (ds.face ?? "front") !== viewFace
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
          position: {
            x: rackLeft + RACK_DEFAULTS.deviceInsetX,
            y: rackTop + uToY(ds.startU + ds.uHeight - 1, newRd.uCount) + RACK_DEFAULTS.deviceInsetY,
          },
          rackWidthPx: newRd.rackWidthPx,
          isGhost,
        })
        canvas.add(dev)
        if (!isGhost) maybeOverlayImage(dev, canvas)
        const dd = dev.deviceData!
        useRackStore.getState().placeDevice({
          id: dd.id,
          rackId: newId,
          catalogId: dd.catalogId,
          name: dd.name,
          manufacturer: dd.manufacturer,
          model: dd.model,
          uHeight: dd.uHeight,
          isFullDepth: dd.isFullDepth,
          startU: ds.startU,
          powerWatts: dd.powerWatts,
          weightKg: dd.weightKg,
          category: dd.category,
          face: ds.face,
        })
      }

      canvas.requestRenderAll()
      return newId
    },
    [canvasRef, addRack]
  )

  /**
   * Restore an archived device from the cabinet onto the canvas at DOM coordinates.
   * Translates DOM → canvas coords, finds the target rack, snaps to U,
   * then restores the full device state (preserving all metadata).
   * Returns true if the device was successfully placed.
   */
  const restoreDeviceFromCabinet = useCallback(
    (deviceState: DeviceState, archiveId: string, domX: number, domY: number): boolean => {
      const canvas = canvasRef.current
      if (!canvas) return false

      const canvasEl = canvas.getSelectionElement()
      const rect = canvasEl.getBoundingClientRect()
      const vpt = canvas.viewportTransform
      if (!vpt) return false

      const absX = (domX - rect.left - vpt[4]) / vpt[0]
      const absY = (domY - rect.top - vpt[5]) / vpt[3]

      const rack = findRackAtPoint(racksRef.current, absX, absY)
      if (!rack) return false

      const storeState = useRackStore.getState()
      const face = storeState.viewFace
      const storeRack = storeState.racks[rack.rackData!.id]
      const localY = toRackLocalY(rack, absY)
      const snap = resolveSnap(
        rack, localY, deviceState.uHeight, deviceState.isFullDepth,
        face, storeRack?.formFactor, undefined, storeRack?.allowOverlap
      )

      if (!snap.valid) {
        if (storeRack && !storeRack.allowOverlap) {
          const occupancy = getOccupancy(rack.rackData!.id)
          const result = autoShift(
            occupancy, snap.startU, deviceState.uHeight, deviceState.isFullDepth,
            face, storeRack.uCount, storeRack.formFactor
          )
          if (!result.overflow && result.shifts.length > 0) {
            storeState.batchMoveDevices(
              result.shifts.map((s) => ({ deviceId: s.deviceId, rackId: snap.rackId, startU: s.newStartU }))
            )
            const { top: rackTop } = getRackFramePosition(rack)
            for (const shift of result.shifts) {
              for (const obj of canvas.getObjects()) {
                const objDd = (obj as Group).deviceData
                if (objDd?.id === shift.deviceId) {
                  const shiftedDevice = useRackStore.getState().devices[shift.deviceId]
                  if (shiftedDevice) {
                    const newY = rackTop + uToY(shift.newStartU + shiftedDevice.uHeight - 1, storeRack.uCount) + RACK_DEFAULTS.deviceInsetY
                    obj.set({ top: newY })
                    obj.setCoords()
                    objDd.startU = shift.newStartU
                    ;(obj as Group).deviceData = objDd
                  }
                  break
                }
              }
            }
          } else {
            return false
          }
        } else {
          return false
        }
      }

      const rackData = rack.rackData!
      const { left: rackLeft, top: rackTop } = getRackFramePosition(rack)
      const device = createDevice({
        data: {
          catalogId: deviceState.catalogId,
          name: deviceState.name,
          manufacturer: deviceState.manufacturer,
          model: deviceState.model,
          uHeight: deviceState.uHeight,
          isFullDepth: deviceState.isFullDepth,
          startU: snap.startU,
          powerWatts: deviceState.powerWatts,
          weightKg: deviceState.weightKg,
          category: deviceState.category,
          face,
        },
        position: {
          x: rackLeft + RACK_DEFAULTS.deviceInsetX,
          y: rackTop + snap.snapY + RACK_DEFAULTS.deviceInsetY,
        },
        rackWidthPx: rackData.rackWidthPx,
      })

      canvas.add(device)
      maybeOverlayImage(device, canvas)

      // Restore full device state (preserving all metadata) at new position
      const dd = device.deviceData!
      useRackStore.getState().placeDevice({
        ...deviceState,
        id: dd.id,
        rackId: rack.rackData!.id,
        startU: snap.startU,
        face,
      })

      // Remove from cabinet archive
      useRackStore.getState().permanentDelete(archiveId)

      canvas.requestRenderAll()
      return true
    },
    [canvasRef, racksRef]
  )

  return { racksRef, addRack, removeRack, duplicateRack, dropDeviceFromCatalog, restoreDeviceFromCabinet }
}
