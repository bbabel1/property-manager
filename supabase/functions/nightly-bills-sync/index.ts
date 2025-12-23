// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:3000'
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const limit = Number(Deno.env.get('BILLS_SYNC_PAGE_SIZE') || '100')

    let totalImported = 0
    let offset = 0
    // Simple pagination loop
    while (true) {
      const url = new URL(`${appBaseUrl}/api/buildium/bills/sync`)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('offset', String(offset))

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-cron-secret': cronSecret
        }
      })

      if (!res.ok) {
        const details = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ success: false, error: 'Sync failed', details, offset }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status }
        )
      }

      const data = await res.json()
      const imported = Number(data?.imported || 0)
      totalImported += imported

      // Stop if fewer than page size
      if (imported < limit) break
      offset += limit
      // safety cap
      if (offset > 5000) break
    }

    return new Response(
      JSON.stringify({ success: true, totalImported }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
