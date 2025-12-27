// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }
}

function v1TaskStatusToLocal(status: string | null | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'new': return 'open'
    case 'inprogress':
    case 'in_progress': return 'in_progress'
    case 'completed': return 'completed'
    case 'cancelled': return 'cancelled'
    case 'onhold':
    case 'on_hold': return 'on_hold'
    default: return 'open'
  }
}

function priorityToLocal(priority: string | null | undefined): string {
  switch ((priority || '').toLowerCase()) {
    case 'low': return 'low'
    case 'high': return 'high'
    case 'critical': return 'critical'
    default: return 'medium'
  }
}

function normalizeDateString(s: string | null | undefined): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.valueOf())) return null
  return d.toISOString()
}

async function ensureCategoryByName(name: string, supabase: any): Promise<string | null> {
  const trimmed = (name || '').trim()
  if (!trimmed) return null
  const { data: existing } = await supabase
    .from('task_categories')
    .select('id')
    .ilike('name', trimmed)
    .maybeSingle()
  if (existing?.id) return existing.id
  const now = new Date().toISOString()
  const { data: created } = await supabase
    .from('task_categories')
    .insert({ name: trimmed, is_active: true, created_at: now, updated_at: now })
    .select('id')
    .single()
  return created?.id ?? null
}

async function ensureTaskCategoryFromTask(task: any, supabase: any): Promise<string | null> {
  const category = task?.Category
  if (typeof category === 'string' && category.trim()) {
    return ensureCategoryByName(category.trim(), supabase)
  }
  if (category && typeof category === 'object') {
    const parentIdNum = typeof category.Id === 'number' ? category.Id : null
    const parentName = typeof category.Name === 'string' ? category.Name : null
    const sub = category.SubCategory

    // ensure parent
    let parentRowId: string | null = null
    if (parentIdNum || parentName) {
      const { data: existingParent } = await supabase
        .from('task_categories')
        .select('id')
        .or([
          parentIdNum ? `buildium_category_id.eq.${parentIdNum}` : 'buildium_category_id.is.null',
          parentName ? `name.ilike.${parentName}` : 'name.is.null'
        ].join(','))
        .maybeSingle()
      if (existingParent?.id) {
        parentRowId = existingParent.id
      } else {
        const now = new Date().toISOString()
        const { data: createdParent } = await supabase
          .from('task_categories')
          .insert({ name: parentName || `Category ${parentIdNum}`, buildium_category_id: parentIdNum, is_active: true, created_at: now, updated_at: now })
          .select('id')
          .single()
        parentRowId = createdParent?.id ?? null
      }
    }

    const subIdNum = typeof sub?.Id === 'number' ? sub.Id : null
    const subName = typeof sub?.Name === 'string' ? sub.Name : null
    if (subIdNum || subName) {
      const { data: existingSub } = await supabase
        .from('task_categories')
        .select('id')
        .or([
          subIdNum ? `buildium_subcategory_id.eq.${subIdNum}` : 'buildium_subcategory_id.is.null',
          subName ? `name.ilike.${subName}` : 'name.is.null'
        ].join(','))
        .maybeSingle()
      if (existingSub?.id) return existingSub.id
      const now = new Date().toISOString()
      const { data: createdSub } = await supabase
        .from('task_categories')
        .insert({ name: subName || `SubCategory ${subIdNum}`, buildium_subcategory_id: subIdNum, parent_id: parentRowId, is_active: true, created_at: now, updated_at: now })
        .select('id')
        .single()
      return createdSub?.id ?? parentRowId
    }
    return parentRowId
  }
  return null
}

async function resolveLocalPropertyId(buildiumPropertyId: number | null | undefined, supabase: any): Promise<string | null> {
  if (!buildiumPropertyId) return null
  const { data } = await supabase.from('properties').select('id').eq('buildium_property_id', buildiumPropertyId).maybeSingle()
  return data?.id ?? null
}

async function resolveLocalUnitId(buildiumUnitId: number | null | undefined, supabase: any): Promise<string | null> {
  if (!buildiumUnitId) return null
  const { data } = await supabase.from('units').select('id').eq('buildium_unit_id', buildiumUnitId).maybeSingle()
  return data?.id ?? null
}

async function resolveStaffIdByBuildiumUserId(buildiumUserId: any, supabase: any): Promise<number | null> {
  const idNum = Number(buildiumUserId)
  if (!Number.isFinite(idNum)) return null
  const { data } = await supabase.from('staff').select('id').eq('buildium_user_id', idNum).maybeSingle()
  return data?.id ?? null
}

async function ensureContactForBuildiumContact(entity: any, supabase: any): Promise<number | null> {
  const buildiumContactId = Number(entity?.Id)
  if (!Number.isFinite(buildiumContactId)) return null
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('buildium_contact_id', buildiumContactId)
    .maybeSingle()
  if (existing?.id) return existing.id
  const now = new Date().toISOString()
  const isCompany = !!entity?.IsCompany
  const firstName = entity?.FirstName || null
  const lastName = entity?.LastName || null
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || (isCompany ? 'Company' : 'Contact')
  const { data: created } = await supabase
    .from('contacts')
    .insert({ is_company: isCompany, first_name: firstName, last_name: lastName, display_name: displayName, buildium_contact_id: buildiumContactId, created_at: now, updated_at: now })
    .select('id')
    .single()
  return created?.id ?? null
}

