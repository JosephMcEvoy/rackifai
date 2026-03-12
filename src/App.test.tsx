import { render, screen } from "@testing-library/react"
import { expect, test, beforeEach, vi } from "vitest"
import App from "./App"

vi.mock("@/lib/auth-context", () => ({
  useAppAuth: () => ({
    isSignedIn: false,
    getToken: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null,
    mode: "none",
  }),
  detectAuthMode: () => "none",
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock Clerk imports in case any lazy-loaded module pulls them in
vi.mock("@clerk/react", () => ({
  useAuth: () => ({
    isSignedIn: false,
    getToken: vi.fn().mockResolvedValue(null),
  }),
  useUser: () => ({ user: null }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  Show: ({ children }: { children: React.ReactNode }) => children,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => null,
}))

beforeEach(() => {
  window.location.hash = ""
})

test("renders landing page by default", () => {
  render(<App />)
  expect(screen.getByText("Try it free")).toBeInTheDocument()
  expect(screen.getByText(/Plan your datacenter racks/)).toBeInTheDocument()
})

test("renders editor when hash is #/editor", () => {
  window.location.hash = "#/editor"
  render(<App />)
  // Project name is randomly generated, just check editor loaded
  expect(screen.getByText("Device Catalog")).toBeInTheDocument()
  expect(screen.getByText("Device Catalog")).toBeInTheDocument()
})
