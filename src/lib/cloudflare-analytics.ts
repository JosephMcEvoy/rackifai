const CLOUDFLARE_ANALYTICS_URL = 'https://static.cloudflareinsights.com/beacon.min.js'

function getAnalyticsToken(): string | null {
  const token = import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN?.trim()
  return token ? token : null
}

export function bootCloudflareAnalytics(): void {
  const token = getAnalyticsToken()
  if (!token || typeof document === 'undefined') return

  if (document.querySelector('script[data-rackifai-cf-beacon="true"]')) {
    return
  }

  const script = document.createElement('script')
  script.defer = true
  script.src = CLOUDFLARE_ANALYTICS_URL
  script.dataset.cfBeacon = JSON.stringify({ token })
  script.dataset.rackifaiCfBeacon = 'true'
  document.head.appendChild(script)
}
