import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireUser } from '@/lib/auth'
import { createBuildiumClient, defaultBuildiumConfig } from '@/lib/buildium-client'
import { logger } from '@/lib/logger'
import type { TypedSupabaseClient } from '@/lib/db'

type BuildiumBillFile = { Id?: number; Href?: string | null } & Record<string, unknown>
type BillFileSyncResult = {
  buildiumFile: BuildiumBillFile | null
  updatedFile?: Record<string, unknown>
  error?: string
}

type EntityType = 'property' | 'unit' | 'lease' | 'tenant' | 'owner' | 'vendor' | 'task' | 'task_history' | 'work_order' | 'bill' | 'contact'

async function resolveOrgForEntity(
  client: TypedSupabaseClient,
  entityType: EntityType,
  entityId: string | number
): Promise<string | null> {
  switch (entityType) {
    case 'property': {
      const { data } = await client.from('properties').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'unit': {
      const { data } = await client
        .from('units')
        .select('property_id')
        .eq('id', entityId)
        .maybeSingle()
      if (!data?.property_id) return null
      const { data: p } = await client.from('properties').select('org_id').eq('id', data.property_id).maybeSingle()
      return p?.org_id ?? null
    }
    case 'lease': {
      const { data } = await client.from('lease').select('org_id, property_id').eq('id', entityId).maybeSingle()
      if (data?.org_id) return data.org_id
      if (!data?.property_id) return null
      const { data: p } = await client.from('properties').select('org_id').eq('id', data.property_id).maybeSingle()
      return p?.org_id ?? null
    }
    case 'tenant': {
      const { data } = await client.from('tenants').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'owner': {
      const { data } = await client.from('owners').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'vendor': {
      // Vendors do not currently store org_id directly; rely on linked contacts/properties elsewhere.
      return null
    }
    case 'work_order': {
      const { data } = await client.from('work_orders').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'task': {
      const { data } = await client.from('tasks').select('property_id').eq('id', entityId).maybeSingle()
      if (!data?.property_id) return null
      const { data: p } = await client.from('properties').select('org_id').eq('id', data.property_id).maybeSingle()
      return p?.org_id ?? null
    }
    case 'task_history': {
      const { data } = await client.from('task_history').select('task_id').eq('id', entityId).maybeSingle()
      if (!data?.task_id) return null
      const { data: t } = await client.from('tasks').select('property_id').eq('id', data.task_id).maybeSingle()
      if (!t?.property_id) return null
      const { data: p } = await client.from('properties').select('org_id').eq('id', t.property_id).maybeSingle()
      return p?.org_id ?? null
    }
    case 'bill': {
      const { data: txn } = await client
        .from('transactions')
        .select('org_id, vendor_id, lease_id')
        .eq('id', entityId)
        .maybeSingle()
      if (txn?.org_id) return txn.org_id

      if (txn?.lease_id) {
        const { data: lease } = await client
          .from('lease')
          .select('org_id, property_id')
          .eq('id', txn.lease_id)
          .maybeSingle()
        if (lease?.org_id) return lease.org_id
        if (lease?.property_id) {
          const { data: property } = await client
            .from('properties')
            .select('org_id')
            .eq('id', lease.property_id)
            .maybeSingle()
          if (property?.org_id) return property.org_id
        }
      }

      const { data: txnLine } = await client
        .from('transaction_lines')
        .select('property_id')
        .eq('transaction_id', entityId)
        .not('property_id', 'is', null)
        .limit(1)
        .maybeSingle()

      if (txnLine?.property_id) {
        const { data: property } = await client
          .from('properties')
          .select('org_id')
          .eq('id', txnLine.property_id)
          .maybeSingle()
        if (property?.org_id) return property.org_id
      }

      return null
    }
    case 'contact': {
      const { data } = await client.from('contacts').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    default:
      return null
  }
}

async function maybeUploadBillFileToBuildium(options: {
  admin: TypedSupabaseClient
  transactionId: string | number
  fileId: string
  fileName: string
  mimeType?: string
  base64: string
}): Promise<BillFileSyncResult | null> {
  const { admin, transactionId, fileId, fileName, mimeType, base64 } = options

  if (!process.env.BUILDIUM_CLIENT_ID || !process.env.BUILDIUM_CLIENT_SECRET) {
    logger.warn('Buildium credentials missing; skipping bill file sync')
    return null
  }

  try {
    const { data: transactionRow, error: txnErr } = await admin
      .from('transactions')
      .select('buildium_bill_id')
      .eq('id', transactionId)
      .maybeSingle()

    if (txnErr) throw txnErr
    const buildiumBillIdRaw = transactionRow?.buildium_bill_id
    const buildiumBillId = typeof buildiumBillIdRaw === 'number' ? buildiumBillIdRaw : Number(buildiumBillIdRaw)
    if (!Number.isFinite(buildiumBillId)) {
      return null
    }

    const { data: lineRow, error: lineErr } = await admin
      .from('transaction_lines')
      .select('buildium_unit_id, buildium_property_id')
      .eq('transaction_id', transactionId)
      .not('buildium_unit_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (lineErr) throw lineErr
    const buildiumUnitIdRaw = lineRow?.buildium_unit_id
    const buildiumUnitId = typeof buildiumUnitIdRaw === 'number' ? buildiumUnitIdRaw : Number(buildiumUnitIdRaw)
    if (!Number.isFinite(buildiumUnitId) || buildiumUnitId <= 0) {
      return null
    }

    const buildiumPropertyIdRaw = lineRow?.buildium_property_id
    const buildiumPropertyId = typeof buildiumPropertyIdRaw === 'number' ? buildiumPropertyIdRaw : Number(buildiumPropertyIdRaw)

    const buildiumClient = createBuildiumClient(defaultBuildiumConfig)

    const existingFiles: BuildiumBillFile[] = await buildiumClient
      .getBillFiles(buildiumBillId)
      .catch(() => [])
    const existingIds = new Set<number>()
    for (const file of Array.isArray(existingFiles) ? existingFiles : []) {
      const id = typeof file?.Id === 'number' ? file.Id : Number(file?.Id)
      if (Number.isFinite(id)) existingIds.add(Number(id))
    }

    const uploadRequestBody: Record<string, unknown> = {
      FileName: fileName,
      ContentType: mimeType || 'application/octet-stream',
      UnitId: buildiumUnitId,
      Description: '',
      IsPrivate: true,
      FileTitle: fileName
    }

    if (Number.isFinite(buildiumPropertyId) && buildiumPropertyId > 0) {
      uploadRequestBody.PropertyId = buildiumPropertyId
    }

    const ticket = await buildiumClient.createBillFileUploadRequest(buildiumBillId, uploadRequestBody)
    const bucketUrl: string | undefined = ticket?.BucketUrl
    const ticketForm: Record<string, string> | undefined = ticket?.FormData
    if (!bucketUrl || !ticketForm) {
      throw new Error('Buildium upload ticket missing bucket information')
    }

    const binary = Buffer.from(base64, 'base64')
    const formData = new FormData()
    for (const [key, value] of Object.entries(ticketForm)) {
      if (value != null) formData.append(key, value)
    }
    formData.append('file', new Blob([binary], { type: mimeType || 'application/octet-stream' }), fileName)

    const uploadResponse = await fetch(bucketUrl, {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => '')
      throw new Error(`Buildium binary upload failed: ${uploadResponse.status} ${errorText}`)
    }

    const locateUploadedFile = async (): Promise<BuildiumBillFile | null> => {
      const attempts = 8
      for (let attempt = 0; attempt < attempts; attempt++) {
        const list: BuildiumBillFile[] = await buildiumClient
          .getBillFiles(buildiumBillId)
          .catch(() => [])
        for (const entry of Array.isArray(list) ? list : []) {
          const fileIdNumber = typeof entry?.Id === 'number' ? entry.Id : Number(entry?.Id)
          if (Number.isFinite(fileIdNumber) && !existingIds.has(Number(fileIdNumber))) {
            return entry
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      }
      return null
    }

    const buildiumFile = await locateUploadedFile()

    if (!buildiumFile) {
      logger.warn({ billId: buildiumBillId, fileId }, 'Uploaded file to Buildium storage but could not confirm presence via API')
      return { buildiumFile: null, error: 'File uploaded but Buildium did not return a file id yet' }
    }

    const updates: Record<string, unknown> = {
      buildium_file_id: typeof buildiumFile?.Id === 'number' ? buildiumFile.Id : null,
      buildium_entity_type: 'Bill',
      buildium_entity_id: buildiumBillId,
      buildium_href: typeof buildiumFile?.Href === 'string' ? buildiumFile.Href : null
    }

    await admin.from('files').update(updates).eq('id', fileId)
    const { data: updatedFile } = await admin.from('files').select('*').eq('id', fileId).maybeSingle()

    logger.info({
      billId: buildiumBillId,
      fileId,
      buildiumFileId: updates.buildium_file_id ?? null
    }, 'Uploaded bill file to Buildium')

    return { buildiumFile, updatedFile }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ error: message, transactionId, fileId }, 'Failed to upload bill file to Buildium')
    return { buildiumFile: null, error: message }
  }
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseAdmin()) return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
  const admin = requireSupabaseAdmin('files upload')
  const user = await requireUser()

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const { entityType, entityId, fileName, mimeType, base64, category, role, isPrivate } = body as {
    entityType: EntityType
    entityId: string | number
    fileName: string
    mimeType?: string
    base64: string
    category?: string | null
    role?: string | null
    isPrivate?: boolean
  }
  if (!entityType || !entityId || !fileName || !base64) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const orgId = await resolveOrgForEntity(admin, entityType, entityId)
  if (!orgId) return NextResponse.json({ error: 'Unable to resolve org for entity' }, { status: 400 })

  // Choose bucket
  const bucket = entityType === 'lease' ? 'lease-documents' : 'files'
  // Ensure bucket exists (best-effort)
  try {
    const { data: bInfo } = await admin.storage.getBucket(bucket)
    if (!bInfo) {
      await admin.storage.createBucket(bucket, { public: false })
    }
  } catch {}

  const storageKey = `${entityType}/${entityId}/${Date.now()}-${fileName}`
  let bytes: Uint8Array
  let normalizedBase64 = ''
  try {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64
    normalizedBase64 = raw
    bytes = Buffer.from(raw, 'base64')
  } catch {
    return NextResponse.json({ error: 'Invalid base64' }, { status: 400 })
  }

  const { error: uploadErr } = await admin.storage.from(bucket).upload(storageKey, bytes, {
    contentType: mimeType || 'application/octet-stream',
    upsert: false
  })
  if (uploadErr) return NextResponse.json({ error: 'Upload failed', details: uploadErr.message }, { status: 500 })

  // Insert files row
  const now = new Date().toISOString()
  const { data: fileRow, error: fileErr } = await admin
    .from('files')
    .insert({
      org_id: orgId,
      source: 'local',
      storage_provider: 'supabase',
      bucket,
      storage_key: storageKey,
      file_name: fileName,
      mime_type: mimeType || null,
      is_private: isPrivate ?? true,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (fileErr) return NextResponse.json({ error: 'Failed to create file record', details: fileErr.message }, { status: 500 })

  // Insert link row
  const isUuid = typeof entityId === 'string' && entityId.includes('-')
  const linkPayload: Record<string, unknown> = {
    file_id: fileRow.id,
    entity_type: entityType,
    org_id: orgId,
    role: role ?? null,
    category: category ?? null,
    added_at: now
  }
  linkPayload[isUuid ? 'entity_uuid' : 'entity_int'] = isUuid ? entityId : Number(entityId)

  const userEmail = user?.email || request.headers.get('x-user-email') || null
  const { data: linkRow, error: linkErr } = await admin
    .from('file_links')
    .insert(linkPayload)
    .select('*')
    .single()
  if (linkErr) return NextResponse.json({ error: 'Failed to link file', details: linkErr.message }, { status: 500 })

  let latestFileRow = fileRow
  let buildiumSync: BillFileSyncResult | null = null
  if (entityType === 'bill') {
    buildiumSync = await maybeUploadBillFileToBuildium({
      admin,
      transactionId: entityId,
      fileId: fileRow.id as string,
      fileName,
      mimeType,
      base64: normalizedBase64
    })
    if (buildiumSync?.updatedFile) {
      latestFileRow = buildiumSync.updatedFile
    }
  }

  return NextResponse.json({
    file: latestFileRow,
    link: { ...linkRow, added_by: userEmail || linkRow?.added_by || null },
    buildiumFile: buildiumSync?.buildiumFile ?? null,
    buildiumFileId: buildiumSync?.buildiumFile?.Id ?? null,
    buildiumSyncError: buildiumSync?.error ?? null
  }, { status: 201 })
}
