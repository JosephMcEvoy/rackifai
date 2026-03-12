import { useState, useEffect, useRef, useCallback } from "react"
import { useAppAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { RackCanvas, type RackCanvasHandle } from "@/components/rack-canvas"
import { loadSharedProject, createProject } from "@/lib/api-helpers"
import { useRackStore } from "@/store/rack-store"
import type { RackState, DeviceState } from "@/store/rack-store"

interface SharedViewerProps {
  token: string
}

export function SharedViewer({ token }: SharedViewerProps) {
  const { getToken } = useAppAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("Shared Project")
  const [copying, setCopying] = useState(false)
  const canvasRef = useRef<RackCanvasHandle>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    async function load() {
      try {
        const detail = await loadSharedProject(token)
        const config = detail.rackConfigurations[0]?.configJson
        setProjectName(detail.name)

        useRackStore.setState({
          projectName: detail.name,
          racks: (config?.racks ?? {}) as Record<string, RackState>,
          devices: (config?.devices ?? {}) as Record<string, DeviceState>,
          selectedDeviceIds: [],
        })
      } catch {
        setError("This shared project could not be found or has been revoked.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  // Fit to screen after load
  useEffect(() => {
    if (!loading && !error) {
      setTimeout(() => canvasRef.current?.zoomFit(), 200)
    }
  }, [loading, error])

  const handleMakeCopy = useCallback(async () => {
    setCopying(true)
    try {
      const authToken = await getToken()
      const { racks, devices } = useRackStore.getState()
      const project = await createProject(`${projectName} (copy)`, { racks, devices }, authToken)
      // Navigate to the editor with the new project
      localStorage.setItem("rackifai-current-project", project.id)
      window.location.hash = "#/editor"
    } catch {
      alert("Failed to create a copy. Please sign in and try again.")
    } finally {
      setCopying(false)
    }
  }, [projectName, getToken])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading shared project...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => (window.location.hash = "")}>
          Go to Home
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* View Only banner */}
      <div className="flex items-center gap-2 border-b border-border bg-background px-4" style={{ height: 48 }}>
        <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
          {projectName}
        </span>

        <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-500 uppercase tracking-wider">
          View Only
        </span>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={handleMakeCopy}
          disabled={copying}
        >
          {copying ? "Copying..." : "Make a Copy"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => (window.location.hash = "")}
        >
          Home
        </Button>
      </div>

      {/* Canvas - pointer-events disabled for read-only */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none z-10" />
        <RackCanvas ref={canvasRef} />
      </div>
    </div>
  )
}
