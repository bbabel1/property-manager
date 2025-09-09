import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function cors() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } }
function v1TaskStatusToLocal(status: string | null | undefined): string { switch((status||'').toLowerCase()){case 'new':return 'open';case 'inprogress':case 'in_progress':return 'in_progress';case 'completed':return 'completed';case 'cancelled':return 'cancelled';case 'onhold':case 'on_hold':return 'on_hold';default:return 'open'} }
function priorityToLocal(priority: string | null | undefined): string { const p=(priority||'').toLowerCase(); return p==='low'?'low':p==='high'?'high':p==='critical'?'critical':'medium' }
function normalizeDateString(s: string | null | undefined): string | null { if (!s) return null; const d=new Date(s); return isNaN(d.valueOf())?null:d.toISOString() }
async function resolveLocalPropertyId(buildiumPropertyId: number | null | undefined, supabase: any): Promise<string | null> { if (!buildiumPropertyId) return null; const { data } = await supabase.from('properties').select('id').eq('buildium_property_id', buildiumPropertyId).maybeSingle(); return data?.id ?? null }
async function resolveLocalUnitId(buildiumUnitId: number | null | undefined, supabase: any): Promise<string | null> { if (!buildiumUnitId) return null; const { data } = await supabase.from('units').select('id').eq('buildium_unit_id', buildiumUnitId).maybeSingle(); return data?.id ?? null }
async function resolveStaffIdByBuildiumUserId(buildiumUserId: any, supabase: any): Promise<number | null> { const id=Number(buildiumUserId); if(!Number.isFinite(id)) return null; const { data } = await supabase.from('staff').select('id').eq('buildium_user_id', id).maybeSingle(); return data?.id ?? null }
async function resolveOwnerId(buildiumOwnerId: number | null | undefined, supabase: any): Promise<string | null> { if (!buildiumOwnerId) return null; const { data } = await supabase.from('owners').select('id').eq('buildium_owner_id', buildiumOwnerId).maybeSingle(); return data?.id ?? null }
async function contactIdForOwner(ownerId: string | null, supabase: any): Promise<number | null> { if (!ownerId) return null; const { data } = await supabase.from('owners').select('contact_id').eq('id', ownerId).maybeSingle(); return data?.contact_id ?? null }
function getBuildiumPropertyIdFromTask(task: any): number | null { if (typeof task?.PropertyId === 'number') return task.PropertyId; if (typeof task?.Property?.Id === 'number') return task.Property.Id; return null }
function getBuildiumUnitIdFromTask(task: any): number | null { if (typeof task?.UnitId === 'number') return task.UnitId; return null }

async function upsertTaskFromBuildium(item: any, supabase: any) {
  const subject = item?.Title || item?.Subject || 'Task'
  const status = v1TaskStatusToLocal(item?.TaskStatus || item?.Status)
  const priority = priorityToLocal(item?.Priority)
  const scheduled = normalizeDateString(item?.DueDate || item?.ScheduledDate)
  const completed = normalizeDateString(item?.CompletedDate)
  const buildiumPropertyId = getBuildiumPropertyIdFromTask(item)
  const buildiumUnitId = getBuildiumUnitIdFromTask(item)
  const [propertyId, unitId] = await Promise.all([
    resolveLocalPropertyId(buildiumPropertyId, supabase),
    resolveLocalUnitId(buildiumUnitId, supabase)
  ])
  const assignedToStaffId = await resolveStaffIdByBuildiumUserId(item?.AssignedToUserId, supabase)
  const ownerLocalId = await resolveOwnerId(item?.OwnerId, supabase)
  const requestedByContactId = await contactIdForOwner(ownerLocalId, supabase)
  const now = new Date().toISOString()
  const row = {
    subject,
    description: item?.Description ?? null,
    status,
    priority,
    scheduled_date: scheduled,
    completed_date: completed,
    property_id: propertyId,
    unit_id: unitId,
    assigned_to_staff_id: assignedToStaffId,
    owner_id: ownerLocalId,
    requested_by_contact_id: requestedByContactId,
    requested_by_type: 'Owner',
    requested_by_buildium_id: typeof item?.OwnerId === 'number' ? item.OwnerId : null,
    task_kind: 'owner' as const,
    buildium_task_id: typeof item?.Id === 'number' ? item.Id : null,
    buildium_property_id: buildiumPropertyId,
    buildium_unit_id: buildiumUnitId,
    buildium_owner_id: typeof item?.OwnerId === 'number' ? item.OwnerId : null,
    buildium_assigned_to_user_id: typeof item?.AssignedToUserId === 'number' ? item.AssignedToUserId : null,
    updated_at: now
  }
  const buildiumId = row.buildium_task_id
  if (!buildiumId) return
  const { data: existing } = await supabase.from('tasks').select('id').eq('buildium_task_id', buildiumId).maybeSingle()
  if (existing?.id) await supabase.from('tasks').update(row).eq('id', existing.id)
  else await supabase.from('tasks').insert({ ...row, created_at: now })
}

serve(async (req) => {
  const headers = cors()
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers })
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const baseUrl = Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1'
    const clientId = Deno.env.get('BUILDIUM_CLIENT_ID') || ''
    const clientSecret = Deno.env.get('BUILDIUM_CLIENT_SECRET') || ''
    const url = new URL(req.url)
    const { searchParams } = url

    if (req.method === 'GET') {
      const qp = new URLSearchParams()
      ;['limit','offset','orderby','status','ownerId','propertyId','unitId','dateFrom','dateTo'].forEach(p => { const v = searchParams.get(p); if (v) qp.append(p, v) })
      const resp = await fetch(`${baseUrl}/rentals/ownerrequests?${qp.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json', 'x-buildium-client-id': clientId, 'x-buildium-client-secret': clientSecret } })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        return new Response(JSON.stringify({ error: 'Failed to fetch owner requests', details: err }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: resp.status })
      }
      const items: any[] = await resp.json()
      await Promise.all((Array.isArray(items) ? items : []).map((i)=>upsertTaskFromBuildium(i, supabase)))
      const requestedByTypeParam = searchParams.get('requestedByType')
      const includeUnspecified = (searchParams.get('includeUnspecified') || 'false').toLowerCase() === 'true'
      const requestedTypes = (requestedByTypeParam || '').split(',').map((s)=>s.trim().toLowerCase()).filter(Boolean)
      const filtered = Array.isArray(items) && requestedTypes.length > 0
        ? items.filter((i: any) => { const t = i?.RequestedByUserEntity?.Type; if (!t) return includeUnspecified; return requestedTypes.includes(String(t).toLowerCase()) })
        : items
      return new Response(JSON.stringify({ success: true, data: filtered, count: Array.isArray(filtered) ? filtered.length : 0 }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const resp = await fetch(`${baseUrl}/rentals/ownerrequests`, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'x-buildium-client-id': clientId, 'x-buildium-client-secret': clientSecret }, body: JSON.stringify(body) })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        return new Response(JSON.stringify({ error: 'Failed to create owner request', details: err }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: resp.status })
      }
      const created = await resp.json()
      await upsertTaskFromBuildium(created, supabase)
      return new Response(JSON.stringify({ success: true, data: created }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: 201 })
    }

    return new Response(JSON.stringify({ error: 'Method not supported' }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: 405 })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Internal error' }), { headers: { ...cors(), 'Content-Type': 'application/json' }, status: 500 })
  }
})

