// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

type BuildiumCredentials = { baseUrl: string; clientId: string; clientSecret: string }

function resolveCreds(input?: Partial<BuildiumCredentials> | null): BuildiumCredentials {
  const baseUrl = (input?.baseUrl || Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1').replace(/\/$/, '')
  const clientId = (input?.clientId || Deno.env.get('BUILDIUM_CLIENT_ID') || '').trim()
  const clientSecret = (input?.clientSecret || Deno.env.get('BUILDIUM_CLIENT_SECRET') || '').trim()
  return { baseUrl, clientId, clientSecret }
}

function buildiumHeaders(creds: BuildiumCredentials) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    // Header names are case-sensitive per Buildium API documentation
    'X-Buildium-Client-Id': creds.clientId,
    'X-Buildium-Client-Secret': creds.clientSecret,
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
    const body = await req.json().catch(() => ({}))
    const creds = resolveCreds(body?.credentials as Partial<BuildiumCredentials> | undefined)
    if (!creds.clientId || !creds.clientSecret) {
      return new Response(JSON.stringify({ success: false, error: 'Buildium credentials missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
    const baseUrl = creds.baseUrl || 'https://apisandbox.buildium.com/v1'
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
      const res = await fetch(url, { headers: buildiumHeaders(creds) })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (op === 'file_update') {
      const billId = body?.billId
      const fileId = body?.fileId
      const payload = body?.payload || {}
      const url = `${baseUrl}/bills/${billId}/files/${fileId}`
      const res = await fetch(url, { method: 'PUT', headers: buildiumHeaders(creds), body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (op === 'file_downloadrequest') {
      const billId = body?.billId
      const fileId = body?.fileId
      const url = `${baseUrl}/bills/${billId}/files/${fileId}/downloadrequest`
      const res = await fetch(url, { method: 'POST', headers: buildiumHeaders(creds) })
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown op' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
