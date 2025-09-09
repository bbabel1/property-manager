import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

function buildiumHeaders() {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-buildium-client-id': Deno.env.get('BUILDIUM_CLIENT_ID')!,
    'x-buildium-client-secret': Deno.env.get('BUILDIUM_CLIENT_SECRET')!,
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const baseUrl = Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1'
    const body = await req.json().catch(() => ({}))
    const op = String(body?.op || '')

    if (op === 'list_payments') {
      const q = body?.query || {}
      const params = new URLSearchParams()
      if (q.limit) params.set('limit', String(q.limit))
      if (q.offset) params.set('offset', String(q.offset))
      if (q.billId) params.set('billId', String(q.billId))
      if (q.vendorId) params.set('vendorId', String(q.vendorId))
      if (q.dateFrom) params.set('dateFrom', String(q.dateFrom))
      if (q.dateTo) params.set('dateTo', String(q.dateTo))
      const url = `${baseUrl}/bills/payments?${params.toString()}`
      const res = await fetch(url, { headers: buildiumHeaders() })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (op === 'file_update') {
      const billId = body?.billId
      const fileId = body?.fileId
      const payload = body?.payload || {}
      const url = `${baseUrl}/bills/${billId}/files/${fileId}`
      const res = await fetch(url, { method: 'PUT', headers: buildiumHeaders(), body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (op === 'file_downloadrequest') {
      const billId = body?.billId
      const fileId = body?.fileId
      const url = `${baseUrl}/bills/${billId}/files/${fileId}/downloadrequest`
      const res = await fetch(url, { method: 'POST', headers: buildiumHeaders() })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown op' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})

