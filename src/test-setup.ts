import '@testing-library/jest-dom'
import 'vitest-canvas-mock'
import 'fake-indexeddb/auto'

// Polyfill ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
