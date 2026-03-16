import { useState, useRef, useEffect } from "react"
import { useAppAuth } from "@/lib/auth-context"
import {
  CloudUpload,
  CloudDownload,
  FolderOpen,
  Plus,
  FlipVertical,
  Image,
  Grid3X3,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Share2,
  Keyboard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRackStore } from "@/store/rack-store"
import type { SaveStatus } from "@/lib/use-autosave"
import type { DeviceFace } from "@/store/rack-store"
import type { StorageMode } from "@/types/project"

const TOOLBAR_HEIGHT = 48 as const

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving...",
  unsaved: "Unsaved changes",
  error: "Save failed",
}

const STATUS_COLORS: Record<SaveStatus, string> = {
  saved: "text-muted-foreground",
  saving: "text-primary",
  unsaved: "text-yellow-500",
  error: "text-destructive",
}

interface ToolbarProps {
  saveStatus?: SaveStatus
  storageMode?: StorageMode
  onExport?: () => void
  onShare?: () => void
  onProjects?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onAddRack?: () => void
  onToggleFace?: () => void
  viewFace?: DeviceFace
  showDeviceImages?: boolean
  onToggleDeviceImages?: () => void
  showGrid?: boolean
  onToggleGrid?: () => void
  onShowShortcuts?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomFit?: () => void
  zoomLevel?: number
  onSyncToCloud?: () => void
  onMoveToLocal?: () => void
  onSignIn?: () => void
  syncBusy?: boolean
  projectsButtonRef?: React.Ref<HTMLButtonElement>
  projectsButtonWrapper?: React.ComponentType<{ children: React.ReactNode }>
  isSignedIn?: boolean
}

