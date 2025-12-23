// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type RunSummary = {
  scanned: number
  upserted: number
  linked: number
  errors: string[]
}

serve(async (req) => {
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') || 'scheduled'

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const BUILDIUM_BASE = Deno.env.get('BUILDIUM_BASE_URL') || ''
  const BUILDIUM_CLIENT_ID = Deno.env.get('BUILDIUM_CLIENT_ID') || ''
  const BUILDIUM_CLIENT_SECRET = Deno.env.get('BUILDIUM_CLIENT_SECRET') || ''

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE)

  const runId = crypto.randomUUID()
  const start = Date.now()
  const summary: RunSummary = { scanned: 0, upserted: 0, linked: 0, errors: [] }

  async function writeResult(status: 'success' | 'partial' | 'failed') {
    try {
      await sb.from('buildium_sync_runs').insert({
        id: runId,
        job_type: 'staff_sync',
        started_at: new Date(start).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        scanned_count: summary.scanned,
        upserted_count: summary.upserted,
        linked_count: summary.linked,
        error_count: summary.errors.length,
        status,
        errors: summary.errors.length ? summary.errors.slice(0, 20) : null
      })
    } catch (_) {}
  }

  try {
    if (!BUILDIUM_BASE || !BUILDIUM_CLIENT_ID || !BUILDIUM_CLIENT_SECRET) {
      summary.errors.push('Buildium credentials missing')
      await writeResult('failed')
      return new Response(JSON.stringify({ error: 'Buildium not configured' }), { status: 501 })
    }

    // Page through /v1/users with limit/offset (typical pattern); stop when no results
    let offset = 0
    const limit = 100
    let totalReceived = 0
    for (let page = 0; page < 100; page++) { // hard safety limit
      const ep = `${BUILDIUM_BASE.replace(/\/$/, '')}/users?limit=${limit}&offset=${offset}`
      const res = await fetch(ep, {
        headers: {
          'Accept': 'application/json',
          'x-buildium-client-id': BUILDIUM_CLIENT_ID,
          'x-buildium-client-secret': BUILDIUM_CLIENT_SECRET,
        }
      })
      if (!res.ok) {
        const details = await res.text().catch(()=>'')
        summary.errors.push(`Buildium users fetch failed: ${res.status} ${details}`)
        break
      }
      const users = await res.json().catch(()=>[] as any[])
      if (!Array.isArray(users) || users.length === 0) break
      totalReceived += users.length
      summary.scanned += users.length

      for (const u of users) {
        // Map Buildium user → local staff
        const roleStr = String(u?.Role || u?.UserType || '').toLowerCase()
        let localRole: string | null = null
        if (roleStr.includes('assistant')) localRole = 'ASSISTANT_PROPERTY_MANAGER'
        else if (roleStr.includes('maintenance')) localRole = 'MAINTENANCE_COORDINATOR'
        else if (roleStr.includes('accountant')) localRole = 'ACCOUNTANT'
        else if (roleStr.includes('admin')) localRole = 'ADMINISTRATOR'
        else if (roleStr.includes('manager')) localRole = 'PROPERTY_MANAGER'

        const row: any = {
          first_name: u?.FirstName || null,
          last_name: u?.LastName || null,
          email: u?.Email || null,
          phone: u?.PhoneNumber || null,
          title: u?.Title || null,
          role: localRole,
          buildium_staff_id: typeof u?.Id === 'number' ? u.Id : null,
          is_active: (typeof u?.IsActive === 'boolean' ? u.IsActive : true)
        }
        try {
          const { error } = await sb.from('staff').upsert(row, { onConflict: 'buildium_staff_id' }).select('id').single()
          if (!error) summary.upserted += 1
        } catch (e) {
          summary.errors.push(`upsert error: ${String(e)}`)
        }
      }

      offset += limit
      // If fewer than limit returned, done
      if (users.length < limit) break
    }

    // ---- Reconcile property managers from Buildium ----
    // Buildium typically exposes properties under /rentals/properties; fallback to /properties if needed.
    try {
      let poffset = 0
      const plimit = 100
      for (let p = 0; p < 200; p++) {
        const purl1 = `${BUILDIUM_BASE.replace(/\/$/, '')}/rentals/properties?limit=${plimit}&offset=${poffset}`
        const purl2 = `${BUILDIUM_BASE.replace(/\/$/, '')}/properties?limit=${plimit}&offset=${poffset}`
        let pres = await fetch(purl1, { headers: { 'Accept':'application/json','x-buildium-client-id':BUILDIUM_CLIENT_ID,'x-buildium-client-secret':BUILDIUM_CLIENT_SECRET } })
        if (!pres.ok) pres = await fetch(purl2, { headers: { 'Accept':'application/json','x-buildium-client-id':BUILDIUM_CLIENT_ID,'x-buildium-client-secret':BUILDIUM_CLIENT_SECRET } })
        if (!pres.ok) { summary.errors.push(`Buildium properties fetch failed: ${pres.status}`); break }
        const props = await pres.json().catch(()=>[] as any[])
        if (!Array.isArray(props) || props.length === 0) break
        for (const rp of props) {
          const buildiumPropertyId = rp?.Id
          const managerId = rp?.RentalManager ?? rp?.PropertyManagerId ?? null
          if (!buildiumPropertyId || !managerId) continue
          // Resolve local property id from buildium_property_id
          const { data: propRow } = await sb.from('properties').select('id').eq('buildium_property_id', buildiumPropertyId).maybeSingle()
          if (!propRow?.id) continue
          // Resolve local staff by buildium_staff_id (preferred) or buildium_user_id (legacy)
          const { data: st } = await sb.from('staff').select('id').eq('buildium_user_id', managerId).maybeSingle()
          if (!st?.id) continue
          // Enforce single manager
          await sb.from('property_staff').delete().eq('property_id', propRow.id).eq('role','PROPERTY_MANAGER')
          await sb.from('property_staff').upsert({ property_id: propRow.id, staff_id: st.id, role: 'PROPERTY_MANAGER', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any, { onConflict: 'property_id,staff_id,role' } as any)
          summary.linked++
        }
        poffset += plimit
        if (props.length < plimit) break
      }
    } catch (e) {
      summary.errors.push(`property reconcile error: ${String(e)}`)
    }

    await writeResult(summary.errors.length ? 'partial' : 'success')
    return new Response(JSON.stringify({ success: true, ...summary }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    summary.errors.push(String(e))
    await writeResult('failed')
    return new Response(JSON.stringify({ error: 'Sync failed', details: String(e) }), { status: 500 })
  }
})
