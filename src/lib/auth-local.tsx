import { useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import { AuthProvider, type AppAuth, type AuthMode } from "./auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const TOKEN_KEY = "rackifai-auth-token"
const USER_KEY = "rackifai-auth-user"

interface StoredUser {
  id: string
  email: string
  name?: string
}

function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function storeAuth(token: string, user: StoredUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch { /* ignore */ }
}

function clearStoredAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch { /* ignore */ }
}

/**
 * Local JWT auth provider.
 * In "local" mode: shows login/register forms.
 * In "none" mode: auto-authenticated, no login required.
 */
export function LocalAuthWrapper({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [user, setUser] = useState<StoredUser | null>(getStoredUser)
  const [showLogin, setShowLogin] = useState(false)

  // For "none" mode, always signed in
  const isNoneMode = mode === "none"
  const isSignedIn = isNoneMode || !!token

  const signIn = useCallback(() => {
    if (!isNoneMode) setShowLogin(true)
  }, [isNoneMode])

  const signOut = useCallback(() => {
    clearStoredAuth()
    setToken(null)
    setUser(null)
  }, [])

  const getToken = useCallback(async () => {
    return token
  }, [token])

  const handleAuth = useCallback((newToken: string, newUser: StoredUser) => {
    storeAuth(newToken, newUser)
    setToken(newToken)
    setUser(newUser)
    setShowLogin(false)
  }, [])

  const auth = useMemo<AppAuth>(() => ({
    isSignedIn,
    getToken,
    signIn,
    signOut,
    user: user ? { name: user.name, email: user.email } : null,
    mode,
  }), [isSignedIn, getToken, signIn, signOut, user, mode])

  return (
    <AuthProvider value={auth}>
      {children}
      {showLogin && !isNoneMode && (
        <LoginDialog
          onAuth={handleAuth}
          onClose={() => setShowLogin(false)}
        />
      )}
    </AuthProvider>
  )
}

// --- Login/Register dialog ---

function LoginDialog({
  onAuth,
  onClose,
}: {
  onAuth: (token: string, user: StoredUser) => void
  onClose: () => void
}) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login"
    const body = isRegister
      ? { email, password, name: name || undefined }
      : { email, password }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Authentication failed")
        return
      }
      onAuth(data.token, data.user)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-[360px] rounded-lg border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-base font-medium text-foreground mb-4">
          {isRegister ? "Create Account" : "Sign In"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <Input
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : isRegister ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(null) }}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {isRegister ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
        </div>

        <div className="mt-2 text-right">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Auth UI components (local/none mode equivalents of Clerk components) ---

export function AuthSignInButton({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function AuthUserButton() {
  return null
}

export function AuthShow({ when, children }: { when: "signed-in" | "signed-out"; children: ReactNode }) {
  // In local/none mode, always show signed-in content
  if (when === "signed-in") return <>{children}</>
  return null
}
