import { useState, useEffect, useCallback } from "react"
import { useAppAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { shareProject, revokeShare } from "@/lib/api-helpers"

interface ShareModalProps {
  open: boolean
  onClose: () => void
  projectId: string | null
}

export function ShareModal({ open, onClose, projectId }: ShareModalProps) {
  const { getToken } = useAppAuth()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shareUrl = token
    ? `${window.location.origin}${window.location.pathname}#/s/${token}`
    : null

  const generateLink = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const authToken = await getToken()
      const result = await shareProject(projectId, authToken)
      setToken(result.token)
    } catch {
      setError("Failed to generate share link")
    } finally {
      setLoading(false)
    }
  }, [projectId, getToken])

  const handleRevoke = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const authToken = await getToken()
      await revokeShare(projectId, authToken)
      setToken(null)
    } catch {
      setError("Failed to revoke share link")
    } finally {
      setLoading(false)
    }
  }, [projectId, getToken])

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for clipboard API failure
      const input = document.createElement("input")
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareUrl])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setToken(null)
      setCopied(false)
      setError(null)
    }
  }, [open])

  // Auto-generate on open
  useEffect(() => {
    if (open && projectId) {
      generateLink()
    }
  }, [open, projectId, generateLink])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 w-[420px] rounded-lg border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-base font-medium text-foreground mb-1">
          Share Project
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Anyone with this link can view your rack layout (read-only).
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {loading && !token && (
          <div className="mb-4 text-xs text-muted-foreground">
            Generating share link...
          </div>
        )}

        {shareUrl && (
          <div className="mb-4">
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground font-mono select-all outline-none focus:border-primary"
                onFocus={(e) => e.target.select()}
              />
              <Button size="sm" onClick={handleCopy} className="text-xs shrink-0">
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <div>
            {token && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRevoke}
                disabled={loading}
                className="text-xs text-destructive hover:text-destructive"
              >
                Revoke Link
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
