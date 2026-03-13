import { useMemo, type ReactNode } from "react"
import { ClerkProvider, useAuth, useUser, useClerk, SignInButton, UserButton, Show } from "@clerk/react"
import { AuthProvider, type AppAuth } from "./auth-context"

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken, signOut } = useAuth()
  const { user } = useUser()
  const { openSignIn } = useClerk()

  const auth = useMemo<AppAuth>(() => ({
    isSignedIn: isSignedIn ?? false,
    getToken: () => getToken(),
    signIn: () => { openSignIn() },
    signOut: () => { signOut() },
    user: user ? {
      name: user.fullName ?? undefined,
      avatar: user.imageUrl ?? undefined,
      email: user.primaryEmailAddress?.emailAddress ?? undefined,
    } : null,
    mode: "clerk",
  }), [isSignedIn, getToken, openSignIn, signOut, user])

  return <AuthProvider value={auth}>{children}</AuthProvider>
}

/** Wraps the app with Clerk auth. */
export function ClerkAuthWrapper({ children }: { children: ReactNode }) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/#/editor"
      signUpFallbackRedirectUrl="/#/editor"
    >
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  )
}

// --- Clerk-specific UI components re-exported for toolbar ---

export function AuthSignInButton({ children }: { children: ReactNode }) {
  return <SignInButton mode="modal">{children}</SignInButton>
}

export function AuthUserButton() {
  return <UserButton />
}

export function AuthShow({ when, children }: { when: "signed-in" | "signed-out"; children: ReactNode }) {
  return <Show when={when}>{children}</Show>
}
