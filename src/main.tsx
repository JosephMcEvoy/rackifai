import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { detectAuthMode } from './lib/auth-context.tsx'
import { bootCloudflareAnalytics } from './lib/cloudflare-analytics.ts'

const authMode = detectAuthMode()

// Lazy-load auth wrappers to avoid bundling Clerk when not needed
const ClerkAuthWrapper = lazy(() =>
  import('./lib/auth-clerk.tsx').then((m) => ({ default: m.ClerkAuthWrapper }))
)
const LocalAuthWrapper = lazy(() =>
  import('./lib/auth-local.tsx').then((m) => ({
    default: ({ children }: { children: React.ReactNode }) => (
      <m.LocalAuthWrapper mode={authMode}>{children}</m.LocalAuthWrapper>
    ),
  }))
)

bootCloudflareAnalytics()

// eslint-disable-next-line react-refresh/only-export-components
function AuthWrapper({ children }: { children: React.ReactNode }) {
  if (authMode === 'clerk') {
    return (
      <Suspense fallback={null}>
        <ClerkAuthWrapper>{children}</ClerkAuthWrapper>
      </Suspense>
    )
  }
  return (
    <Suspense fallback={null}>
      <LocalAuthWrapper>{children}</LocalAuthWrapper>
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthWrapper>
      <App />
    </AuthWrapper>
  </StrictMode>,
)
