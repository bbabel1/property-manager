// Minimal Buildium HTTP helper used by API routes to standardize headers and URLs

export type BuildiumMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function buildiumFetch(
  method: BuildiumMethod,
  path: string,
  params?: Record<string, any>,
  payload?: any
): Promise<{ ok: boolean; status: number; json?: any; errorText?: string }> {
  const base = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1'
  const q = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q.append(k, String(v))
    }
  }
  const url = `${base}${path}${q.toString() ? `?${q.toString()}` : ''}`
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || '',
        ...(process.env.BUILDIUM_API_KEY ? { 'x-buildium-api-key': process.env.BUILDIUM_API_KEY } : {})
      },
      body: payload && method !== 'GET' ? JSON.stringify(payload) : undefined
    })
    const text = await res.text()
    let json: any
    try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
    console.log(`[Buildium] ${method} ${path} -> ${res.status}`, json?.Id ? { Id: json.Id } : undefined)
    return { ok: res.ok, status: res.status, json, errorText: res.ok ? undefined : text }
  } catch (e) {
    console.warn(`[Buildium] ${method} ${path} failed`, (e as Error).message)
    return { ok: false, status: 0, errorText: (e as Error).message }
  }
}

