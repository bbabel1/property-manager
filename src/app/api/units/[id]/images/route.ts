import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BuildiumUnitImageUploadSchema } from '@/schemas/buildium'
import { buildiumFetch } from '@/lib/buildium-http'
import UnitService from '@/lib/unit-service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    const { id: unitId } = await params
    const db = supabaseAdmin || supabase

    const { data: unitRow, error: unitError } = await db
      .from('units')
      .select('id, property_id, buildium_unit_id, org_id')
      .eq('id', unitId)
      .maybeSingle()

    if (unitError || !unitRow) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const fetchLocalImages = async () => {
      const { data, error } = await db
        .from('unit_images')
        .select('*')
        .eq('unit_id', unitId)
        .order('sort_index', { ascending: true })

      if (error) throw error
      return data ?? []
    }

    let images = await fetchLocalImages()
    const normalizeLocalImages = async (list: any[]) => {
      if (!unitRow.buildium_unit_id) return list
      const updated: any[] = []
      for (const img of list) {
        if (img?.buildium_image_id && (!img.href || !String(img.href).startsWith('data:'))) {
          try {
            const data = await UnitService.fetchBuildiumImageData(Number(unitRow.buildium_unit_id), img.buildium_image_id)
            if (data?.dataUrl) {
              const update = {
                href: data.dataUrl,
                file_type: data.mimeType ?? img.file_type,
                file_size: data.size ?? img.file_size,
                updated_at: new Date().toISOString()
              }
              await db.from('unit_images').update(update).eq('id', img.id)
              img.href = update.href
              img.file_type = update.file_type
              img.file_size = update.file_size
            }
          } catch {}
        }
        updated.push(img)
      }
      return updated
    }

    if ((!images || images.length === 0) && unitRow.buildium_unit_id) {
      const res = await buildiumFetch('GET', `/rentals/units/${unitRow.buildium_unit_id}/images`)
      if (res.ok && Array.isArray(res.json)) {
        try {
          const now = new Date().toISOString()
          for (const img of res.json) {
            const href = img?.Href || img?.Url || null
            const row = {
              unit_id: unitId,
              buildium_image_id: typeof img?.Id === 'number' ? img.Id : null,
              name: img?.Name ?? null,
              description: img?.Description ?? null,
              file_type: img?.FileType ?? null,
              file_size: typeof img?.FileSize === 'number' ? img.FileSize : null,
              is_private: typeof img?.IsPrivate === 'boolean' ? img.IsPrivate : null,
              href,
              sort_index: typeof img?.SortOrder === 'number' ? img.SortOrder : null,
              created_at: now,
              updated_at: now
            }
            if (row.buildium_image_id != null) {
              const { data: existing } = await db
                .from('unit_images')
                .select('id')
                .eq('unit_id', unitId)
                .eq('buildium_image_id', row.buildium_image_id)
                .maybeSingle()
              if (existing?.id) {
                await db.from('unit_images').update({ ...row, created_at: undefined }).eq('id', existing.id)
              } else {
                await db.from('unit_images').insert(row)
              }
            }
          }
        } catch (persistError) {
          logger.error({ error: persistError }, 'Failed to persist Buildium unit images locally')
        }
        images = await fetchLocalImages()
      }
    }
    images = await normalizeLocalImages(images)

    logger.info({ userId: user.id, unitId, count: images.length }, 'Unit images fetched successfully')

    return NextResponse.json({ success: true, data: images })
  } catch (error) {
    logger.error({ error }, 'Error fetching unit images')
    return NextResponse.json({ error: 'Failed to fetch unit images' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    const { id: unitId } = await params
    const db = supabaseAdmin || supabase

    const { data: unitRow, error: unitError } = await db
      .from('units')
      .select('id, property_id, buildium_unit_id, org_id')
      .eq('id', unitId)
      .maybeSingle()

    if (unitError || !unitRow) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const validated = sanitizeAndValidate(body, BuildiumUnitImageUploadSchema)

    const rawBase64 = String(validated.FileData || '')
    const prepared = await UnitService.prepareImage(validated.FileName, rawBase64, validated.FileType)
    const fileSizeBytes = prepared.buffer.length

    const { data: existingSort } = await db
      .from('unit_images')
      .select('sort_index')
      .eq('unit_id', unitId)
      .order('sort_index', { ascending: false })
      .limit(1)

    const nextSortIndex = (existingSort?.[0]?.sort_index ?? -1) + 1

    if (unitRow.buildium_unit_id) {
      let propertyHint: number | null = null
      if (unitRow.property_id) {
        const { data: propertyRow } = await db
          .from('properties')
          .select('buildium_property_id')
          .eq('id', unitRow.property_id)
          .maybeSingle()
        if (propertyRow?.buildium_property_id && Number(propertyRow.buildium_property_id) > 0) {
          propertyHint = Number(propertyRow.buildium_property_id)
        }
      }
      let uploaded
      try {
        uploaded = await UnitService.uploadImage(Number(unitRow.buildium_unit_id), prepared, {
          Description: validated.Description,
          ShowInListing: true,
          PropertyId: propertyHint && !Number.isNaN(propertyHint) ? propertyHint : undefined
        })
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : 'Failed to upload unit image to Buildium'
        logger.error({ unitId, error: message }, 'Buildium unit image upload failed')
        return NextResponse.json({ error: message }, { status: 502 })
      }

      const href = prepared.originalDataUrl
      const row = {
        unit_id: unitId,
        buildium_image_id: typeof uploaded?.Id === 'number' ? uploaded.Id : null,
        name: uploaded?.Name ?? prepared.fileName ?? null,
        description: uploaded?.Description ?? validated.Description ?? null,
        file_type: prepared.originalMimeType,
        file_size: prepared.originalSize,
        is_private: typeof uploaded?.IsPrivate === 'boolean' ? uploaded.IsPrivate : null,
        href,
        sort_index: typeof uploaded?.SortOrder === 'number' ? uploaded.SortOrder : nextSortIndex,
      }

      const { data: image, error: storeError } = await db
        .from('unit_images')
        .upsert(row, { onConflict: 'buildium_image_id' })
        .select('*')
        .maybeSingle()

      if (storeError || !image) {
        logger.error({ error: storeError, unitId, userId: user.id }, 'Failed to persist Buildium unit image')
        return NextResponse.json({ error: 'Failed to store unit image' }, { status: 500 })
      }

      uploaded.Href = prepared.originalDataUrl
      uploaded.FileType = prepared.originalMimeType
      uploaded.FileSize = prepared.originalSize
      try {
        await UnitService.persistImages(
          unitRow.buildium_unit_id,
          [uploaded],
          (unitRow as { org_id?: string | null }).org_id || undefined,
        );
      } catch {}

      return NextResponse.json({ success: true, data: image })
    }

    // Local-only fallback when the unit is not linked to Buildium yet
    const localInsert = {
      unit_id: unitId,
      buildium_image_id: null as number | null,
      name: prepared.fileName ?? null,
      description: validated.Description ?? null,
      file_type: prepared.originalMimeType,
      file_size: prepared.originalSize,
      is_private: false,
      href: prepared.originalDataUrl,
      sort_index: nextSortIndex,
    }

    const { data: image, error: localError } = await db
      .from('unit_images')
      .insert(localInsert)
      .select('*')
      .single()

    if (localError || !image) {
      const errorCode = (localError as { code?: string } | null)?.code
      if (errorCode === '23502') {
        const fallbackId = -1 * (Math.floor(Date.now() % 2000000000) + Math.floor(Math.random() * 1000) + 1)
        const retry = await db
          .from('unit_images')
          .insert({ ...localInsert, buildium_image_id: fallbackId })
          .select('*')
          .single()
        if (retry.error || !retry.data) {
          logger.error({ error: retry.error, unitId, userId: user.id }, 'Failed to store local unit image (retry)')
          return NextResponse.json({ error: 'Failed to store unit image' }, { status: 500 })
        }
        return NextResponse.json({ success: true, data: retry.data })
      }
      logger.error({ error: localError, unitId, userId: user.id }, 'Failed to store local unit image')
      return NextResponse.json({ error: 'Failed to store unit image' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: image })
  } catch (error) {
    logger.error({ error }, 'Error uploading unit image')
    return NextResponse.json({ error: 'Failed to upload unit image' }, { status: 500 })
  }
}
