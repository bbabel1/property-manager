// deno-lint-ignore-file
import '../_shared/buildiumEgressGuard.ts';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildiumFetchEdge } from "../_shared/buildiumFetch.ts"

type BuildiumCredentials = { baseUrl: string; clientId: string; clientSecret: string }

function resolveCreds(input?: Partial<BuildiumCredentials> | null): BuildiumCredentials {
  const baseUrl = (input?.baseUrl || Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1').replace(/\/$/, '')
  const clientId = (input?.clientId || Deno.env.get('BUILDIUM_CLIENT_ID') || '').trim()
  const clientSecret = (input?.clientSecret || Deno.env.get('BUILDIUM_CLIENT_SECRET') || '').trim()
  return { baseUrl, clientId, clientSecret }
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
    const orgId = typeof body?.orgId === 'string' ? body.orgId : (typeof body?.org_id === 'string' ? body.org_id : null)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)
    const creds = resolveCreds(body?.credentials as Partial<BuildiumCredentials> | undefined)
    if (!orgId) {
      return new Response(
        JSON.stringify({ success: false, error: 'orgId required for Buildium requests' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }
    if (!creds.clientId || !creds.clientSecret) {
      return new Response(JSON.stringify({ success: false, error: 'Buildium credentials missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
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
      const url = `/bills/payments?${params.toString()}`
      const res = await buildiumFetchEdge(supabase, orgId, 'GET', url, undefined, creds)
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (op === 'file_update') {
      const billId = body?.billId
      const fileId = body?.fileId
      const payload = body?.payload || {}
      const url = `/bills/${billId}/files/${fileId}`
      const res = await buildiumFetchEdge(supabase, orgId, 'PUT', url, payload, creds)
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (op === 'file_downloadrequest') {
      const billId = body?.billId
      const fileId = body?.fileId
      const url = `/bills/${billId}/files/${fileId}/downloadrequest`
      const res = await buildiumFetchEdge(supabase, orgId, 'POST', url, undefined, creds)
      const data = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown op' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
