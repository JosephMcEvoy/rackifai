import { createContext, useContext } from "react"

/** Auth mode determined at build time via VITE_AUTH_MODE env var. */
export type AuthMode = "clerk" | "local" | "none"

/** Unified auth interface consumed by all components. */
export interface AppAuth {
  /** Whether the user is currently authenticated. In "none" mode, always true. */
  isSignedIn: boolean
  /** Fetch a bearer token for API requests. Returns null if not signed in. */
  getToken: () => Promise<string | null>
  /** Trigger sign-in flow (Clerk modal, local login form, or no-op). */
  signIn: () => void
  /** Sign out. */
  signOut: () => void
  /** Current user info, or null if not authenticated. */
  user: { name?: string; avatar?: string; email?: string } | null
  /** Which auth mode is active. */
  mode: AuthMode
}

const AuthContext = createContext<AppAuth | null>(null)

export const AuthProvider = AuthContext.Provider

// eslint-disable-next-line react-refresh/only-export-components
export function useAppAuth(): AppAuth {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAppAuth must be used within an AuthProvider")
  }
  return ctx
}

/**
 * Detect auth mode from environment.
 * - If VITE_AUTH_MODE is explicitly set, use it.
 * - If VITE_CLERK_PUBLISHABLE_KEY is set, default to "clerk".
 * - Otherwise, default to "none" (single-user, no login).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function detectAuthMode(): AuthMode {
  const explicit = import.meta.env.VITE_AUTH_MODE as string | undefined
  if (explicit === "clerk" || explicit === "local" || explicit === "none") {
    return explicit
  }
  if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    return "clerk"
  }
  return "none"
}
