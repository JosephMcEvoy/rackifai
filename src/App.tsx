import { useState, useEffect } from "react"
import { useAppAuth } from "@/lib/auth-context"
import { AppShell } from "@/components/layout/app-shell"
import { LandingPage } from "@/components/landing-page"
import { SharedViewer } from "@/components/shared-viewer"
import { FeedbackWidget } from "@/components/feedback-widget"

function parseRoute(hash: string): { page: "landing" | "editor" | "shared"; token?: string } {
  if (hash === "#/editor") return { page: "editor" }
  const shareMatch = hash.match(/^#\/s\/([a-zA-Z0-9]+)$/)
  if (shareMatch) return { page: "shared", token: shareMatch[1] }
  return { page: "landing" }
}

function App() {
  const { isSignedIn } = useAppAuth()
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))

  // Clean up stale localStorage auth from pre-Clerk auth system
  useEffect(() => {
    if (isSignedIn) {
      localStorage.removeItem("rackifai-auth")
    }
  }, [isSignedIn])

  useEffect(() => {
    function onHash() {
      setRoute(parseRoute(window.location.hash))
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  return (
    <>
      {route.page === "editor" && <AppShell />}
      {route.page === "shared" && <SharedViewer token={route.token!} />}
      {route.page === "landing" && <LandingPage />}
      <FeedbackWidget />
    </>
  )
}

export default App