export function Toolbar({
  saveStatus = "saved",
  storageMode = "cloud",
  onExport,
  onShare,
  onProjects,
  onUndo,
  onRedo,
  onAddRack,
  onToggleFace,
  viewFace = "front",
  showDeviceImages = false,
  onToggleDeviceImages,
  showGrid = true,
  onToggleGrid,
  onShowShortcuts,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  zoomLevel = 100,
  onSyncToCloud,
  onMoveToLocal,
  onSignIn,
  syncBusy = false,
  projectsButtonRef,
  projectsButtonWrapper: ProjectsButtonWrapper,
  isSignedIn = false,
}: ToolbarProps) {
  const projectName = useRackStore((s) => s.projectName)
  const setProjectName = useRackStore((s) => s.setProjectName)

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(projectName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commitName() {
    const trimmed = editValue.trim()
    if (trimmed) setProjectName(trimmed)
    setEditing(false)
  }

  return (
    <>
      <div
        className="flex items-center gap-1.5 border-b border-border bg-card/50 px-3"
        style={{ height: TOOLBAR_HEIGHT }}
      >
        {/* Brand */}
        <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent select-none cursor-default mr-1">rackif<span className="text-primary">ai</span></span>

        <div className="w-px h-5 bg-border/60" />

        {/* Project name */}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName()
              if (e.key === "Escape") setEditing(false)
            }}
            className="w-40 rounded-md border border-primary/50 bg-background px-2 py-0.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        ) : (
          <button
            onClick={() => { setEditValue(projectName); setEditing(true) }}
            className="text-sm font-medium text-foreground/90 hover:text-foreground transition-colors truncate max-w-[200px] rounded px-1.5 py-0.5 hover:bg-secondary/60"
            title="Click to rename"
          >
            {projectName}
          </button>
        )}

        <span className={`text-[11px] ${STATUS_COLORS[saveStatus]} inline-flex items-center gap-1`}>
          {saveStatus === "saved" ? (
            <>
              <span className="opacity-80">{storageMode === "local" ? "Local" : "Saved"}</span>
              {storageMode === "local" ? (
                isSignedIn ? (
                  <button
                    onClick={onSyncToCloud}
                    disabled={syncBusy}
                    className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    title="Sync to cloud"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={onSignIn}
                    className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
                    title="Sign in to sync to cloud"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                  </button>
                )
              ) : (
                <button
                  onClick={onMoveToLocal}
                  disabled={syncBusy}
                  className="inline-flex items-center text-blue-400 hover:text-primary transition-colors disabled:opacity-50"
                  title="Move to local storage"
                >
                  <CloudDownload className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : (
            STATUS_LABELS[saveStatus]
          )}
        </span>

        <div className="flex-1" />

        {/* Projects */}
        {onProjects && (
          ProjectsButtonWrapper ? (
            <ProjectsButtonWrapper>
              <Button ref={projectsButtonRef} variant="ghost" size="sm" onClick={onProjects} className="text-xs h-7 gap-1.5 text-muted-foreground hover:text-foreground" title="Projects">
                <FolderOpen className="h-3.5 w-3.5" />
                Projects
              </Button>
            </ProjectsButtonWrapper>
          ) : (
            <Button ref={projectsButtonRef} variant="ghost" size="sm" onClick={onProjects} className="text-xs h-7 gap-1.5 text-muted-foreground hover:text-foreground" title="Projects">
              <FolderOpen className="h-3.5 w-3.5" />
              Projects
            </Button>
          )
        )}

        <div className="w-px h-4 bg-border/40" />

        {/* Rack & View controls group */}
        <div className="toolbar-group">
          {onAddRack && (
            <Button variant="ghost" size="sm" onClick={onAddRack} className="text-xs h-6 gap-1 px-2 text-muted-foreground hover:text-foreground" title="Add Rack">
              <Plus className="h-3.5 w-3.5" />
              Rack
            </Button>
          )}

          {onToggleFace && (
            <Button variant="ghost" size="sm" onClick={onToggleFace} className="text-xs h-6 gap-1 px-2 text-muted-foreground hover:text-foreground" title="Toggle front/rear view">
              <FlipVertical className="h-3.5 w-3.5" />
              {viewFace === "front" ? "Front" : "Rear"}
            </Button>
          )}

          {onToggleDeviceImages && (
            <Button
              variant={showDeviceImages ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleDeviceImages}
              className={`text-xs h-6 gap-1 px-2 ${showDeviceImages ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Toggle device elevation images"
            >
              <Image className="h-3.5 w-3.5" />
              Images
            </Button>
          )}

          {onToggleGrid && (
            <Button
              variant={showGrid ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleGrid}
              className={`text-xs h-6 gap-1 px-2 ${showGrid ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Toggle canvas grid"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              Grid
            </Button>
          )}
        </div>

        <div className="w-px h-4 bg-border/40" />

        {/* Undo/Redo group */}
        <div className="toolbar-group">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            className="text-xs h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            className="text-xs h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="w-px h-4 bg-border/40" />

        {/* Zoom controls */}
        <div className="toolbar-group">
          <Button variant="ghost" size="sm" onClick={onZoomOut} className="text-xs h-6 w-6 p-0 text-muted-foreground hover:text-foreground" title="Zoom Out (-)">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <button
            onClick={onZoomFit}
            className="text-[10px] font-mono text-muted-foreground hover:text-primary w-10 text-center transition-colors rounded px-1"
            title="Fit to Screen (0)"
          >
            {Math.round(zoomLevel)}%
          </button>
          <Button variant="ghost" size="sm" onClick={onZoomIn} className="text-xs h-6 w-6 p-0 text-muted-foreground hover:text-foreground" title="Zoom In (+)">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="w-px h-4 bg-border/40" />

        {/* Export & Share */}
        {onExport && (
          <Button variant="ghost" size="sm" onClick={onExport} className="text-xs h-7 gap-1.5 text-muted-foreground hover:text-foreground" title="Export (Ctrl+E)">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        )}

        {onShare && (
          <Button variant="ghost" size="sm" onClick={onShare} className="text-xs h-7 gap-1.5 text-muted-foreground hover:text-foreground" title="Share">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        )}

        {/* Shortcuts help */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowShortcuts}
          className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-4 bg-border/40" />

        {/* Auth */}
        <ToolbarAuth />
      </div>
    </>
  )
}

/** Auth UI for the toolbar — adapts to the current auth mode. */
function ToolbarAuth() {
  const { isSignedIn, signIn, signOut, user, mode } = useAppAuth()

  // No auth mode — no sign-in UI needed
  if (mode === "none") return null

  if (!isSignedIn) {
    return (
      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={signIn}>
        Sign in
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {user?.email && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
          {user.email}
        </span>
      )}
      {mode === "clerk" ? (
        <ClerkUserButton />
      ) : (
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={signOut}>
          Sign out
        </Button>
      )}
    </div>
  )
}

/** Lazy-loaded Clerk UserButton — only imported in clerk mode. */
function ClerkUserButton() {
  const [Comp, setComp] = useState<React.ComponentType | null>(null)

  useEffect(() => {
    import("@clerk/react").then((m) => {
      setComp(() => m.UserButton)
    })
  }, [])

  if (!Comp) return null
  return <Comp />
}
