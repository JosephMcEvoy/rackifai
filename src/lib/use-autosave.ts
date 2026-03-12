import { useState, useEffect, useRef, useCallback } from "react"
import { useRackStore } from "@/store/rack-store"
import type { StorageAdapter } from "@/lib/storage-adapter"
import type { ConfigJson } from "@/types/project"

export type SaveStatus = "saved" | "saving" | "unsaved" | "error"

const AUTOSAVE_DELAY_MS = 3000

/**
 * Hook that auto-saves the rack store state via the given StorageAdapter.
 * Uses a generation counter for O(1) dirty checking instead of JSON.stringify.
 */
export function useAutosave(
  projectId: string | null,
  adapter: StorageAdapter | null,
) {
  const [status, setStatus] = useState<SaveStatus>("saved")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedGenRef = useRef<number>(-1)
  const projectIdRef = useRef(projectId)
  const adapterRef = useRef(adapter)

  // Track previous projectId to reset status on project change (React 19 pattern)
  const [prevProjectId, setPrevProjectId] = useState(projectId)
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId)
    setStatus("saved")
  }

  // Keep refs in sync
  useEffect(() => {
    projectIdRef.current = projectId
    lastSavedGenRef.current = -1
  }, [projectId])

  useEffect(() => {
    adapterRef.current = adapter
  }, [adapter])

  const save = useCallback(async () => {
    const pid = projectIdRef.current
    const currentAdapter = adapterRef.current
    if (!pid || !currentAdapter) return

    const { projectName, racks, devices, archivedItems, trashedItems, _generation } =
      useRackStore.getState()

    // Skip if nothing changed since last save
    if (_generation === lastSavedGenRef.current) {
      setStatus("saved")
      return
    }

    setStatus("saving")
    try {
      const configJson: ConfigJson = { racks, devices, archivedItems, trashedItems }
      await currentAdapter.save(pid, projectName, configJson)
      lastSavedGenRef.current = _generation
      setStatus("saved")
    } catch {
      setStatus("error")
    }
  }, [])

  // Subscribe to generation changes for autosave
  useEffect(() => {
    if (!projectId) return

    const unsub = useRackStore.subscribe(
      (state) => state._generation,
      () => {
        setStatus("unsaved")
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(save, AUTOSAVE_DELAY_MS)
      },
    )

    return () => {
      unsub()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [projectId, save])

  // Ctrl+S manual save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        save()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [save])

  return { status, save }
}
