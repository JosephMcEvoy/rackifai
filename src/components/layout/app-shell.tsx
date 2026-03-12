import { useState, useRef, useCallback, useEffect, useMemo, type RefObject, type MutableRefObject } from "react"
import { useAppAuth } from "@/lib/auth-context"
import { DndContext, DragOverlay, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core"
import { Toolbar } from "./toolbar"
import { Sidebar } from "./sidebar"
import { CanvasArea } from "./canvas-area"
import { DeviceDragOverlay } from "@/components/device-catalog"
import { ExportModal, type ExportSettings } from "@/components/export-modal"
import { ShareModal } from "@/components/share-modal"
import { ShortcutsOverlay } from "@/components/shortcuts-overlay"
import { ProjectsDialog } from "@/components/projects-dialog"
import { SyncPromptBalloon } from "@/components/sync-prompt-balloon"
import { Popover, PopoverAnchor } from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { listLocalProjects } from "@/lib/local-db"
import { syncProjectToCloud, moveProjectToLocal } from "@/lib/project-sync"
import { useAutosave } from "@/lib/use-autosave"
import { useRackStore, generateProjectName, type DeviceFace } from "@/store/rack-store"
import { LocalStorageAdapter } from "@/lib/local-storage-adapter"
import { CloudStorageAdapter } from "@/lib/cloud-storage-adapter"
import { isIndexedDBAvailable, purgeExpiredLocalTrash } from "@/lib/local-db"
import { replayWal, writeWal, clearWal } from "@/lib/project-wal"
import type { StorageAdapter } from "@/lib/storage-adapter"
import type { StorageMode, ProjectRef, ConfigJson } from "@/types/project"
import type { CatalogDevice } from "@/lib/catalog-data"
import type { RackCanvasHandle } from "@/components/rack-canvas"
import type { RackState, DeviceState } from "@/store/rack-store"
import type { ArchivedItem, TrashedItem } from "@/types/archive"

const PROJECT_REF_KEY = "rackifai-current-project"
const SYNC_DISMISSED_KEY = "rackifai-sync-dismissed"

// ---------------------------------------------------------------------------
// Sync-balloon dismissed-project tracking (localStorage)
// ---------------------------------------------------------------------------

function readDismissedSyncIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNC_DISMISSED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function writeDismissedSyncIds(ids: Set<string>): void {
  try {
    localStorage.setItem(SYNC_DISMISSED_KEY, JSON.stringify([...ids]))
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Project ref persistence (localStorage)
// ---------------------------------------------------------------------------

function readProjectRef(): ProjectRef | null {
  try {
    const raw = localStorage.getItem(PROJECT_REF_KEY)
    if (!raw) return null
    // Migration: old format was a plain UUID string
    if (!raw.startsWith("{")) {
      return { id: raw, storageMode: "cloud" }
    }
    const parsed = JSON.parse(raw) as ProjectRef
    if (parsed.id && (parsed.storageMode === "local" || parsed.storageMode === "cloud")) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function writeProjectRef(ref: ProjectRef | null): void {
  try {
    if (ref) {
      localStorage.setItem(PROJECT_REF_KEY, JSON.stringify(ref))
    } else {
      localStorage.removeItem(PROJECT_REF_KEY)
    }
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Singleton adapter instances
// ---------------------------------------------------------------------------

const localAdapter = new LocalStorageAdapter()

function PopoverAnchorWrapper({ children }: { children: React.ReactNode }) {
  return <PopoverAnchor asChild>{children}</PopoverAnchor>
}

export function AppShell() {
  const { getToken, isSignedIn, signIn } = useAppAuth()
  const [activeDragDevice, setActiveDragDevice] = useState<CatalogDevice | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<StorageMode>("cloud")
  const [zoomLevel, setZoomLevel] = useState(100)
  const [idbAvailable, setIdbAvailable] = useState(true)
  const [syncPromptOpen, setSyncPromptOpen] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [moveToLocalConfirm, setMoveToLocalConfirm] = useState(false)
  const viewFace = useRackStore((s) => s.viewFace)
  const showDeviceImages = useRackStore((s) => s.showDeviceImages)
  const showGrid = useRackStore((s) => s.showGrid)
  const [ready, setReady] = useState(false)
  const projectsButtonRef = useRef<HTMLButtonElement>(null)
  const canvasHandleRef = useRef<RackCanvasHandle>(null)
  const lastPointerRef: RefObject<{ x: number; y: number }> = useRef({ x: 0, y: 0 })
  const activeCabinetRef: MutableRefObject<ArchivedItem | null> = useRef(null)
  const initRef = useRef(false)

  // Build adapter based on current storage mode
  const cloudAdapter = useMemo(() => new CloudStorageAdapter(getToken), [getToken])
  const adapter: StorageAdapter | null = storageMode === "local" ? localAdapter : cloudAdapter

  const { status: saveStatus } = useAutosave(projectId, adapter)

  // Persist project ref to localStorage
  useEffect(() => {
    if (projectId) {
      writeProjectRef({ id: projectId, storageMode })
    } else {
      writeProjectRef(null)
    }
  }, [projectId, storageMode])

  // Convenience to set both at once
  const setProject = useCallback((id: string | null, mode: StorageMode) => {
    setProjectId(id)
    setStorageMode(mode)
  }, [])

  const loadAndApplyProject = useCallback(async (id: string, mode: StorageMode) => {
    const currentAdapter = mode === "local" ? localAdapter : cloudAdapter
    const data = await currentAdapter.load(id)

    if (!data) throw new Error("Project not found")

    useRackStore.setState({
      projectName: data.name,
      racks: (data.configJson.racks ?? {}) as Record<string, RackState>,
      devices: (data.configJson.devices ?? {}) as Record<string, DeviceState>,
      archivedItems: (data.configJson.archivedItems ?? []) as ArchivedItem[],
      trashedItems: (data.configJson.trashedItems ?? []) as TrashedItem[],
      selectedDeviceIds: [],
    })

    setProject(id, mode)
  }, [cloudAdapter, setProject])

  // On mount: check IDB, replay WAL, load existing project or most recent
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      // Check IndexedDB availability
      const available = await isIndexedDBAvailable()
      setIdbAvailable(available)

      // Purge expired local project trash on startup
      if (available) {
        purgeExpiredLocalTrash().catch(() => {})
      }

      const ref = readProjectRef()

      if (ref) {
        // Replay WAL for local projects before loading
        if (ref.storageMode === "local" && available) {
          await replayWal(ref.id)
        }

        try {
          await loadAndApplyProject(ref.id, ref.storageMode)
          // Purge expired canvas trash items after loading
          useRackStore.getState().purgeExpiredTrash()
          setReady(true)

          return
        } catch {
          // Project no longer exists — fall through to find most recent
          writeProjectRef(null)
        }
      }

      // No saved ref — try to open the most recent existing project
      try {
        const existingProjects: { id: string; storageMode: StorageMode; updatedAt: string }[] = []

        // Gather cloud projects for signed-in users
        if (isSignedIn) {
          try {
            const cloudProjects = await cloudAdapter.list()
            existingProjects.push(...cloudProjects.map((p) => ({
              id: p.id,
              storageMode: "cloud" as StorageMode,
              updatedAt: p.updatedAt,
            })))
          } catch {
            // API unavailable — skip cloud
          }
        }

        // Gather local projects if IDB is available
        if (available) {
          try {
            const localProjects = await localAdapter.list()
            existingProjects.push(...localProjects.map((p) => ({
              id: p.id,
              storageMode: "local" as StorageMode,
              updatedAt: p.updatedAt,
            })))
          } catch {
            // IDB error — skip local
          }
        }

        // Sort by most recently updated and try to load the first one
        existingProjects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

        if (existingProjects.length > 0) {
          const mostRecent = existingProjects[0]
          if (mostRecent.storageMode === "local" && available) {
            await replayWal(mostRecent.id)
          }
          await loadAndApplyProject(mostRecent.id, mostRecent.storageMode)
          setReady(true)
          return
        }
      } catch {
        // Failed to list projects — fall through to auto-create
      }

      // No existing projects — let useRack create defaults, then auto-create
      setReady(true)
    }
    init()
  }, [loadAndApplyProject, isSignedIn, cloudAdapter])

  // Auto-create project after canvas initializes (new project only)
  useEffect(() => {
    if (!ready || projectId) return

    async function autoCreate() {
      try {
        // Small delay to ensure useRack has populated the store
        await new Promise((r) => setTimeout(r, 100))
        const projectName = generateProjectName()
        useRackStore.setState({ projectName })
        const { racks, devices } = useRackStore.getState()
        const configJson: ConfigJson = { racks, devices }

        if (isSignedIn) {
          // Cloud project for signed-in users (existing behavior)
          const project = await cloudAdapter.create(projectName, configJson)
          setProject(project.id, "cloud")
        } else if (idbAvailable) {
          // Local project for guests
          const project = await localAdapter.create(projectName, configJson)
          setProject(project.id, "local")
        }
        // If IDB unavailable and not signed in: work in-memory only
      } catch {
        // Offline or API unavailable — continue without saving
      }
    }
    autoCreate()
  }, [ready, projectId, isSignedIn, cloudAdapter, idbAvailable, setProject])

  // Claim guest project when user signs in (existing cloud projects only)
  useEffect(() => {
    if (!isSignedIn || !projectId || storageMode !== "cloud") return
    async function claim() {
      try {
        const token = await getToken()
        const { claimProject } = await import("@/lib/api-helpers")
        await claimProject(projectId!, token)
      } catch {
        // Project may already be owned — ignore
      }
    }
    claim()
  }, [isSignedIn, projectId, storageMode, getToken])

  // Show sync prompt when user signs in and has local projects not yet dismissed
  useEffect(() => {
    if (!isSignedIn || !ready || !idbAvailable) return
    async function checkForLocalProjects() {
      try {
        const locals = await listLocalProjects()
        const dismissed = readDismissedSyncIds()
        const unseen = locals.filter((p) => !dismissed.has(p.id))
        if (unseen.length > 0) {
          setSyncPromptOpen(true)
        }
      } catch {
        // Ignore
      }
    }
    checkForLocalProjects()
  }, [isSignedIn, ready, idbAvailable])

  // WAL: save to localStorage on visibilitychange / beforeunload for local projects
  useEffect(() => {
    if (!projectId || storageMode !== "local") return

    function emergencySave() {
      const { projectName, racks, devices, archivedItems, trashedItems } = useRackStore.getState()
      writeWal(projectId!, projectName, { racks, devices, archivedItems, trashedItems })
    }

    function handleVisibilityChange() {
      if (document.hidden) emergencySave()
    }

    function handleBeforeUnload() {
      emergencySave()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("pagehide", handleBeforeUnload)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("pagehide", handleBeforeUnload)
    }
  }, [projectId, storageMode])

  // Clear WAL after successful save
  useEffect(() => {
    if (saveStatus === "saved" && projectId && storageMode === "local") {
      clearWal(projectId)
    }
  }, [saveStatus, projectId, storageMode])

  const handleOpenProject = useCallback(
    async (id: string, mode: StorageMode) => {
      try {
        setReady(false)
        await loadAndApplyProject(id, mode)
        setReady(true)
      } catch {
        setReady(true)
      }
    },
    [loadAndApplyProject],
  )

  const handleNewProject = useCallback((id: string, name: string, mode: StorageMode) => {
    setReady(false)
    useRackStore.setState({
      projectName: name,
      racks: {},
      devices: {},
      archivedItems: [],
      trashedItems: [],
      selectedDeviceIds: [],
    })
    setProject(id, mode)
    setTimeout(() => setReady(true), 0)
  }, [setProject])

  const handleSyncToCloud = useCallback(async () => {
    if (!projectId || storageMode !== "local") return
    setSyncBusy(true)
    try {
      const { cloudId } = await syncProjectToCloud(projectId, getToken)
      setProject(cloudId, "cloud")
    } catch {
      // Ignore — user can retry
    } finally {
      setSyncBusy(false)
    }
  }, [projectId, storageMode, getToken, setProject])

  const handleMoveToLocal = useCallback(async () => {
    if (!projectId || storageMode !== "cloud") return
    setSyncBusy(true)
    try {
      const { localId } = await moveProjectToLocal(projectId, getToken)
      setProject(localId, "local")
    } catch {
      // Ignore — user can retry
    } finally {
      setSyncBusy(false)
    }
  }, [projectId, storageMode, getToken, setProject])

  // Track raw pointer position so drop coordinates aren't affected by
  // dnd-kit's scroll-adjusted delta (which drifts after canvas zoom/scroll)
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("pointermove", onPointerMove)
    return () => window.removeEventListener("pointermove", onPointerMove)
  }, [])

  function handleDragStart(event: DragStartEvent) {
    // Cabinet device drag
    const cabinetItem = event.active.data.current?.cabinetItem as ArchivedItem | undefined
    if (cabinetItem?.type === "device" && cabinetItem.deviceState) {
      activeCabinetRef.current = cabinetItem
      const ds = cabinetItem.deviceState
      setActiveDragDevice({
        catalogId: ds.catalogId,
        name: ds.name,
        manufacturer: ds.manufacturer,
        model: ds.model,
        uHeight: ds.uHeight,
        isFullDepth: ds.isFullDepth,
        powerWatts: ds.powerWatts,
        weightKg: ds.weightKg,
        category: ds.category,
        frontImageUrl: null,
        rearImageUrl: null,
      })
      return
    }

    // Catalog device drag
    activeCabinetRef.current = null
    const device = event.active.data.current?.device as CatalogDevice | undefined
    if (device) setActiveDragDevice(device)
  }

  function handleDragEnd(event: DragEndEvent) {
    const device = activeDragDevice
    const cabinetItem = activeCabinetRef.current
    setActiveDragDevice(null)
    activeCabinetRef.current = null

    if (!device) return
    if (event.over?.id !== "rack-canvas-drop") return

    const { x: domX, y: domY } = lastPointerRef.current

    if (cabinetItem?.deviceState) {
      canvasHandleRef.current?.restoreDeviceFromCabinet(
        cabinetItem.deviceState, cabinetItem.id, domX, domY
      )
    } else {
      canvasHandleRef.current?.dropDeviceFromCatalog(device, domX, domY)
    }
  }

  const handleExport = useCallback((settings: ExportSettings) => {
    canvasHandleRef.current?.exportCanvas(settings)
  }, [])

  const refreshZoom = useCallback(() => {
    const z = canvasHandleRef.current?.getZoom() ?? 1
    setZoomLevel(z * 100)
  }, [])

  const handleZoomIn = useCallback(() => {
    canvasHandleRef.current?.zoomIn()
    refreshZoom()
  }, [refreshZoom])

  const handleZoomOut = useCallback(() => {
    canvasHandleRef.current?.zoomOut()
    refreshZoom()
  }, [refreshZoom])

  const handleZoomFit = useCallback(() => {
    canvasHandleRef.current?.zoomFit()
    refreshZoom()
  }, [refreshZoom])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === "e" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setExportOpen(true)
        return
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShortcutsOpen((prev) => !prev)
        return
      }
      if ((e.key === "+" || e.key === "=") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleZoomIn()
        return
      }
      if (e.key === "-" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleZoomOut()
        return
      }
      if (e.key === "0" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleZoomFit()
        return
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [handleZoomIn, handleZoomOut, handleZoomFit])

  // Update zoom level periodically (for scroll wheel zoom)
  useEffect(() => {
    const id = setInterval(refreshZoom, 500)
    return () => clearInterval(id)
  }, [refreshZoom])

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-dvh flex-col">
        {!idbAvailable && (
          <div className="bg-yellow-900/80 text-yellow-200 text-xs text-center py-1 px-2">
            IndexedDB unavailable (private browsing?) — local saves disabled, work is in-memory only.
          </div>
        )}
        <Popover open={syncPromptOpen} onOpenChange={setSyncPromptOpen}>
        <Toolbar
          saveStatus={saveStatus}
          storageMode={storageMode}
          onExport={() => setExportOpen(true)}
          onShare={() => {
            if (storageMode === "local") return // Guard: no sharing for local projects
            setShareOpen(true)
          }}
          onShowShortcuts={() => setShortcutsOpen(true)}
          onProjects={() => setProjectsOpen(true)}
          projectsButtonRef={projectsButtonRef}
          projectsButtonWrapper={PopoverAnchorWrapper}
          onAddRack={() => canvasHandleRef.current?.addRack()}
          onToggleFace={() => {
            const next: DeviceFace = viewFace === "front" ? "rear" : "front"
            useRackStore.getState().setViewFace(next)
          }}
          viewFace={viewFace}
          showDeviceImages={showDeviceImages}
          onToggleDeviceImages={() => {
            useRackStore.getState().setShowDeviceImages(!showDeviceImages)
          }}
          showGrid={showGrid}
          onToggleGrid={() => {
            useRackStore.getState().setShowGrid(!showGrid)
          }}
          onUndo={() => canvasHandleRef.current?.undo()}
          onRedo={() => canvasHandleRef.current?.redo()}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomFit={handleZoomFit}
          zoomLevel={zoomLevel}
          onSyncToCloud={handleSyncToCloud}
          onMoveToLocal={() => setMoveToLocalConfirm(true)}
          onSignIn={signIn}
          syncBusy={syncBusy}
          isSignedIn={isSignedIn ?? false}
        />
        <SyncPromptBalloon
          open={syncPromptOpen}
          onOpenChange={setSyncPromptOpen}
          onSynced={(localId, cloudId) => {
            // Remove synced project from dismissed set (it's no longer local)
            const dismissed = readDismissedSyncIds()
            dismissed.delete(localId)
            writeDismissedSyncIds(dismissed)
            if (localId === projectId) {
              setProject(cloudId, "cloud")
            }
          }}
          onDismiss={(localIds) => {
            const dismissed = readDismissedSyncIds()
            for (const id of localIds) dismissed.add(id)
            writeDismissedSyncIds(dismissed)
          }}
        />
        </Popover>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          {ready ? (
            <CanvasArea ref={canvasHandleRef} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-background">
              <p className="text-sm text-muted-foreground">Loading project...</p>
            </div>
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragDevice ? (
          <DeviceDragOverlay device={activeDragDevice} />
        ) : null}
      </DragOverlay>
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />
      {storageMode === "cloud" && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          projectId={projectId}
        />
      )}
      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ProjectsDialog
        open={projectsOpen}
        onOpenChange={setProjectsOpen}
        onOpen={handleOpenProject}
        onNew={handleNewProject}
        currentProjectId={projectId}
        storageMode={storageMode}
        isSignedIn={isSignedIn ?? false}
      />
      <AlertDialog open={moveToLocalConfirm} onOpenChange={setMoveToLocalConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to local storage?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the cloud copy and save the project locally only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setMoveToLocalConfirm(false); handleMoveToLocal() }}>
              Move to local
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  )
}