async function buildRequestedByFields(entity: any, supabase: any): Promise<{
  requested_by_contact_id: number | null
  requested_by_type: string | null
  requested_by_buildium_id: number | null
}> {
  const result = { requested_by_contact_id: null as number | null, requested_by_type: null as string | null, requested_by_buildium_id: null as number | null }
  if (!entity || typeof entity !== 'object') return result
  const type = String(entity.Type || '').trim() || null
  const idNum = Number(entity.Id)
  result.requested_by_type = type
  result.requested_by_buildium_id = Number.isFinite(idNum) ? idNum : null
  if (type?.toLowerCase().includes('contact')) {
    const contactId = await ensureContactForBuildiumContact(entity, supabase)
    if (contactId) result.requested_by_contact_id = contactId
  }
  return result
}

type BuildiumCredentials = { baseUrl: string; clientId: string; clientSecret: string }

function resolveBuildiumCreds(input?: Partial<BuildiumCredentials> | null): BuildiumCredentials {
  const baseUrl = (input?.baseUrl || Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1').replace(/\/$/, '')
  const clientId = (input?.clientId || Deno.env.get('BUILDIUM_CLIENT_ID') || '').trim()
  const clientSecret = (input?.clientSecret || Deno.env.get('BUILDIUM_CLIENT_SECRET') || '').trim()
  return { baseUrl, clientId, clientSecret }
}

function getBuildiumPropertyIdFromTask(task: any): number | null {
  if (typeof task?.PropertyId === 'number') return task.PropertyId
  if (typeof task?.Property?.Id === 'number') return task.Property.Id
  return null
}

function getBuildiumUnitIdFromTask(task: any): number | null {
  if (typeof task?.UnitId === 'number') return task.UnitId
  return null
}

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
  let categoryId = await ensureTaskCategoryFromTask(item, supabase)
  if (!categoryId) categoryId = await ensureCategoryByName('To-Do', supabase)
  const assignedToStaffId = await resolveStaffIdByBuildiumUserId(item?.AssignedToUserId, supabase)
  const requested = await buildRequestedByFields(item?.RequestedByUserEntity, supabase)

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
    task_category_id: categoryId,
    assigned_to_staff_id: assignedToStaffId,
    requested_by_contact_id: requested.requested_by_contact_id,
    requested_by_type: requested.requested_by_type,
    requested_by_buildium_id: requested.requested_by_buildium_id,
    task_kind: 'todo' as const,
    buildium_task_id: typeof item?.Id === 'number' ? item.Id : null,
    buildium_property_id: buildiumPropertyId,
    buildium_unit_id: buildiumUnitId,
    buildium_assigned_to_user_id: typeof item?.AssignedToUserId === 'number' ? item.AssignedToUserId : null,
    updated_at: now
  }

  const buildiumId = row.buildium_task_id
  if (!buildiumId) return
  const { data: existing } = await supabase.from('tasks').select('id').eq('buildium_task_id', buildiumId).maybeSingle()
  if (existing?.id) {
    await supabase.from('tasks').update(row).eq('id', existing.id)
  } else {
    await supabase.from('tasks').insert({ ...row, created_at: now })
  }
}

serve(async (req) => {
  const headers = cors()
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const bodyMaybe = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const creds = resolveBuildiumCreds(bodyMaybe?.credentials as Partial<BuildiumCredentials> | undefined)
    if (!creds.clientId || !creds.clientSecret) {
      return new Response(JSON.stringify({ error: 'Buildium credentials missing' }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 })
    }
    const baseUrl = creds.baseUrl || 'https://apisandbox.buildium.com/v1'
    const clientId = creds.clientId
    const clientSecret = creds.clientSecret

    const url = new URL(req.url)
    const { searchParams } = url

    if (req.method === 'GET') {
      const qp = new URLSearchParams()
      ;['limit','offset','orderby','status','priority','assignedTo','dateFrom','dateTo'].forEach(p => {
        const v = searchParams.get(p)
        if (v) qp.append(p, v)
      })

      const resp = await fetch(`${baseUrl}/todorequests?${qp.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'x-buildium-client-id': clientId, 'x-buildium-client-secret': clientSecret }
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        return new Response(JSON.stringify({ error: 'Failed to fetch to-do requests', details: err }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: resp.status })
      }
      const items: any[] = await resp.json()

      // Persist all
      await Promise.all((Array.isArray(items) ? items : []).map((i) => upsertTaskFromBuildium(i, supabase)))

      // Optional filter in response
      const requestedByTypeParam = searchParams.get('requestedByType')
      const includeUnspecified = (searchParams.get('includeUnspecified') || 'false').toLowerCase() === 'true'
      const requestedTypes = (requestedByTypeParam || '').split(',').map((s)=>s.trim().toLowerCase()).filter(Boolean)
      const filtered = Array.isArray(items) && requestedTypes.length > 0
        ? items.filter((i: any) => {
            const t = i?.RequestedByUserEntity?.Type
            if (!t) return includeUnspecified
            return requestedTypes.includes(String(t).toLowerCase())
          })
        : items

      return new Response(JSON.stringify({ success: true, data: filtered, count: Array.isArray(filtered) ? filtered.length : 0 }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (req.method === 'POST') {
      const body = bodyMaybe
      const resp = await fetch(`${baseUrl}/todorequests`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'x-buildium-client-id': clientId, 'x-buildium-client-secret': clientSecret },
        body: JSON.stringify(body)
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        return new Response(JSON.stringify({ error: 'Failed to create to-do request', details: err }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: resp.status })
      }
      const created = await resp.json()
      await upsertTaskFromBuildium(created, supabase)
      return new Response(JSON.stringify({ success: true, data: created }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: 201 })
    }

    return new Response(JSON.stringify({ error: 'Method not supported' }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: 405 })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Internal error' }), { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 })
  }
})
