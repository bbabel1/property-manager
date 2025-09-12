export function track(event: string, data?: Record<string, any>) {
  try {
    // Minimal analytics stub; replace with real endpoint if available
    console.debug('[track]', event, data || {})
  } catch {}
}

