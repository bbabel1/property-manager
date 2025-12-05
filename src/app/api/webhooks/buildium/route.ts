import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabase, supabaseAdmin } from '@/lib/db'
import { upsertBillWithLines, resolveBankAccountId, resolveGLAccountId, mapGLAccountFromBuildiumWithSubAccounts, mapPropertyFromBuildiumWithBankAccount, mapTaskFromBuildiumWithRelations } from '@/lib/buildium-mappers'
import { mapUnitFromBuildium } from '@/lib/buildium-mappers'

function computeHmac(raw: string, secret: string) {
  const buf = createHmac('sha256', secret).update(raw).digest()
  return {
    hex: buf.toString('hex'),
    base64: buf.toString('base64'),
  }
}

function verifySignature(req: NextRequest, raw: string): { ok: boolean; reason?: string } {
  // Try multiple possible header names for Buildium signature
  const sig = 
    req.headers.get('x-buildium-signature') || 
    req.headers.get('buildium-webhook-signature') ||
    req.headers.get('x-buildium-webhook-signature') ||
    ''
  
  // Try multiple possible header names for timestamp
  const timestamp = 
    req.headers.get('buildium-webhook-timestamp') ||
    req.headers.get('x-buildium-timestamp') ||
    req.headers.get('x-buildium-webhook-timestamp') ||
    ''
  
  const secret = process.env.BUILDIUM_WEBHOOK_SECRET || ''

  // In local/dev, allow processing without a secret to simplify testing.
  if (!secret) {
    console.warn('[buildium-webhook] BUILDIUM_WEBHOOK_SECRET is not set; skipping signature verification')
    return { ok: true }
  }

  if (!sig) {
    // Log in development to help debug
    if (process.env.NODE_ENV === 'development') {
      console.warn('[buildium-webhook] No signature header found. Checked headers:', {
        'x-buildium-signature': req.headers.get('x-buildium-signature'),
        'buildium-webhook-signature': req.headers.get('buildium-webhook-signature'),
        'x-buildium-webhook-signature': req.headers.get('x-buildium-webhook-signature'),
      })
    }
    return { ok: false, reason: 'missing-signature' }
  }

  try {
    // Try both the secret as-is and base64 decoded (Buildium secret might be base64)
    let secretToUse = secret
    try {
      // If secret looks like base64, try decoding it
      if (secret.includes('=') && secret.length % 4 === 0) {
        const decoded = Buffer.from(secret, 'base64').toString('utf-8')
        if (decoded && decoded.length > 0) {
          secretToUse = decoded
        }
      }
    } catch {
      // If decoding fails, use original secret
    }
    
    // Buildium signs: timestamp + '.' + raw body, then HMAC-SHA256, then base64 encode
    // If timestamp is present, use it; otherwise sign just the raw body
    const payloadToSign = timestamp ? `${timestamp}.${raw}` : raw
    
    // Try with both original secret and decoded secret
    const { hex, base64 } = computeHmac(payloadToSign, secretToUse)
    const { hex: hexOriginal, base64: base64Original } = secretToUse !== secret ? computeHmac(payloadToSign, secret) : { hex: '', base64: '' }
    
    // Buildium signature is base64-encoded HMAC
    // The signature we receive is already base64, so we need to compare base64 to base64
    // Also try converting hex to base64 for comparison
    const expectedBase64FromHex = Buffer.from(hex, 'hex').toString('base64')
    const expectedBase64FromHexOriginal = hexOriginal ? Buffer.from(hexOriginal, 'hex').toString('base64') : ''
    
    // Check if Buildium sends signature with a prefix (e.g., "sha256=...")
    const sigWithoutPrefix = sig.replace(/^(sha256=|sha1=)/i, '')
    
    // Try exact match with base64 (most likely format)
    if (sig === base64 || sig === expectedBase64FromHex) {
      return { ok: true }
    }
    
    // Try without prefix
    if (sigWithoutPrefix === base64 || sigWithoutPrefix === expectedBase64FromHex) {
      return { ok: true }
    }
    
    // Try with original secret if we tried decoded
    if (hexOriginal && (sig === base64Original || sig === expectedBase64FromHexOriginal)) {
      return { ok: true }
    }
    if (hexOriginal && (sigWithoutPrefix === base64Original || sigWithoutPrefix === expectedBase64FromHexOriginal)) {
      return { ok: true }
    }
    
    // Also try hex format (unlikely but possible)
    if (sig === hex || sigWithoutPrefix === hex) {
      return { ok: true }
    }
    if (hexOriginal && (sig === hexOriginal || sigWithoutPrefix === hexOriginal)) {
      return { ok: true }
    }
    
    // Log for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] Signature verification failed:', {
        reason: 'signature-mismatch',
        receivedLength: sig.length,
        hasTimestamp: !!timestamp,
        bodyLength: raw.length,
      })
    }
    
    return { ok: false, reason: 'invalid-signature' }
  } catch (e) {
    console.error('[buildium-webhook] HMAC error:', e)
    return { ok: false, reason: 'hmac-error' }
  }
}

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin || supabase
  const raw = await req.text()
  
  // Log webhook receipt (in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[buildium-webhook] Received webhook, body length:', raw.length)
  }
  
  let body: any = {}
  try {
    body = JSON.parse(raw || '{}')
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sigCheck = verifySignature(req, raw)
  if (!sigCheck.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] Signature check failed:', sigCheck.reason)
    }
    return NextResponse.json({ error: 'Invalid signature', reason: sigCheck.reason }, { status: 401 })
  }

  // Buildium sends events in different formats:
  // 1. { Events: [...] } - array of events
  // 2. { EventName: "...", ... } - single event object (current format)
  // 3. { Event: {...} } - wrapped single event
  let events: any[] = []
  
  if (Array.isArray(body?.Events)) {
    events = body.Events
  } else if (body?.Event) {
    events = [body.Event]
  } else if (body?.EventName || body?.Id || body?.eventId) {
    // Single event object (Buildium's current format)
    events = [body]
  }

  if (!events.length) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] No events found in payload. Body structure:', {
        hasEvents: !!body?.Events,
        hasEvent: !!body?.Event,
        hasEventName: !!body?.EventName,
        hasId: !!body?.Id,
        bodyKeys: Object.keys(body || {}),
        bodyPreview: JSON.stringify(body).substring(0, 200),
      })
    }
    return NextResponse.json({ error: 'No webhook events found in payload' }, { status: 400 })
  }

  const signatureHeader = req.headers.get('x-buildium-signature') || ''
  const results: { eventId: string | number | null; status: 'processed' | 'duplicate' | 'error'; error?: string }[] = []

  const buildiumCreds = {
    baseUrl: process.env.BUILDIUM_BASE_URL,
    clientId: process.env.BUILDIUM_CLIENT_ID,
    clientSecret: process.env.BUILDIUM_CLIENT_SECRET,
  }
  const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleEnv = process.env.SUPABASE_SERVICE_ROLE_KEY

  async function fetchLeaseTransaction(leaseId: number, transactionId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/leases/${leaseId}/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch transaction before forwarding', { status: res.status, body: txt })
      return null
    }
    return res.json()
  }
  async function fetchGLAccount(glAccountId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/glaccounts/${glAccountId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch glaccount before forwarding', { status: res.status, body: txt })
      return null
    }
    return res.json()
  }

  async function fetchLease(leaseId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/leases/${leaseId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch lease', { status: res.status, body: txt })
      return null
    }
    return res.json()
  }

  async function fetchLeaseTenant(tenantId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/leases/tenants/${tenantId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch lease tenant', { status: res.status, body: txt })
      return null
    }
    return res.json()
  }

  async function fetchLeaseMoveOut(leaseId: number, tenantId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/leases/${leaseId}/moveouts/${tenantId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch lease moveout', { status: res.status, body: txt })
      return null
    }
    return res.json()
  }

  async function fetchBill(billId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/bills/${billId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch bill', { status: res.status, body: txt })
      return null
    }
    return res.json()
  }

  async function fetchBillPayment(billId: number, paymentId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/bills/${billId}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch bill payment', { status: res.status, body: txt, billId, paymentId })
      return null
    }
    return res.json()
  }

  async function fetchGLAccountRemote(glAccountId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/glaccounts/${glAccountId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch GL account', { status: res.status, body: txt, glAccountId })
      return null
    }
    return res.json()
  }

  async function upsertGLAccountWithOrg(gl: any, buildiumAccountId?: number | null) {
    const mapped = await mapGLAccountFromBuildiumWithSubAccounts(gl, admin)
    const now = new Date().toISOString()
    const orgId = await resolveOrgIdFromBuildiumAccount(buildiumAccountId)
    const { data: existing, error: findErr } = await admin
      .from('gl_accounts')
      .select('id, created_at')
      .eq('buildium_gl_account_id', mapped.buildium_gl_account_id)
      .maybeSingle()
    if (findErr && findErr.code !== 'PGRST116') throw findErr
    if (existing?.id) {
      await admin
        .from('gl_accounts')
        .update({ ...mapped, org_id: orgId ?? mapped.org_id ?? null, updated_at: now })
        .eq('id', existing.id)
    } else {
      await admin
        .from('gl_accounts')
        .insert({ ...mapped, org_id: orgId ?? mapped.org_id ?? null, created_at: now, updated_at: now })
    }
  }

  async function fetchRentalProperty(propertyId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/rentals/${propertyId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch rental property', { status: res.status, body: txt, propertyId })
      return null
    }
    return res.json()
  }

  async function fetchRentalUnit(unitId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/rentals/units/${unitId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch rental unit', { status: res.status, body: txt, unitId })
      return null
    }
    return res.json()
  }

  async function upsertPropertyFromBuildium(buildiumProperty: any, buildiumAccountId?: number | null) {
    const now = new Date().toISOString()
    const orgId = await resolveOrgIdFromBuildiumAccount(buildiumAccountId)
    const mapped = await mapPropertyFromBuildiumWithBankAccount(buildiumProperty, admin)
    const payload = { ...mapped, org_id: orgId ?? mapped.org_id ?? null, updated_at: now }
    const { data: existing, error: findErr } = await admin
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumProperty?.Id)
      .maybeSingle()
    if (findErr && findErr.code !== 'PGRST116') throw findErr
    if (existing?.id) {
      await admin.from('properties').update(payload).eq('id', existing.id)
      return existing.id
    } else {
      const { data: inserted, error: insErr } = await admin.from('properties').insert({ ...payload, created_at: now }).select('id').single()
      if (insErr) throw insErr
      return inserted?.id ?? null
    }
  }

  async function upsertUnitFromBuildium(buildiumUnit: any, buildiumAccountId?: number | null) {
    const now = new Date().toISOString()
    const orgId = await resolveOrgIdFromBuildiumAccount(buildiumAccountId)
    const mapped = mapUnitFromBuildium(buildiumUnit)
    const payload = { ...mapped, org_id: orgId ?? mapped.org_id ?? null, updated_at: now }
    // Resolve local property_id to link unit
    const propertyIdLocal = await (async () => {
      if (!buildiumUnit?.PropertyId) return null
      const { data, error } = await admin
        .from('properties')
        .select('id')
        .eq('buildium_property_id', buildiumUnit.PropertyId)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      return data?.id ?? null
    })()
    if (propertyIdLocal) (payload as any).property_id = propertyIdLocal
    const { data: existing, error: findErr } = await admin
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnit?.Id)
      .maybeSingle()
    if (findErr && findErr.code !== 'PGRST116') throw findErr
    if (existing?.id) {
      await admin.from('units').update(payload).eq('id', existing.id)
      return existing.id
    } else {
      const { data: inserted, error: insErr } = await admin.from('units').insert({ ...payload, created_at: now }).select('id').single()
      if (insErr) throw insErr
      return inserted?.id ?? null
    }
  }

  async function fetchTaskCategory(categoryId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/tasks/categories/${categoryId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch task category', { status: res.status, body: txt, categoryId })
      return null
    }
    return res.json()
  }

  async function upsertTaskCategory(buildiumCategory: any, buildiumAccountId?: number | null) {
    const now = new Date().toISOString()
    const orgId = await resolveOrgIdFromBuildiumAccount(buildiumAccountId)
    const payload: any = {
      buildium_category_id: buildiumCategory?.Id ?? null,
      name: buildiumCategory?.Name ?? null,
      is_active: true,
      description: null,
      color: null,
      parent_id: null,
      buildium_subcategory_id: null,
      created_at: now,
      updated_at: now,
    }
    const { data, error } = await admin
      .from('task_categories')
      .upsert({ ...payload, created_at: now }, { onConflict: 'buildium_category_id' })
      .select('id')
      .single()
    if (error) throw error
    return data?.id ?? null
  }

  async function updatePropertyManager(propertyIdBuildium: number, rentalManagerId?: number | null) {
    if (!rentalManagerId) return
    // Resolve local property id
    const { data: propRow, error: propErr } = await admin
      .from('properties')
      .select('id')
      .eq('buildium_property_id', propertyIdBuildium)
      .maybeSingle()
    if (propErr) throw propErr
    const propertyIdLocal = propRow?.id
    if (!propertyIdLocal) return

    // Resolve local staff id by buildium_staff_id
    const { data: staffRow, error: staffErr } = await admin
      .from('staff')
      .select('id')
      .eq('buildium_staff_id', rentalManagerId)
      .maybeSingle()
    if (staffErr) throw staffErr
    const staffId = staffRow?.id
    if (!staffId) return

    const now = new Date().toISOString()
    // Look for existing property_staff role PROPERTY_MANAGER
    const { data: existing, error: psErr } = await admin
      .from('property_staff')
      .select('property_id, staff_id, role')
      .eq('property_id', propertyIdLocal)
      .eq('role', 'PROPERTY_MANAGER')
      .maybeSingle()
    if (psErr && psErr.code !== 'PGRST116') throw psErr

    if (existing?.staff_id && existing.staff_id !== staffId) {
      // Reassign manager
      await admin
        .from('property_staff')
        .update({ staff_id: staffId, updated_at: now })
        .eq('property_id', propertyIdLocal)
        .eq('role', 'PROPERTY_MANAGER')
    } else if (!existing) {
      await admin
        .from('property_staff')
        .insert({ property_id: propertyIdLocal, staff_id: staffId, role: 'PROPERTY_MANAGER', created_at: now, updated_at: now })
    }
  }

  async function fetchTask(taskId: number) {
    if (!buildiumCreds.clientId || !buildiumCreds.clientSecret) return null
    const res = await fetch(`${buildiumCreds.baseUrl || 'https://apisandbox.buildium.com/v1'}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': buildiumCreds.clientId,
        'x-buildium-client-secret': buildiumCreds.clientSecret,
      }
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[buildium-webhook] Failed to fetch task', { status: res.status, body: txt, taskId })
      return null
    }
    return res.json()
  }

  async function upsertTaskFromBuildium(buildiumTask: any, buildiumAccountId?: number | null) {
    const now = new Date().toISOString()
    const taskKind = (() => {
      const t = (buildiumTask?.TaskType || '').toString().toLowerCase()
      if (t === 'todo') return 'todo'
      if (t === 'owner') return 'owner'
      if (t === 'resident') return 'resident'
      if (t === 'contact') return 'contact'
      return 'other'
    })()
    const mapped = await mapTaskFromBuildiumWithRelations(buildiumTask, admin, {
      taskKind,
      requireCategory: true,
      defaultCategoryName: 'To-Do',
    })
    const payload = {
      ...mapped,
      buildium_task_id: buildiumTask?.Id ?? mapped.buildium_task_id ?? null,
      buildium_assigned_to_user_id: buildiumTask?.AssignedToUserId ?? mapped.buildium_assigned_to_user_id ?? null,
      buildium_property_id: buildiumTask?.Property?.Id ?? mapped.buildium_property_id ?? null,
      buildium_unit_id: buildiumTask?.UnitId ?? mapped.buildium_unit_id ?? null,
      buildium_owner_id: mapped.buildium_owner_id ?? null,
      buildium_tenant_id: mapped.buildium_tenant_id ?? null,
      source: 'buildium',
      updated_at: now,
      created_at: mapped.created_at || now,
    }

    const { data: existing, error: findErr } = await admin
      .from('tasks')
      .select('id, created_at')
      .eq('buildium_task_id', payload.buildium_task_id)
      .maybeSingle()
    if (findErr && findErr.code !== 'PGRST116') throw findErr
    if (existing?.id) {
      await admin.from('tasks').update(payload).eq('id', existing.id)
      return existing.id
    } else {
      const { data: inserted, error: insErr } = await admin
        .from('tasks')
        .insert(payload)
        .select('id')
        .single()
      if (insErr) throw insErr
      return inserted?.id ?? null
    }
  }

  async function deleteGLAccountLocal(glAccountId: number) {
    const { data: existing, error } = await admin
      .from('gl_accounts')
      .select('id')
      .eq('buildium_gl_account_id', glAccountId)
      .maybeSingle()
    if (error) throw error
    const glId = existing?.id
    if (!glId) {
      console.log('[buildium-webhook] GL account delete received but not found locally', glAccountId)
      return
    }
    // Remove from any parent sub_accounts arrays
    const { data: parents, error: parentErr } = await admin
      .from('gl_accounts')
      .select('id, sub_accounts')
      .contains('sub_accounts', [glId])
    if (parentErr) throw parentErr
    if (parents && parents.length) {
      for (const p of parents) {
        const subs: string[] = Array.isArray(p?.sub_accounts) ? p.sub_accounts : []
        const filtered = subs.filter((sid) => sid !== glId)
        await admin.from('gl_accounts').update({ sub_accounts: filtered, updated_at: new Date().toISOString() }).eq('id', p.id)
      }
    }
    await admin.from('gl_accounts').delete().eq('id', glId)
    console.log('[buildium-webhook] GL account deleted locally', { glAccountId, glId })
  }

  async function deleteBillLocal(buildiumBillId: number) {
    // Find any transactions linked to this Buildium bill
    const { data: txRows, error } = await admin
      .from('transactions')
      .select('id')
      .eq('buildium_bill_id', buildiumBillId)
    if (error) throw error
    if (!txRows || txRows.length === 0) {
      console.log('[buildium-webhook] Bill delete received but not found locally', buildiumBillId)
      return
    }
    const txIds = txRows.map((t: any) => t.id).filter(Boolean)
    if (txIds.length) {
      await admin.from('transaction_lines').delete().in('transaction_id', txIds)
      await admin.from('transactions').delete().in('id', txIds)
      console.log('[buildium-webhook] Bill deleted locally', { buildiumBillId, transactionCount: txIds.length })
    }
  }

  async function deleteBillPaymentLocal(paymentId: number, billId?: number | null) {
    const query = admin.from('transactions').select('id')
    if (paymentId != null) query.eq('buildium_transaction_id', paymentId)
    if (billId != null) query.eq('buildium_bill_id', billId)
    const { data: txRows, error } = await query
    if (error) throw error
    if (!txRows || txRows.length === 0) {
      console.log('[buildium-webhook] Bill payment delete received but not found locally', { paymentId, billId })
      return
    }
    const txIds = txRows.map((t: any) => t.id).filter(Boolean)
    if (txIds.length) {
      await admin.from('transaction_lines').delete().in('transaction_id', txIds)
      await admin.from('transactions').delete().in('id', txIds)
      console.log('[buildium-webhook] Bill payment deleted locally', { paymentId, billId, transactionCount: txIds.length })
    }
  }

  async function deleteLeaseLocal(buildiumLeaseId: number) {
    const { data: leaseRow, error } = await admin
      .from('lease')
      .select('id')
      .eq('buildium_lease_id', buildiumLeaseId)
      .maybeSingle()
    if (error) throw error
    if (!leaseRow?.id) {
      console.log('[buildium-webhook] Lease delete received but not found locally', buildiumLeaseId)
      return
    }
    const leaseId = leaseRow.id
    // Null out monthly_logs referencing this lease
    await admin.from('monthly_logs').update({ lease_id: null, updated_at: new Date().toISOString() }).eq('lease_id', leaseId)
    // Delete lease_contacts for this lease
    await admin.from('lease_contacts').delete().eq('lease_id', leaseId)
    // Delete the lease row
    await admin.from('lease').delete().eq('id', leaseId)
    console.log('[buildium-webhook] Lease deleted locally', leaseId)
  }

  async function deleteTenantLocal(buildiumTenantId: number) {
    const { data: tenantRow, error } = await admin
      .from('tenants')
      .select('id')
      .eq('buildium_tenant_id', buildiumTenantId)
      .maybeSingle()
    if (error) throw error
    if (!tenantRow?.id) {
      console.log('[buildium-webhook] Tenant delete received but not found locally', buildiumTenantId)
      return
    }
    const tenantId = tenantRow.id
    await admin.from('lease_contacts').delete().eq('tenant_id', tenantId)
    await admin.from('tenants').delete().eq('id', tenantId)
    console.log('[buildium-webhook] Tenant deleted locally', tenantId)
  }

  async function syncLeaseViaEdge(leaseId: number) {
    const supabaseUrl = supabaseUrlEnv
    const serviceRole = serviceRoleEnv
    if (!supabaseUrl || !serviceRole) return
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/buildium-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ entityType: 'lease', operation: 'syncOneFromBuildium', entityData: { Id: leaseId } }),
      })
      if (!res.ok) {
        const details = await res.json().catch(() => ({}))
        console.error('[buildium-webhook] Lease sync edge call failed', { status: res.status, details })
      }
    } catch (err) {
      console.error('[buildium-webhook] Lease sync edge call error', err)
    }
  }

  // Forward LeaseTransaction events to the edge function that performs the
  // full fetch + upsert of transactions/lines.
  async function forwardLeaseTransactionEvents(eventsToForward: any[]) {
    if (!eventsToForward.length) return
    const supabaseUrl = supabaseUrlEnv
    const serviceRole = serviceRoleEnv
    if (!supabaseUrl || !serviceRole) {
      console.warn('[buildium-webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; cannot forward lease transactions')
      return
    }
    try {
      // Enrich events with full transaction data (to avoid Buildium calls from edge if blocked)
      const enrichedEvents = []
      for (const ev of eventsToForward) {
        const leaseId = ev?.LeaseId ?? ev?.Data?.LeaseId
        const transactionId = ev?.TransactionId ?? ev?.Data?.TransactionId ?? ev?.EntityId
        let fullTx = null
        if (leaseId && transactionId) {
          try {
            fullTx = await fetchLeaseTransaction(Number(leaseId), Number(transactionId))
          } catch (err) {
            console.error('[buildium-webhook] Error fetching transaction for enrichment', err)
          }
        }
        const cloned = { ...ev }
        cloned.Data = { ...(ev?.Data || {}), FullTransaction: fullTx }
        enrichedEvents.push(cloned)
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/buildium-lease-transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Edge function expects bearer auth for service role
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ Events: enrichedEvents, credentials: buildiumCreds }),
      })
      if (!res.ok) {
        const details = await res.json().catch(() => ({}))
        console.error('[buildium-webhook] Lease transaction forward failed', { status: res.status, details })
      }
    } catch (err) {
      console.error('[buildium-webhook] Error forwarding lease transaction events', err)
    }
  }

  try {
    // Local helpers to upsert the transaction+lines without relying on the edge function (for cases where Buildium blocks edge IPs).
    const normalizeDate = (d?: string | null) => {
      if (!d) return null
      const s = String(d)
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
      if (s.includes('T')) return s.slice(0, 10)
      return null
    }
    const resolveLocalPropertyId = async (buildiumPropertyId?: number | null) => {
      if (!buildiumPropertyId) return null
      const { data, error } = await admin.from('properties').select('id').eq('buildium_property_id', buildiumPropertyId).single()
      if (error && error.code !== 'PGRST116') throw error
      return data?.id ?? null
    }
    const resolveLocalUnitId = async (buildiumUnitId?: number | null) => {
      if (!buildiumUnitId) return null
      const { data, error } = await admin.from('units').select('id').eq('buildium_unit_id', buildiumUnitId).single()
      if (error && error.code !== 'PGRST116') throw error
      return data?.id ?? null
    }
    const resolvePropertyUuidByBuildiumId = async (supabaseClient: any, buildiumPropertyId?: number | null) => {
      if (!buildiumPropertyId) return null
      const { data, error } = await supabaseClient.from('properties').select('id').eq('buildium_property_id', buildiumPropertyId).maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      return data?.id ?? null
    }
    const resolveUnitUuidByBuildiumId = async (supabaseClient: any, buildiumUnitId?: number | null) => {
      if (!buildiumUnitId) return null
      const { data, error } = await supabaseClient.from('units').select('id').eq('buildium_unit_id', buildiumUnitId).maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      return data?.id ?? null
    }
    const mapCountryFromBuildiumLocal = (country?: string | null) => {
      if (!country) return null
      return country.replace(/([a-z])([A-Z])/g, '$1 $2')
    }
    const resolveLocalLeaseId = async (buildiumLeaseId?: number | null) => {
      if (!buildiumLeaseId) return null
      const { data, error } = await admin.from('lease').select('id').eq('buildium_lease_id', buildiumLeaseId).single()
      if (error && error.code !== 'PGRST116') throw error
      return data?.id ?? null
    }
    const resolveLeaseOrgId = async (buildiumLeaseId?: number | null, buildiumPropertyId?: number | null) => {
      if (buildiumLeaseId) {
        const { data } = await admin.from('lease').select('org_id').eq('buildium_lease_id', buildiumLeaseId).maybeSingle()
        if (data?.org_id) return data.org_id
      }
      if (buildiumPropertyId) {
        const { data } = await admin.from('properties').select('org_id').eq('buildium_property_id', buildiumPropertyId).maybeSingle()
        if (data?.org_id) return data.org_id
      }
      return null
    }
    const ensureGLAccountId = async (buildiumGLAccountId: number | null | undefined, fetchGL: (id: number) => Promise<any>) => {
      if (!buildiumGLAccountId) return null
      const { data, error } = await admin.from('gl_accounts').select('id').eq('buildium_gl_account_id', buildiumGLAccountId).single()
      if (!error && data?.id) return data.id
      if (error && error.code !== 'PGRST116') throw error
      const remote = await fetchGL(buildiumGLAccountId)
      if (!remote) throw new Error(`Unable to resolve GL account ${buildiumGLAccountId}`)
      const now = new Date().toISOString()
      const row = {
        buildium_gl_account_id: remote.Id,
        account_number: remote.AccountNumber ?? null,
        name: remote.Name,
        description: remote.Description ?? null,
        type: remote.Type,
        sub_type: remote.SubType ?? null,
        is_default_gl_account: !!remote.IsDefaultGLAccount,
        default_account_name: remote.DefaultAccountName ?? null,
        is_contra_account: !!remote.IsContraAccount,
        is_bank_account: !!remote.IsBankAccount,
        cash_flow_classification: remote.CashFlowClassification ?? null,
        exclude_from_cash_balances: !!remote.ExcludeFromCashBalances,
        is_active: remote.IsActive ?? true,
        buildium_parent_gl_account_id: remote.ParentGLAccountId ?? null,
        is_credit_card_account: !!remote.IsCreditCardAccount,
        sub_accounts: null,
        created_at: now,
        updated_at: now,
      }
      const { data: inserted, error: insErr } = await admin.from('gl_accounts').insert(row).select('id').single()
      if (insErr) throw insErr
      return inserted.id
    }
    const mapPaymentMethod = (pm?: string | null) => {
      if (!pm) return null
      const v = pm.toLowerCase()
      if (v.includes('check')) return 'Check'
      if (v === 'cash') return 'Cash'
      if (v.includes('money')) return 'MoneyOrder'
      if (v.includes('cashier')) return 'CashierCheck'
      if (v.includes('ach') || v.includes('bank') || v.includes('deposit')) return 'DirectDeposit'
      if (v.includes('credit')) return 'CreditCard'
      if (v.includes('electronic') || v.includes('online') || v.includes('epayment')) return 'ElectronicPayment'
      return null
    }
    const mapLeaseStatusFromBuildium = (status?: string | null) => {
      if (!status) return null
      const s = status.toLowerCase()
      if (s === 'active') return 'Active'
      if (s === 'future') return 'Future'
      if (s === 'past') return 'Past'
      if (s === 'cancelled' || s === 'canceled') return 'Cancelled'
      return status
    }
    const upsertLeaseTransactionWithLinesLocal = async (leaseTx: any, fetchGL: (id: number) => Promise<any>) => {
      const now = new Date().toISOString()
      const paymentMethod = mapPaymentMethod(leaseTx.PaymentMethod)
      const header = {
        buildium_transaction_id: leaseTx.Id,
        date: normalizeDate(leaseTx.Date),
        transaction_type: leaseTx.TransactionType || leaseTx.TransactionTypeEnum || 'Lease',
        total_amount: typeof leaseTx.TotalAmount === 'number' ? leaseTx.TotalAmount : Number(leaseTx.Amount ?? 0),
        check_number: leaseTx.CheckNumber ?? null,
        buildium_lease_id: leaseTx.LeaseId ?? null,
        memo: leaseTx?.Journal?.Memo ?? leaseTx?.Memo ?? null,
        payment_method: paymentMethod,
        updated_at: now,
      }
      const { data: existing, error: findErr } = await admin.from('transactions').select('id').eq('buildium_transaction_id', leaseTx.Id).single()
      if (findErr && findErr.code !== 'PGRST116') throw findErr
      const leaseIdLocal = await resolveLocalLeaseId(leaseTx.LeaseId ?? null)
      let transactionId: string
      if (existing?.id) {
        const { data, error } = await admin.from('transactions').update({ ...header, lease_id: leaseIdLocal }).eq('id', existing.id).select('id').single()
        if (error) throw error
        transactionId = data.id
      } else {
        const { data, error } = await admin.from('transactions').insert({ ...header, lease_id: leaseIdLocal, created_at: now }).select('id').single()
        if (error) throw error
        transactionId = data.id
      }
      await admin.from('transaction_lines').delete().eq('transaction_id', transactionId)
      const lines = Array.isArray(leaseTx?.Journal?.Lines) ? leaseTx.Journal.Lines : Array.isArray(leaseTx?.Lines) ? leaseTx.Lines : []
      let debit = 0, credit = 0
      for (const line of lines) {
        const amount = Number(line?.Amount ?? 0)
        const posting = amount >= 0 ? 'Credit' : 'Debit'
        const glBuildiumId = typeof line?.GLAccount === 'number' ? line?.GLAccount : (line?.GLAccount?.Id ?? line?.GLAccountId ?? null)
        const glId = await ensureGLAccountId(glBuildiumId, fetchGL)
        if (!glId) throw new Error(`GL account not found for line. BuildiumId=${glBuildiumId}`)
        const buildiumPropertyId = line?.PropertyId ?? null
        const buildiumUnitId = line?.Unit?.Id ?? line?.UnitId ?? null
        const propertyIdLocal = await resolveLocalPropertyId(buildiumPropertyId)
        const unitIdLocal = await resolveLocalUnitId(buildiumUnitId)
        await admin.from('transaction_lines').insert({
          transaction_id: transactionId,
          gl_account_id: glId,
          amount: Math.abs(amount),
          posting_type: posting,
          memo: line?.Memo ?? null,
          account_entity_type: 'Rental',
          account_entity_id: buildiumPropertyId,
          date: normalizeDate(leaseTx.Date),
          created_at: now,
          updated_at: now,
          buildium_property_id: buildiumPropertyId,
          buildium_unit_id: buildiumUnitId,
          buildium_lease_id: leaseTx.LeaseId ?? null,
          property_id: propertyIdLocal,
          unit_id: unitIdLocal,
        })
        if (posting === 'Debit') debit += Math.abs(amount)
        else credit += Math.abs(amount)
      }
      if (debit > 0 && credit > 0 && Math.abs(debit - credit) > 0.0001) {
        throw new Error(`Double-entry integrity violation: debits (${debit}) != credits (${credit})`)
      }
    }

    const mapLeaseFromBuildiumLocal = async (lease: any) => {
      const propertyUuid = await resolvePropertyUuidByBuildiumId(admin, lease.PropertyId)
      const unitUuid = await resolveUnitUuidByBuildiumId(admin, lease.UnitId)
      let orgId: string | null = null
      if (propertyUuid) {
        const { data: prop } = await admin.from('properties').select('org_id').eq('id', propertyUuid).maybeSingle()
        orgId = prop?.org_id ?? null
      }
      return {
        buildium_lease_id: lease.Id,
        buildium_property_id: lease.PropertyId ?? null,
        buildium_unit_id: lease.UnitId ?? null,
        unit_number: lease.UnitNumber ?? null,
        lease_from_date: normalizeDate(lease.LeaseFromDate),
        lease_to_date: normalizeDate(lease.LeaseToDate),
        lease_type: lease.LeaseType ?? null,
        status: mapLeaseStatusFromBuildium(lease.LeaseStatus),
        is_eviction_pending: typeof lease.IsEvictionPending === 'boolean' ? lease.IsEvictionPending : null,
        term_type: lease.TermType ?? null,
        renewal_offer_status: lease.RenewalOfferStatus ?? null,
        current_number_of_occupants: lease.CurrentNumberOfOccupants ?? null,
        security_deposit: lease.AccountDetails?.SecurityDeposit ?? null,
        rent_amount: lease.AccountDetails?.Rent ?? null,
        automatically_move_out_tenants: typeof lease.AutomaticallyMoveOutTenants === 'boolean' ? lease.AutomaticallyMoveOutTenants : null,
        buildium_created_at: lease.CreatedDateTime ?? null,
        buildium_updated_at: lease.LastUpdatedDateTime ?? null,
        payment_due_day: lease.PaymentDueDay ?? null,
        property_id: propertyUuid,
        unit_id: unitUuid,
        org_id: orgId,
        updated_at: new Date().toISOString(),
      }
    }

    const upsertLeaseFromBuildiumLocal = async (lease: any) => {
      const mapped = await mapLeaseFromBuildiumLocal(lease)
      if (!mapped.property_id || !mapped.unit_id) {
        throw new Error(`Missing local property/unit for Buildium lease ${lease.Id}. Sync properties/units first.`)
      }
      const { data: existing, error: findErr } = await admin
        .from('lease')
        .select('id')
        .eq('buildium_lease_id', lease.Id)
        .single()
      if (findErr && findErr.code !== 'PGRST116') throw findErr
      if (existing?.id) {
        const { data, error } = await admin.from('lease').update(mapped).eq('id', existing.id).select('id').single()
        if (error) throw error
        return data.id
      } else {
        const toInsert = { ...mapped, created_at: new Date().toISOString() }
        const { data, error } = await admin.from('lease').insert(toInsert).select('id').single()
        if (error) throw error
        return data.id
      }
    }

    const findOrCreateContactForLeasePerson = async (person: any, _orgId: string | null, preferredContactId?: number | null) => {
      // If caller supplies the contact_id from the tenant record, use it first.
      if (preferredContactId) {
        const { data } = await admin.from('contacts').select('id').eq('id', preferredContactId).maybeSingle()
        if (data?.id) return data.id
      }
      if (person?.Email) {
        const { data } = await admin.from('contacts').select('id').eq('primary_email', person.Email).maybeSingle()
        if (data?.id) return data.id
      }
      const now = new Date().toISOString()
      const primaryPhone = Array.isArray(person?.PhoneNumbers)
        ? (person.PhoneNumbers.find((p: any) => /cell|mobile/i.test(p?.Type))?.Number ||
          person.PhoneNumbers.find((p: any) => /home/i.test(p?.Type))?.Number ||
          person.PhoneNumbers.find((p: any) => /work/i.test(p?.Type))?.Number ||
          null)
        : (person?.PhoneNumbers?.Mobile || person?.PhoneNumbers?.Home || person?.PhoneNumbers?.Work || null)
      const altPhone = Array.isArray(person?.PhoneNumbers)
        ? (person.PhoneNumbers.find((p: any) => /work/i.test(p?.Type))?.Number ||
          person.PhoneNumbers.find((p: any) => /home/i.test(p?.Type))?.Number ||
          null)
        : (person?.PhoneNumbers?.Work || person?.PhoneNumbers?.Home || null)
      const addr = person?.Address || person?.PrimaryAddress || {}
      const altAddr = person?.AlternateAddress || {}
      const { data, error } = await admin
        .from('contacts')
        .insert({
          is_company: false,
          first_name: person?.FirstName ?? null,
          last_name: person?.LastName ?? null,
          primary_email: person?.Email ?? null,
          alt_email: person?.AlternateEmail ?? null,
          primary_phone: primaryPhone,
          alt_phone: altPhone,
          date_of_birth: person?.DateOfBirth ?? null,
          primary_address_line_1: addr?.AddressLine1 ?? null,
          primary_address_line_2: addr?.AddressLine2 ?? null,
          primary_address_line_3: addr?.AddressLine3 ?? null,
          primary_city: addr?.City ?? null,
          primary_state: addr?.State ?? null,
          primary_postal_code: addr?.PostalCode ?? null,
          primary_country: mapCountryFromBuildiumLocal(addr?.Country),
          alt_address_line_1: altAddr?.AddressLine1 ?? null,
          alt_address_line_2: altAddr?.AddressLine2 ?? null,
          alt_address_line_3: altAddr?.AddressLine3 ?? null,
          alt_city: altAddr?.City ?? null,
          alt_state: altAddr?.State ?? null,
          alt_postal_code: altAddr?.PostalCode ?? null,
          alt_country: mapCountryFromBuildiumLocal(altAddr?.Country),
          mailing_preference: person?.MailingPreference === 'PrimaryAddress' ? 'primary' : (person?.MailingPreference === 'AlternateAddress' ? 'alternate' : null),
          display_name: [person?.FirstName, person?.LastName].filter(Boolean).join(' ') || person?.Email || 'Tenant',
          created_at: now,
          updated_at: now,
          buildium_contact_id: person?.Id ?? null,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    }

    const findOrCreateTenantFromContact = async (contactId: number, person: any, orgId: string | null) => {
      const { data: existing } = await admin.from('tenants').select('id, buildium_tenant_id, org_id').eq('contact_id', contactId).maybeSingle()
      const incomingBuildiumId = Number(person?.Id) || null
      if (existing?.id) {
        if (incomingBuildiumId && existing.buildium_tenant_id !== incomingBuildiumId) {
          await admin.from('tenants').update({ buildium_tenant_id: incomingBuildiumId, updated_at: new Date().toISOString() }).eq('id', existing.id)
        }
        if (!existing.org_id && orgId) {
          await admin.from('tenants').update({ org_id: orgId, updated_at: new Date().toISOString() }).eq('id', existing.id)
        }
        return existing.id
      }
      const now = new Date().toISOString()
      const { data, error } = await admin
        .from('tenants')
        .insert({
          contact_id: contactId,
          comment: person?.Comment ?? null,
          tax_id: person?.TaxId ?? null,
          sms_opt_in_status: typeof person?.SMSOptInStatus === 'boolean' ? String(person.SMSOptInStatus) : null,
          emergency_contact_name: person?.EmergencyContact?.Name ?? null,
          emergency_contact_relationship: person?.EmergencyContact?.RelationshipDescription ?? null,
          emergency_contact_phone: person?.EmergencyContact?.Phone ?? null,
          emergency_contact_email: person?.EmergencyContact?.Email ?? null,
          created_at: now,
          updated_at: now,
          buildium_tenant_id: Number(person?.Id) || null,
          org_id: orgId,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    }

    const ensureLeaseContactLocal = async (leaseId: number, tenantId: string, role: string, orgId: string | null) => {
      const { data: existing } = await admin
        .from('lease_contacts')
        .select('id, status')
        .eq('lease_id', leaseId)
        .eq('tenant_id', tenantId)
        .eq('role', role)
        .maybeSingle()
      const now = new Date().toISOString()
      if (existing?.id) {
        if (existing.status !== 'Active') {
          await admin.from('lease_contacts').update({ status: 'Active', updated_at: now }).eq('id', existing.id)
        }
        return
      }
      await admin.from('lease_contacts').insert({ lease_id: leaseId, tenant_id: tenantId, role, status: 'Active', created_at: now, updated_at: now, org_id: orgId })
    }

    const upsertLeaseWithPartiesLocal = async (lease: any) => {
      const leaseIdLocal = await upsertLeaseFromBuildiumLocal(lease)
      const propertyUuid = await resolvePropertyUuidByBuildiumId(admin, lease.PropertyId)
      let orgId: string | null = null
      if (propertyUuid) {
        const { data: prop } = await admin.from('properties').select('org_id').eq('id', propertyUuid).maybeSingle()
        orgId = prop?.org_id ?? null
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('[buildium-webhook] upserting lease parties', {
          leaseId: lease.Id,
          tenantsCount: Array.isArray(lease?.Tenants) ? lease.Tenants.length : 0,
          cosignersCount: Array.isArray(lease?.Cosigners) ? lease.Cosigners.length : 0,
        })
      }
      // Tenants
      for (const t of Array.isArray(lease?.Tenants) ? lease.Tenants : []) {
        try {
          const contactId = await findOrCreateContactForLeasePerson(t, orgId)
          const tenantId = await findOrCreateTenantFromContact(contactId, t, orgId)
          await ensureLeaseContactLocal(leaseIdLocal, tenantId, 'Tenant', orgId)
        } catch (err) {
          console.warn('[buildium-webhook] Skipping tenant on lease upsert', err)
        }
      }
      // Cosigners
      for (const c of Array.isArray(lease?.Cosigners) ? lease.Cosigners : []) {
        try {
          const contactId = await findOrCreateContactForLeasePerson(c, orgId)
          const tenantId = await findOrCreateTenantFromContact(contactId, c, orgId)
          await ensureLeaseContactLocal(leaseIdLocal, tenantId, 'Guarantor', orgId)
        } catch (err) {
          console.warn('[buildium-webhook] Skipping cosigner on lease upsert', err)
        }
      }
      return leaseIdLocal
    }

    const resolveLocalLeaseIdStrict = async (buildiumLeaseId?: number | null) => {
      if (!buildiumLeaseId) return null
      const { data, error } = await admin.from('lease').select('id').eq('buildium_lease_id', buildiumLeaseId).maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      return data?.id ?? null
    }

    const updateLeaseContactStatuses = async (buildiumLeaseId: number, currentBuildiumTenantIds: Set<number>) => {
      const leaseLocalId = await resolveLocalLeaseIdStrict(buildiumLeaseId)
      if (!leaseLocalId) return
      const { data: rels, error } = await admin.from('lease_contacts').select('id, tenant_id, status').eq('lease_id', leaseLocalId)
      if (error) throw error
      if (!rels || rels.length === 0) return
      const tenantIds = rels.map((r: any) => r.tenant_id).filter(Boolean)
      if (!tenantIds.length) return
      const { data: tenants, error: terr } = await admin.from('tenants').select('id, buildium_tenant_id').in('id', tenantIds)
      if (terr) throw terr
      const buildiumMap = new Map((tenants || []).map((t: any) => [t.id, t.buildium_tenant_id]))
      const toActivate: string[] = []
      const toDeactivate: string[] = []
      for (const r of rels) {
        const buildiumId = buildiumMap.get(r.tenant_id)
        if (buildiumId && currentBuildiumTenantIds.has(Number(buildiumId))) {
          if (r.status !== 'Active') toActivate.push(r.id)
        } else {
          if (r.status !== 'Inactive') toDeactivate.push(r.id)
        }
      }
      if (toActivate.length) await admin.from('lease_contacts').update({ status: 'Active', updated_at: new Date().toISOString() }).in('id', toActivate)
      if (toDeactivate.length) await admin.from('lease_contacts').update({ status: 'Inactive', updated_at: new Date().toISOString() }).in('id', toDeactivate)
    }

    const resolveOrgIdFromBuildiumAccount = async (accountId?: number | null) => {
      if (!accountId) return null
      const { data, error } = await admin
        .from('organizations')
        .select('id')
        .eq('buildium_org_id', accountId)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      return data?.id ?? null
    }

    const upsertBillPaymentWithLines = async (payment: any, billId: number, fetchGL: (id: number) => Promise<any>) => {
      const now = new Date().toISOString()
      const paymentId = payment?.Id ?? payment?.PaymentId ?? null
      const totalFromLines = Array.isArray(payment?.Lines)
        ? payment.Lines.reduce((sum: number, line: any) => sum + Number(line?.Amount ?? 0), 0)
        : 0
      const headerDate = normalizeDate(payment?.EntryDate ?? payment?.Date ?? null)
      const paymentMethod = mapPaymentMethod(payment?.PaymentMethod) || (payment?.CheckNumber ? 'Check' : null)

      // Resolve local bank account + GL
      const bankAccountLocalId = await resolveBankAccountId(payment?.BankAccountId ?? null, admin)
      let bankGlAccountId: string | null = null
      if (bankAccountLocalId) {
        const { data: bank } = await admin.from('bank_accounts').select('gl_account').eq('id', bankAccountLocalId).maybeSingle()
        if (bank?.gl_account) bankGlAccountId = bank.gl_account
      }
      if (!bankGlAccountId) {
        throw new Error(`Missing bank GL account for bill payment ${paymentId ?? ''}`)
      }

      // Pick vendor/category from existing bill transaction if present
      const { data: billTxMeta } = await admin
        .from('transactions')
        .select('vendor_id, category_id, org_id')
        .eq('buildium_bill_id', billId)
        .maybeSingle()

      // Find existing payment transaction by buildium_transaction_id
      let existing: { id: string; created_at: string } | null = null
      if (paymentId != null) {
        const { data, error } = await admin
          .from('transactions')
          .select('id, created_at')
          .eq('buildium_transaction_id', paymentId)
          .maybeSingle()
        if (error && error.code !== 'PGRST116') throw error
        existing = data ?? null
      }

      const totalAmount = totalFromLines || Number(payment?.Amount ?? 0) || debitSum || creditSum || 0

      const header = {
        buildium_transaction_id: paymentId,
        buildium_bill_id: billId,
        date: headerDate ?? new Date().toISOString().slice(0, 10),
        paid_date: headerDate,
        total_amount: totalAmount,
        check_number: payment?.CheckNumber ?? null,
        reference_number: payment?.Memo ?? payment?.ReferenceNumber ?? null,
        memo: payment?.Memo ?? null,
        transaction_type: 'Payment',
        status: 'Paid',
        bank_account_id: bankAccountLocalId,
        vendor_id: billTxMeta?.vendor_id ?? null,
        category_id: billTxMeta?.category_id ?? null,
        org_id: billTxMeta?.org_id ?? null,
        payment_method: paymentMethod,
        updated_at: now,
      }

      let transactionId: string
      if (existing) {
        const { data, error } = await admin
          .from('transactions')
          .update(header)
          .eq('id', existing.id)
          .select('id')
          .single()
        if (error) throw error
        transactionId = data.id
      } else {
        const { data, error } = await admin
          .from('transactions')
          .insert({ ...header, created_at: now })
          .select('id')
          .single()
        if (error) throw error
        transactionId = data.id
      }

      // Build lines from payment lines (debits), plus balancing credit to bank
      const pendingLines: any[] = []
      let debitSum = 0
      let creditSum = 0
      const paymentLines = Array.isArray(payment?.Lines) ? payment.Lines : []
      for (const line of paymentLines) {
        const glBuildiumId = line?.GLAccountId ?? line?.GLAccount?.Id ?? null
        const glId = await ensureGLAccountId(glBuildiumId, fetchGL)
        if (!glId) throw new Error(`GL account not found for bill payment line. BuildiumId=${glBuildiumId}`)
        const buildiumPropertyId = line?.AccountingEntity?.Id ?? null
        const buildiumUnitId = line?.AccountingEntity?.UnitId ?? line?.AccountingEntity?.Unit?.Id ?? null
        const propertyIdLocal = await resolveLocalPropertyId(buildiumPropertyId)
        const unitIdLocal = await resolveLocalUnitId(buildiumUnitId)
        const entityTypeRaw = line?.AccountingEntity?.AccountingEntityType || 'Rental'
        const entityType: 'Rental' | 'Company' = String(entityTypeRaw).toLowerCase() === 'rental' ? 'Rental' : 'Company'
        const amount = Math.abs(Number(line?.Amount ?? 0))
        debitSum += amount
        pendingLines.push({
          transaction_id: transactionId,
          gl_account_id: glId,
          amount,
          posting_type: 'Debit',
          memo: line?.Memo ?? null,
          account_entity_type: entityType,
          account_entity_id: buildiumPropertyId,
          date: header.date,
          created_at: now,
          updated_at: now,
          buildium_property_id: buildiumPropertyId,
          buildium_unit_id: buildiumUnitId,
          buildium_lease_id: null,
          property_id: propertyIdLocal,
          unit_id: unitIdLocal,
        })
      }

      if (totalAmount > 0) {
        creditSum += totalAmount
        // Use property/unit from first debit line for context if present
        const sample = pendingLines[0] ?? {}
        pendingLines.push({
          transaction_id: transactionId,
          gl_account_id: bankGlAccountId,
          amount: totalAmount,
          posting_type: 'Credit',
          memo: payment?.Memo ?? null,
          account_entity_type: sample?.account_entity_type ?? 'Company',
          account_entity_id: sample?.account_entity_id ?? null,
          date: header.date,
          created_at: now,
          updated_at: now,
          buildium_property_id: sample?.buildium_property_id ?? null,
          buildium_unit_id: sample?.buildium_unit_id ?? null,
          buildium_lease_id: null,
          property_id: sample?.property_id ?? null,
          unit_id: sample?.unit_id ?? null,
        })
      }

      // Replace existing lines
      await admin.from('transaction_lines').delete().eq('transaction_id', transactionId)
      if (pendingLines.length) {
        await admin.from('transaction_lines').insert(pendingLines)
      }
      if (debitSum > 0 && creditSum > 0 && Math.abs(debitSum - creditSum) > 0.0001) {
        throw new Error(`Double-entry integrity violation on bill payment ${paymentId}: debits (${debitSum}) != credits (${creditSum})`)
      }
      return { transactionId }
    }

    for (const event of events) {
      // Buildium event types can be EventType or EventName
      const type = event?.EventType ?? event?.EventName ?? body?.type ?? body?.eventType ?? body?.EventName ?? 'unknown'
      // Buildium event IDs can be in different fields
      const rawEventId =
        event?.Id ??
        event?.EventId ??
        event?.eventId ??
        event?.id ??
        event?.TransactionId ??
        event?.LeaseId ??
        event?.BillId ??
        event?.PaymentId ??
        event?.Data?.BillId ??
        event?.Data?.PaymentId ??
        null
      // For certain events, append timestamp/property info to avoid false duplicates.
      const eventId = (() => {
        const evtTime = event?.EventDateTime ?? event?.eventDateTime ?? null
        if (type && typeof type === 'string' && type.toLowerCase().includes('bill') && event?.BillId && evtTime) {
          return `${event.BillId}-${evtTime}`
        }
        if (type && typeof type === 'string' && type.toLowerCase().includes('rental') && event?.PropertyId && evtTime) {
          return `${event.PropertyId}-${evtTime}`
        }
        if (type && typeof type === 'string' && type.toLowerCase().includes('rentalunit') && event?.UnitId && evtTime) {
          return `${event.UnitId}-${evtTime}`
        }
        return rawEventId || null
      })()

      // Idempotent ingest per event
      if (eventId != null) {
        const { data: existing } = await admin
          .from('buildium_webhook_events')
          .select('id')
          .eq('event_id', eventId)
          .maybeSingle()
        if (existing?.id) {
          results.push({ eventId, status: 'duplicate' })
          continue
        }
      }

      await admin.from('buildium_webhook_events').insert({
        event_id: eventId,
        event_type: type,
        signature: signatureHeader,
        payload: event,
        status: 'received',
      })

      // Check toggle flag; if disabled, mark ignored and skip
      if (typeof type === 'string' && disabledEvents.has(type)) {
        await admin
          .from('buildium_webhook_events')
          .update({ status: 'ignored', processed_at: new Date().toISOString() })
          .eq('event_id', eventId)
        results.push({ eventId, status: 'processed' })
        continue
      }

      // Process lease transactions locally to ensure persistence even if edge function or Buildium IP restrictions fail
      if (typeof type === 'string' && type.includes('LeaseTransaction')) {
        const leaseId = event?.LeaseId ?? event?.Data?.LeaseId
        const transactionId = event?.TransactionId ?? event?.Data?.TransactionId ?? eventId

        // Handle deletion locally
        if (type.includes('Deleted')) {
          if (transactionId) {
            const { data: existing } = await admin.from('transactions').select('id').eq('buildium_transaction_id', transactionId).maybeSingle()
            if (existing?.id) {
              await admin.from('transaction_lines').delete().eq('transaction_id', existing.id)
              await admin.from('transactions').delete().eq('id', existing.id)
              console.log('[buildium-webhook] Lease transaction deleted locally', existing.id)
            } else {
              console.log('[buildium-webhook] Lease transaction delete received but not found locally', transactionId)
            }
          }
        } else if (leaseId && transactionId) {
          // Upsert (create/update)
          const tx = await (async () => {
            try { return await fetchLeaseTransaction(Number(leaseId), Number(transactionId)) } catch { return null }
          })()
          if (tx) {
            try {
              const glFetcher = async (glId: number) => fetchGLAccount(glId)
              await upsertLeaseTransactionWithLinesLocal(tx, glFetcher)
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert lease transaction locally', err)
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch lease transaction for local upsert', { leaseId, transactionId })
          }
        }
      }

      // Process lease updates/creates/deletes (non-transaction)
      if (typeof type === 'string' && type.includes('Lease') && !type.includes('LeaseTransaction') && !type.includes('LeaseTenant') && !type.includes('MoveOut')) {
        const leaseId = event?.LeaseId ?? event?.Data?.LeaseId ?? event?.EntityId ?? null
        if (leaseId) {
          if (type.includes('Deleted')) {
            try {
              await deleteLeaseLocal(Number(leaseId))
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete lease locally', err)
            }
          } else {
            // Fetch lease from Buildium
            const leaseRemote = await fetchLease(Number(leaseId))
            if (!leaseRemote) {
              console.warn('[buildium-webhook] Could not fetch lease for update', { leaseId })
            } else {
              // Upsert lease + parties locally
              try {
                await upsertLeaseWithPartiesLocal(leaseRemote)
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert lease locally', err)
              }

              // Build current person set from payload (Tenants + Cosigners + CurrentTenants)
              const currentIds = new Set<number>()
              const addId = (v: any) => { if (v != null && Number.isFinite(Number(v))) currentIds.add(Number(v)) }
              if (Array.isArray(leaseRemote?.Tenants)) leaseRemote.Tenants.forEach((t: any) => addId(t?.Id))
              if (Array.isArray(leaseRemote?.Cosigners)) leaseRemote.Cosigners.forEach((c: any) => addId(c?.Id))
              if (Array.isArray(leaseRemote?.CurrentTenants)) leaseRemote.CurrentTenants.forEach((t: any) => addId(t?.Id))

              try {
                await updateLeaseContactStatuses(Number(leaseId), currentIds)
              } catch (err) {
                console.error('[buildium-webhook] Failed to update lease contact statuses', err)
              }
            }
          }
        }
      }

      // Process lease tenant updates/deletes
      if (typeof type === 'string' && type.includes('LeaseTenant')) {
        const tenantIdBuildium = event?.TenantId ?? event?.Data?.TenantId ?? event?.EntityId ?? null
        if (tenantIdBuildium) {
          if (type.includes('Deleted')) {
            try {
              await deleteTenantLocal(Number(tenantIdBuildium))
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete tenant locally', err)
            }
          } else {
            // For MoveOut events we only need to update lease_contact dates; otherwise do full upsert.
            if (type.includes('MoveOut')) {
              const leaseId = event?.LeaseId ?? event?.Data?.LeaseId ?? null
              if (leaseId) {
                const moveOut = await fetchLeaseMoveOut(Number(leaseId), Number(tenantIdBuildium))
                if (moveOut) {
                  const leaseLocalId = await resolveLocalLeaseId(leaseId)
                  const tenantLocalId = await (async () => {
                    const { data } = await admin.from('tenants').select('id').eq('buildium_tenant_id', Number(tenantIdBuildium)).maybeSingle()
                    return data?.id ?? null
                  })()
                  if (leaseLocalId && tenantLocalId) {
                    await admin.from('lease_contacts').update({
                      move_out_date: moveOut?.MoveOutDate ? normalizeDate(moveOut.MoveOutDate) : null,
                      notice_given_date: moveOut?.NoticeGivenDate ? normalizeDate(moveOut.NoticeGivenDate) : null,
                      updated_at: new Date().toISOString(),
                    }).eq('lease_id', leaseLocalId).eq('tenant_id', tenantLocalId)
                  } else {
                    console.warn('[buildium-webhook] MoveOut could not resolve lease/tenant locally', { leaseId, tenantIdBuildium })
                  }
                }
              }
              continue
            }
            const tenantData = await fetchLeaseTenant(Number(tenantIdBuildium))
            if (!tenantData) {
              console.warn('[buildium-webhook] Could not fetch lease tenant', { tenantIdBuildium })
            } else {
              // Core contact/tenant updates
              const orgIdFromPayload = Array.isArray(tenantData?.Leases) && tenantData.Leases.length
                ? await resolveLeaseOrgId(tenantData.Leases[0]?.Id, tenantData.Leases[0]?.PropertyId)
                : null
              // If tenant already exists, prefer its contact_id (contact lookup uses that FK)
              let preferredContactId: number | null = null
            let tenantIdLocal: string | null = null
            {
              const { data: existingTenant } = await admin.from('tenants').select('id, contact_id').eq('buildium_tenant_id', Number(tenantIdBuildium)).maybeSingle()
              if (existingTenant?.id) {
                tenantIdLocal = existingTenant.id
                preferredContactId = existingTenant.contact_id ?? null
              }
            }

              const contactId = await findOrCreateContactForLeasePerson(tenantData, orgIdFromPayload, preferredContactId)
              const now = new Date().toISOString()
              // Update contact with richer fields
              const primaryPhone = Array.isArray(tenantData?.PhoneNumbers)
                ? (tenantData.PhoneNumbers.find((p: any) => /cell|mobile/i.test(p?.Type))?.Number ||
                  tenantData.PhoneNumbers.find((p: any) => /home/i.test(p?.Type))?.Number ||
                  tenantData.PhoneNumbers.find((p: any) => /work/i.test(p?.Type))?.Number ||
                  null)
                : (tenantData?.PhoneNumbers?.Mobile || tenantData?.PhoneNumbers?.Home || tenantData?.PhoneNumbers?.Work || null)
              const altPhone = Array.isArray(tenantData?.PhoneNumbers)
                ? (tenantData.PhoneNumbers.find((p: any) => /work/i.test(p?.Type))?.Number ||
                  tenantData.PhoneNumbers.find((p: any) => /home/i.test(p?.Type))?.Number ||
                  null)
                : (tenantData?.PhoneNumbers?.Work || tenantData?.PhoneNumbers?.Home || null)
              const addr = tenantData?.Address || tenantData?.PrimaryAddress || {}
              const altAddr = tenantData?.AlternateAddress || {}
              await admin.from('contacts').update({
                first_name: tenantData?.FirstName ?? null,
                last_name: tenantData?.LastName ?? null,
                primary_email: tenantData?.Email ?? null,
                alt_email: tenantData?.AlternateEmail ?? null,
                primary_phone: primaryPhone,
                alt_phone: altPhone,
                date_of_birth: tenantData?.DateOfBirth ?? null,
                primary_address_line_1: addr?.AddressLine1 ?? null,
                primary_address_line_2: addr?.AddressLine2 ?? null,
                primary_address_line_3: addr?.AddressLine3 ?? null,
                primary_city: addr?.City ?? null,
                primary_state: addr?.State ?? null,
                primary_postal_code: addr?.PostalCode ?? null,
                primary_country: mapCountryFromBuildiumLocal(addr?.Country),
                alt_address_line_1: altAddr?.AddressLine1 ?? null,
                alt_address_line_2: altAddr?.AddressLine2 ?? null,
                alt_address_line_3: altAddr?.AddressLine3 ?? null,
                alt_city: altAddr?.City ?? null,
                alt_state: altAddr?.State ?? null,
                alt_postal_code: altAddr?.PostalCode ?? null,
                alt_country: mapCountryFromBuildiumLocal(altAddr?.Country),
                mailing_preference: tenantData?.MailingPreference === 'PrimaryAddress' ? 'primary' : (tenantData?.MailingPreference === 'AlternateAddress' ? 'alternate' : null),
                display_name: [tenantData?.FirstName, tenantData?.LastName].filter(Boolean).join(' ') || tenantData?.Email || 'Tenant',
                updated_at: now
              }).eq('id', contactId)

              tenantIdLocal = tenantIdLocal || await findOrCreateTenantFromContact(contactId, tenantData, orgIdFromPayload)
              // Update tenant fields (SMSOptInStatus, emergency, tax_id)
              await admin.from('tenants').update({
                sms_opt_in_status: typeof tenantData?.SMSOptInStatus === 'boolean' ? String(tenantData.SMSOptInStatus) : (typeof tenantData?.SMSOptInStatus === 'string' ? tenantData.SMSOptInStatus : null),
                emergency_contact_name: tenantData?.EmergencyContact?.Name ?? null,
                emergency_contact_relationship: tenantData?.EmergencyContact?.RelationshipDescription ?? null,
                emergency_contact_phone: tenantData?.EmergencyContact?.Phone ?? null,
                emergency_contact_email: tenantData?.EmergencyContact?.Email ?? null,
                tax_id: tenantData?.TaxId ?? null,
                updated_at: now
              }).eq('id', tenantIdLocal)

              const linkedLeaseIds = new Set<string>()
              for (const lease of Array.isArray(tenantData?.Leases) ? tenantData.Leases : []) {
                const leaseLocalId = await resolveLocalLeaseId(lease?.Id)
                if (!leaseLocalId) continue
                linkedLeaseIds.add(String(leaseLocalId))
                const moveInEntry = (Array.isArray(lease?.Tenants) ? lease.Tenants : []).find((t: any) => Number(t?.Id) === Number(tenantIdBuildium))
                const moveOutEntry = (Array.isArray(lease?.MoveOutData) ? lease.MoveOutData : []).find((m: any) => Number(m?.TenantId) === Number(tenantIdBuildium))
                const moveInDate = moveInEntry?.MoveInDate || null
                const moveOutDate = moveOutEntry?.MoveOutDate || null
                const noticeDate = moveOutEntry?.NoticeGivenDate || null
                const orgId = await resolveLeaseOrgId(lease?.Id, lease?.PropertyId)
                await ensureLeaseContactLocal(leaseLocalId, tenantIdLocal, 'Tenant', orgId)
                await admin.from('lease_contacts').update({
                  move_in_date: moveInDate ? normalizeDate(moveInDate) : null,
                  move_out_date: moveOutDate ? normalizeDate(moveOutDate) : null,
                  notice_given_date: noticeDate ? normalizeDate(noticeDate) : null,
                  updated_at: now
                }).eq('lease_id', leaseLocalId).eq('tenant_id', tenantIdLocal)
              }

              // Deactivate any existing lease_contact for this tenant not in current leases
              const { data: existingLinks } = await admin.from('lease_contacts').select('id, lease_id, status').eq('tenant_id', tenantIdLocal)
              if (existingLinks && existingLinks.length) {
                const toDeactivate = existingLinks.filter((l: any) => !linkedLeaseIds.has(String(l.lease_id)) && l.status !== 'Inactive').map((l: any) => l.id)
                if (toDeactivate.length) {
                  await admin.from('lease_contacts').update({ status: 'Inactive', updated_at: new Date().toISOString() }).in('id', toDeactivate)
                }
              }
            }
          }
        }
      }

      // Process lease move outs (payload includes LeaseId and TenantId)
      if (typeof type === 'string' && type.includes('MoveOut')) {
        const leaseId = event?.LeaseId ?? event?.Data?.LeaseId ?? null
        const tenantIdBuildium = event?.TenantId ?? event?.Data?.TenantId ?? null
        if (leaseId && tenantIdBuildium) {
          const moveOut = await fetchLeaseMoveOut(Number(leaseId), Number(tenantIdBuildium))
          if (moveOut) {
            const leaseLocalId = await resolveLocalLeaseId(leaseId)
            const tenantLocalId = await (async () => {
              const { data } = await admin.from('tenants').select('id').eq('buildium_tenant_id', Number(tenantIdBuildium)).maybeSingle()
              return data?.id ?? null
            })()
            if (leaseLocalId && tenantLocalId) {
              await admin.from('lease_contacts').update({
                move_out_date: moveOut?.MoveOutDate ? normalizeDate(moveOut.MoveOutDate) : null,
                notice_given_date: moveOut?.NoticeGivenDate ? normalizeDate(moveOut.NoticeGivenDate) : null,
                updated_at: new Date().toISOString(),
              }).eq('lease_id', leaseLocalId).eq('tenant_id', tenantLocalId)
            } else {
              console.warn('[buildium-webhook] MoveOut could not resolve lease/tenant locally', { leaseId, tenantIdBuildium })
            }
          }
        }
      }

      // Process bill create/update events
      if (typeof type === 'string' && type.toLowerCase().includes('bill.payment')) {
        const billIds = Array.isArray(event?.BillIds) ? event.BillIds : Array.isArray(event?.Data?.BillIds) ? event.Data.BillIds : []
        const paymentId = event?.PaymentId ?? event?.Data?.PaymentId ?? event?.Id ?? null
        if (!paymentId || !billIds.length) {
          console.warn('[buildium-webhook] Bill.Payment event missing paymentId or billIds', { eventSnippet: JSON.stringify(event).slice(0, 200) })
        } else {
          for (const billId of billIds) {
            if (!billId) continue
            if (type.toLowerCase().includes('deleted')) {
              try {
                await deleteBillPaymentLocal(Number(paymentId), Number(billId))
              } catch (err) {
                console.error('[buildium-webhook] Failed to delete bill payment locally', err)
              }
            } else {
              const payment = await fetchBillPayment(Number(billId), Number(paymentId))
              if (payment) {
                try {
                  const glFetcher = async (glId: number) => fetchGLAccount(glId)
                  await upsertBillPaymentWithLines(payment, Number(billId), glFetcher)
                } catch (err) {
                  console.error('[buildium-webhook] Failed to upsert bill payment locally', err)
                }
              } else {
                console.warn('[buildium-webhook] Could not fetch bill payment', { billId, paymentId })
              }
            }
          }
        }
      } else if (typeof type === 'string' && type.includes('Bill')) {
        const billId = event?.BillId ?? event?.Data?.BillId ?? event?.EntityId ?? null
        if (billId) {
          if (type.includes('Deleted')) {
            try {
              await deleteBillLocal(Number(billId))
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete bill locally', err)
            }
          } else {
            const bill = await fetchBill(Number(billId))
            if (bill) {
              try {
                await upsertBillWithLines(bill, admin)
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert bill locally', err)
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch bill for event', { billId, type })
            }
          }
        } else {
          console.warn('[buildium-webhook] Bill event missing BillId', { eventSnippet: JSON.stringify(event).slice(0, 200) })
        }
      } else if (typeof type === 'string' && type.includes('GLAccount')) {
        const glAccountId = event?.GLAccountId ?? event?.Data?.GLAccountId ?? event?.EntityId ?? null
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null
        if (glAccountId) {
          if (type.includes('Deleted')) {
            try {
              await deleteGLAccountLocal(Number(glAccountId))
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete GL account locally', err)
            }
          } else {
            const gl = await fetchGLAccountRemote(Number(glAccountId))
            if (gl) {
              try {
                await upsertGLAccountWithOrg(gl, buildiumAccountId)
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert GL account locally', err)
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch GL account for event', { glAccountId, type })
            }
          }
        } else {
          console.warn('[buildium-webhook] GLAccount event missing GLAccountId', { eventSnippet: JSON.stringify(event).slice(0, 200) })
        }
      } else if (typeof type === 'string' && type.includes('Rental')) {
        const propertyId = event?.PropertyId ?? event?.Data?.PropertyId ?? event?.EntityId ?? null
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null
        if (propertyId) {
          const rental = await fetchRentalProperty(Number(propertyId))
          if (rental) {
            try {
              const propertyLocalId = await upsertPropertyFromBuildium(rental, buildiumAccountId)
              try {
                const rentalManagerId = rental?.RentalManager?.Id ?? rental?.RentalManagerId ?? null
                await updatePropertyManager(Number(propertyId), rentalManagerId)
              } catch (err) {
                console.warn('[buildium-webhook] Rental manager update skipped', err)
              }
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert rental property locally', err)
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch rental for event', { propertyId, type })
          }
        } else {
          console.warn('[buildium-webhook] Rental event missing PropertyId', { eventSnippet: JSON.stringify(event).slice(0, 200) })
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('rentalunit')) {
        const unitId = event?.UnitId ?? event?.Data?.UnitId ?? event?.EntityId ?? null
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null
        if (unitId) {
          const unit = await fetchRentalUnit(Number(unitId))
          if (unit) {
            try {
              await upsertUnitFromBuildium(unit, buildiumAccountId)
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert rental unit locally', err)
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch rental unit for event', { unitId, type })
          }
        } else {
          console.warn('[buildium-webhook] RentalUnit event missing UnitId', { eventSnippet: JSON.stringify(event).slice(0, 200) })
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('taskcategory')) {
        const categoryId = event?.TaskCategoryId ?? event?.Data?.TaskCategoryId ?? event?.EntityId ?? null
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null
        if (categoryId) {
          if (type.toLowerCase().includes('deleted')) {
            try {
              await admin.from('task_categories').delete().eq('buildium_category_id', Number(categoryId))
            } catch (err) {
              console.error('[buildium-webhook] Failed to delete task category locally', err)
            }
          } else {
            const cat = await fetchTaskCategory(Number(categoryId))
            if (cat) {
              try {
                await upsertTaskCategory(cat, buildiumAccountId)
              } catch (err) {
                console.error('[buildium-webhook] Failed to upsert task category locally', err)
              }
            } else {
              console.warn('[buildium-webhook] Could not fetch task category for event', { categoryId, type })
            }
          }
        } else {
          console.warn('[buildium-webhook] TaskCategory event missing TaskCategoryId', { eventSnippet: JSON.stringify(event).slice(0, 200) })
        }
      } else if (typeof type === 'string' && type.toLowerCase().includes('task')) {
        const taskId = event?.TaskId ?? event?.Data?.TaskId ?? event?.EntityId ?? null
        const taskType = event?.TaskType ?? event?.Data?.TaskType ?? null
        const buildiumAccountId = event?.AccountId ?? event?.Data?.AccountId ?? null
        // Only handle Todo tasks for now
        const taskTypeNormalized = typeof taskType === 'string' ? taskType.toLowerCase() : ''
        if (taskTypeNormalized && taskTypeNormalized !== 'todo') {
          results.push({ eventId, status: 'processed' })
          continue
        }
        if (taskId) {
          const task = await fetchTask(Number(taskId))
          if (task) {
            try {
              await upsertTaskFromBuildium(task, buildiumAccountId)
            } catch (err) {
              console.error('[buildium-webhook] Failed to upsert task locally', err)
            }
          } else {
            console.warn('[buildium-webhook] Could not fetch task for event', { taskId, taskType, type })
          }
        } else {
          console.warn('[buildium-webhook] Task event missing TaskId', { eventSnippet: JSON.stringify(event).slice(0, 200) })
        }
      }

      // Placeholder for downstream processing; currently mark as processed
      await admin
        .from('buildium_webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('event_id', eventId)

      results.push({ eventId, status: 'processed' })
    }

    // Dispatch lease transaction events downstream
    const leaseTxEvents = events.filter((ev) => {
      const type = ev?.EventType || ev?.EventName || ''
      return typeof type === 'string' && type.includes('LeaseTransaction')
    })
    await forwardLeaseTransactionEvents(leaseTxEvents)

    const processed = results.filter((r) => r.status === 'processed').length
    const duplicates = results.filter((r) => r.status === 'duplicate').length
    const errors = results.filter((r) => r.status === 'error')

    return NextResponse.json({
      ok: true,
      received: events.length,
      processed,
      duplicates,
      errors,
    })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error'
    console.error('[buildium-webhook] Unhandled error', e)
    const idsForError = events
      .map((ev) => ev?.Id ?? ev?.EventId ?? ev?.eventId ?? ev?.id ?? null)
      .filter((v) => v != null)
    if (idsForError.length > 0) {
      await admin
        .from('buildium_webhook_events')
        .update({ status: 'error', error: errorMessage, processed_at: new Date().toISOString() })
        .in('event_id', idsForError)
    }
    return NextResponse.json({ error: 'Internal error', detail: errorMessage }, { status: 500 })
  }
}
  // Load webhook toggle flags once
  let disabledEvents = new Set<string>()
  try {
    const { data, error } = await admin
      .from('webhook_event_flags')
      .select('event_type, enabled')
    if (!error && Array.isArray(data)) {
      data.forEach((row: any) => {
        if (row?.enabled === false && typeof row?.event_type === 'string') {
          disabledEvents.add(row.event_type)
        }
      })
    } else if (error) {
      const msg = error?.message || ''
      if (msg.includes('webhook_event_flags') || msg.toLowerCase().includes('schema')) {
        // Gracefully skip toggles if table/cache missing
        console.warn('[buildium-webhook] webhook_event_flags table missing; proceeding with all enabled')
      } else {
        console.warn('[buildium-webhook] Could not load webhook toggles; proceeding as enabled', error)
      }
    }
  } catch (err) {
    console.warn('[buildium-webhook] Could not load webhook toggles; proceeding as enabled', err)
  }
