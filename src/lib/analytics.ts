/**
 * Lightweight event tracking utility.
 * Posts events to /api/events via sendBeacon. No-ops on localhost.
 */

type EventName =
  | 'project_created'
  | 'device_placed'
  | 'export_completed'
  | 'share_generated'

function isDev(): boolean {
  try {
    const host = window.location.hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return true
  }
}

export function trackEvent(name: EventName, props?: Record<string, string>): void {
  if (isDev()) return

  const payload = JSON.stringify({ event: name, props, ts: Date.now() })
  const blob = new Blob([payload], { type: 'application/json' })
  navigator.sendBeacon('/api/events', blob)
}
