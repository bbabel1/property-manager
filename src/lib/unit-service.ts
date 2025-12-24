import sharp from 'sharp'
import { supabaseAdmin } from './db'
import { logger } from './logger'
import type { Database } from '@/types/database'
import type {
  BuildiumUnit,
  BuildiumUnitCreate,
  BuildiumUnitUpdate,
  BuildiumUnitImage,
  BuildiumFileDownloadMessage
} from '@/types/buildium'
import { mapUnitFromBuildium, mapUnitToBuildium, mapPropertyFromBuildiumWithBankAccount } from './buildium-mappers'
import { buildiumFetch } from './buildium-http'

export type UnitRow = Database['public']['Tables']['units']['Row']
type UnitInsert = Partial<Database['public']['Tables']['units']['Insert']> & { property_id?: string | null }
type BuildiumUnitImageWithFileName = BuildiumUnitImage & { PhysicalFileName?: string | null }
type BuildiumUnitNote = {
  Id: number
  Subject?: string | null
  Body?: string | null
  IsPrivate?: boolean | null
  [key: string]: unknown
}

type PreparedImage = {
  buffer: Buffer
  base64: string
  fileName: string
  mimeType: string
  originalDataUrl: string
  originalMimeType: string
  originalSize: number
}

export default class UnitService {
  // List Buildium units, optionally persisting to DB
  static async listFromBuildium(params?: {
    propertyIds?: number[] | string
    lastUpdatedFrom?: string
    lastUpdatedTo?: string
    orderby?: string
    offset?: number
    limit?: number
    persist?: boolean
    orgId?: string
  }): Promise<BuildiumUnit[]> {
    if (params?.persist && !params.orgId) {
      throw new Error('orgId is required when persisting Buildium units');
    }
    const queryParams: Record<string, string> = {}
    if (params?.limit) queryParams.limit = String(params.limit)
    if (params?.offset) queryParams.offset = String(params.offset)
    if (params?.orderby) queryParams.orderby = params.orderby
    if (params?.lastUpdatedFrom) queryParams.lastupdatedfrom = params.lastUpdatedFrom
    if (params?.lastUpdatedTo) queryParams.lastupdatedto = params.lastUpdatedTo
    if (params?.propertyIds) {
      queryParams.propertyids = Array.isArray(params.propertyIds) ? params.propertyIds.join(',') : String(params.propertyIds)
    }
    
    const res = await buildiumFetch('GET', '/rentals/units', queryParams, undefined, params?.orgId)
    if (!res.ok) throw new Error(`Buildium units fetch failed: ${res.status}`)
    const items: BuildiumUnit[] = (res.json as BuildiumUnit[]) ?? []

    if (params?.persist) {
      for (const u of items) {
        await UnitService.persistBuildiumUnit(u, params.orgId as string).catch(err =>
          logger.error({ unitId: u.Id, error: (err as Error).message }, 'Failed persisting Buildium unit')
        )
      }
    }

    return items
  }

  // Get one Buildium unit, optionally persisting
  static async getFromBuildium(id: number, persist = false, orgId?: string): Promise<BuildiumUnit | null> {
    if (persist && !orgId) {
      throw new Error('orgId is required when persisting Buildium units');
    }
    const res = await buildiumFetch('GET', `/rentals/units/${id}`, undefined, undefined, orgId)
    if (!res.ok) return null
    const item: BuildiumUnit = (res.json as BuildiumUnit) ?? null
    if (persist) await UnitService.persistBuildiumUnit(item, orgId as string).catch(() => void 0)
    return item
  }

  // Create in Buildium from local DB row, then insert/update in DB
  static async createInBuildiumAndDB(local: UnitRow): Promise<{ buildium: BuildiumUnit; localId: string }> {
    if (!local.buildium_property_id) throw new Error('Local unit must have buildium_property_id to create in Buildium')
    const payload: BuildiumUnitCreate = mapUnitToBuildium(local)
    const res = await buildiumFetch('POST', '/rentals/units', undefined, payload, local.org_id ?? undefined)
    if (!res.ok) throw new Error(`Buildium unit create failed: ${res.status}`)
    const created: BuildiumUnit = (res.json as BuildiumUnit) ?? null
    if (!created) throw new Error('Buildium unit create returned no data')

    await UnitService.persistBuildiumUnit(created, local.org_id)
    return { buildium: created, localId: local.id }
  }

  // Update in Buildium (by buildium id), then update DB row
  static async updateInBuildiumAndDB(buildiumId: number, partial: Partial<UnitRow>, orgId?: string): Promise<BuildiumUnit> {
    const payload: BuildiumUnitUpdate = mapUnitToBuildium({
      ...(partial as UnitRow),
      buildium_property_id: partial.buildium_property_id ?? null,
    })
    const res = await buildiumFetch('PUT', `/rentals/units/${buildiumId}`, undefined, payload, orgId ?? partial.org_id ?? undefined)
    if (!res.ok) throw new Error(`Buildium unit update failed: ${res.status}`)
    const updated: BuildiumUnit = (res.json as BuildiumUnit) ?? null
    if (!updated) throw new Error('Buildium unit update returned no data')

    // Update local if exists
    const supabase = supabaseAdmin
    const { data: local, error: localError } = await supabase
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumId)
      .maybeSingle()

    if (localError) {
      logger.error({ buildiumId, error: localError }, 'Failed to locate local unit by Buildium id')
    }

    if (local?.id) {
      const mapped = UnitService.mapForDB(updated)
      await supabase.from('units').update(mapped).eq('id', local.id)
    }

    return updated
  }

  // Persist a Buildium unit into the DB (upsert by buildium id)
  static async persistBuildiumUnit(buildiumUnit: BuildiumUnit, orgId: string): Promise<string | null> {
    if (!orgId) {
      throw new Error('orgId is required to persist Buildium units')
    }
    // Resolve local property by Buildium PropertyId
    const supabase = supabaseAdmin
    const { data: propertyRow, error: propertyLookupError } = await supabase
      .from('properties')
      .select('id, org_id')
      .eq('buildium_property_id', buildiumUnit.PropertyId)
      .maybeSingle<{ id: string; org_id: string }>()

    if (propertyLookupError) {
      logger.error({ propertyId: buildiumUnit.PropertyId, error: propertyLookupError }, 'Failed to find local property for Buildium unit')
    }

    if (propertyRow?.org_id && propertyRow.org_id !== orgId) {
      throw new Error(`Buildium property ${buildiumUnit.PropertyId} belongs to different org (${propertyRow.org_id})`)
    }

    let propertyId: string | null = propertyRow?.id ?? null

    if (!propertyId) {
      // Auto-create local property by fetching from Buildium
      const pres = await buildiumFetch('GET', `/rentals/${buildiumUnit.PropertyId}`, undefined, undefined, orgId)
      if (!pres.ok) {
        throw new Error(`No local property and failed to fetch Buildium property ${buildiumUnit.PropertyId}: ${pres.status}`)
      }
      const buildiumProperty = (pres.json as Record<string, unknown>) ?? null
      if (!buildiumProperty) {
        throw new Error(`No local property and failed to fetch Buildium property ${buildiumUnit.PropertyId}`)
      }
      const mappedProperty = await mapPropertyFromBuildiumWithBankAccount(
        buildiumProperty,
        supabase,
      )

      const mappedOperatingBankGlId = mappedProperty.operating_bank_gl_account_id ?? null
      if (mappedOperatingBankGlId) {
        const { data: bankGl } = await supabase
          .from('gl_accounts')
          .select('org_id, is_bank_account')
          .eq('id', mappedOperatingBankGlId)
          .maybeSingle<{ org_id: string | null; is_bank_account: boolean | null }>()
        if (bankGl?.org_id && bankGl.org_id !== orgId) {
          throw new Error(
            `Operating bank GL org mismatch for Buildium property ${buildiumUnit.PropertyId}: expected ${orgId}, found ${bankGl.org_id}`,
          )
        }
        if (bankGl && bankGl.is_bank_account === false) {
          throw new Error(
            `Operating bank GL is not marked as a bank account for Buildium property ${buildiumUnit.PropertyId}`,
          )
        }
      }

      const now = new Date().toISOString()
      const propertyPayload: Database['public']['Tables']['properties']['Insert'] = {
        name: mappedProperty.name,
        structure_description: mappedProperty.structure_description ?? null,
        address_line1: mappedProperty.address_line1,
        address_line2: mappedProperty.address_line2 ?? null,
        address_line3: mappedProperty.address_line3 ?? null,
        city: mappedProperty.city ?? null,
        state: mappedProperty.state ?? null,
        postal_code: mappedProperty.postal_code,
        country: (mappedProperty.country as Database['public']['Enums']['countries']) || 'United States',
        property_type: (mappedProperty.property_type as Database['public']['Enums']['property_type_enum']) ?? null,
        rental_type: mappedProperty.rental_type ?? null,
        operating_bank_gl_account_id: mappedProperty.operating_bank_gl_account_id ?? null,
        buildium_property_id: mappedProperty.buildium_property_id,
        reserve: mappedProperty.reserve ?? null,
        year_built: mappedProperty.year_built ?? null,
        total_units: mappedProperty.total_units ?? undefined,
        is_active: mappedProperty.is_active ?? true,
        service_assignment: (mappedProperty as { service_assignment?: Database['public']['Enums']['assignment_level'] }).service_assignment ?? 'Property Level',
        status: 'Active',
        org_id: orgId,
        created_at: now,
        updated_at: now
      }

      const { data: newProp, error: propErr } = await supabase
        .from('properties')
        .insert(propertyPayload)
        .select('id')
        .single()
      if (propErr) throw propErr
      propertyId = newProp.id
    }

    const mapped = UnitService.mapForDB(buildiumUnit)
    mapped.property_id = (propertyId ?? propertyRow?.id) ?? undefined
    mapped.org_id = orgId
    mapped.updated_at = new Date().toISOString()
    if (!mapped.created_at) mapped.created_at = new Date().toISOString()

    const { data: existing, error: existingError } = await supabase
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnit.Id)
      .maybeSingle()

    if (existingError) {
      logger.error({ buildiumId: buildiumUnit.Id, error: existingError }, 'Failed to look up existing unit before upsert')
    }

    if (existing?.id) {
      await supabase.from('units').update(mapped).eq('id', existing.id)
      return existing.id
    } else {
      const { data, error } = await supabase.from('units').insert(mapped as any).select('id').single()
      if (error) throw error
      return data.id
    }
  }

  private static mapForDB(buildiumUnit: BuildiumUnit): UnitInsert {
    const base = mapUnitFromBuildium(buildiumUnit) as UnitInsert
    return {
      ...base,
      buildium_property_id: base.buildium_property_id ?? buildiumUnit.PropertyId,
      unit_number:
        (typeof (buildiumUnit as { Number?: unknown }).Number === 'string'
          ? (buildiumUnit as { Number?: string }).Number
          : undefined) ??
        base.unit_number ??
        buildiumUnit.UnitNumber ??
        '',
      address_line1: base.address_line1 || buildiumUnit.Address?.AddressLine1 || '',
      city: base.city ?? buildiumUnit.Address?.City ?? '',
      state: base.state ?? buildiumUnit.Address?.State ?? '',
      postal_code: base.postal_code || buildiumUnit.Address?.PostalCode || '',
      country: (base.country as UnitInsert['country']) || 'United States'
    }
  }

  // ------------------------
  // Unit Images
  // ------------------------
  static async listImages(unitId: number, params?: { limit?: number; offset?: number; orgId?: string }): Promise<BuildiumUnitImage[]> {
    const queryParams: Record<string, string> = {}
    if (params?.limit) queryParams.limit = String(params.limit)
    if (params?.offset) queryParams.offset = String(params.offset)
    const res = await buildiumFetch('GET', `/rentals/units/${unitId}/images`, queryParams, undefined, params?.orgId)
    if (!res.ok) throw new Error(`Buildium list unit images failed: ${res.status}`)
    return (res.json as BuildiumUnitImage[]) ?? []
  }

  static async getImage(unitId: number, imageId: number, orgId?: string): Promise<BuildiumUnitImage> {
    const res = await buildiumFetch('GET', `/rentals/units/${unitId}/images/${imageId}`, undefined, undefined, orgId)
    if (!res.ok) throw new Error(`Buildium get unit image failed: ${res.status}`)
    const image = res.json as BuildiumUnitImage
    if (!image) throw new Error('Buildium get unit image returned no data')
    return image
  }

  static async uploadImage(
    unitId: number,
    prepared: PreparedImage,
    options: { Description?: string; ShowInListing?: boolean; PropertyId?: number | string; orgId?: string } = {}
  ): Promise<BuildiumUnitImage> {
    const metadata = {
      FileName: prepared.fileName,
      Description: options.Description ?? null,
      ShowInListing: options.ShowInListing ?? true
    }

    const existingRes = await buildiumFetch('GET', `/rentals/units/${unitId}/images`, undefined, undefined, options.orgId)
    const beforeImages: BuildiumUnitImage[] = existingRes.ok ? ((existingRes.json as BuildiumUnitImage[]) ?? []) : []
    const beforeIds = new Set<number>()
    for (const img of Array.isArray(beforeImages) ? beforeImages : []) {
      if (typeof img?.Id === 'number') beforeIds.add(img.Id)
    }

    const ticketRes = await buildiumFetch('POST', `/rentals/units/${unitId}/images/uploadrequests`, undefined, metadata, options.orgId)

    if (!ticketRes.ok) {
      throw new Error(`Buildium unit image upload (metadata) failed: ${ticketRes.status} ${ticketRes.errorText || 'Unknown error'}`)
    }

    const ticket: { BucketUrl?: string; FormData?: Record<string, string>; PhysicalFileName?: string } = (ticketRes.json as { BucketUrl?: string; FormData?: Record<string, string>; PhysicalFileName?: string }) ?? {}
    if (!ticket?.BucketUrl || !ticket.FormData) {
      throw new Error('Buildium unit image upload failed: missing upload ticket data')
    }

    const formData = new FormData()
    for (const [key, value] of Object.entries(ticket.FormData)) {
      if (value != null) formData.append(key, value)
    }

    const binary =
      prepared.buffer instanceof Uint8Array
        ? prepared.buffer
        : new Uint8Array((prepared as unknown as ArrayBuffer) || prepared.buffer);
    const blobData = new Uint8Array(binary);
    const fileBlob = new globalThis.Blob([blobData], { type: prepared.mimeType });
    formData.append('file', fileBlob, prepared.fileName)

    const uploadRes = await fetch(ticket.BucketUrl, {
      method: 'POST',
      body: formData
    })

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text().catch(() => '')
      throw new Error(`Buildium unit image binary upload failed: ${uploadRes.status} ${errorText}`)
    }

    const locateUploadedImage = async (): Promise<BuildiumUnitImage | null> => {
      const attempts = 10
      for (let i = 0; i < attempts; i++) {
        const listRes = await buildiumFetch('GET', `/rentals/units/${unitId}/images`, undefined, undefined, options.orgId)
        if (!listRes.ok) {
          throw new Error(`Buildium unit image fetch failed after upload: ${listRes.status} ${listRes.errorText || 'Unknown error'}`)
        }
        const images: BuildiumUnitImage[] = (listRes.json as BuildiumUnitImage[]) ?? []
        if (Array.isArray(images)) {
          let candidate = images.find(img => typeof img?.Id === 'number' && !beforeIds.has(img.Id)) || null
          const ticketFileName = (ticket?.PhysicalFileName || '').toLowerCase()
          if (!candidate && ticketFileName) {
            candidate = images.find(img => {
              const physicalFileName = (img as BuildiumUnitImageWithFileName).PhysicalFileName || ''
              return physicalFileName.toLowerCase() === ticketFileName
            }) || null
          }
          if (!candidate && images.length) {
            candidate = images[images.length - 1]
          }
          if (candidate) return candidate
        }
        if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, 700))
      }
      return null
    }

    const uploadedImage = await locateUploadedImage()
    if (!uploadedImage) {
      throw new Error('Buildium unit image upload succeeded but the image could not be retrieved')
    }

    uploadedImage.Href = prepared.originalDataUrl
    uploadedImage.FileType = prepared.originalMimeType
    uploadedImage.FileSize = prepared.originalSize

    await UnitService.persistImages(unitId, [uploadedImage]).catch(() => void 0)
    return uploadedImage
  }

  static async prepareImage(fileName: string, base64Data: string, originalMimeType?: string): Promise<PreparedImage> {
    const original = Buffer.from(base64Data, 'base64')
    const safeName = (fileName || 'unit-image').replace(/[^a-zA-Z0-9._-]/g, '_')
    const inferredMime = originalMimeType || UnitService.inferMimeTypeFromName(fileName) || 'image/jpeg'
    const originalDataUrl = `data:${inferredMime};base64,${base64Data}`

    const processed = sharp(original)
      .rotate()
      .resize(1200, 1600, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({ quality: 90 })

    const { data } = await processed.toBuffer({ resolveWithObject: true })
    const finalName = safeName.replace(/\.[^.]+$/, '') + '.jpg'
    const base64 = data.toString('base64')
    return {
      buffer: data,
      base64,
      fileName: finalName,
      mimeType: 'image/jpeg',
      originalDataUrl,
      originalMimeType: inferredMime,
      originalSize: original.length
    }
  }

  static async updateImage(unitId: number, imageId: number, payload: { Description?: string }, orgId?: string): Promise<BuildiumUnitImage> {
    const res = await buildiumFetch('PUT', `/rentals/units/${unitId}/images/${imageId}`, undefined, payload, orgId)
    if (!res.ok) throw new Error(`Buildium update unit image failed: ${res.status}`)
    const img = (res.json as BuildiumUnitImage) ?? null
    if (!img) throw new Error('Buildium update unit image returned no data')
    await UnitService.persistImages(unitId, [img], orgId).catch(() => void 0)
    return img
  }

  static async deleteImage(unitId: number, imageId: number, orgId?: string): Promise<void> {
    const res = await buildiumFetch('DELETE', `/rentals/units/${unitId}/images/${imageId}`, undefined, undefined, orgId)
    if (!res.ok) throw new Error(`Buildium delete unit image failed: ${res.status}`)
    // Remove from DB if present
    const localUnitId = await UnitService.resolveLocalUnitId(unitId).catch(() => null)
    if (localUnitId) {
      await supabaseAdmin.from('unit_images').delete().eq('buildium_image_id', imageId).eq('unit_id', localUnitId)
    }
  }

  static async downloadImage(unitId: number, imageId: number, orgId?: string): Promise<BuildiumFileDownloadMessage> {
    const res = await buildiumFetch('POST', `/rentals/units/${unitId}/images/${imageId}/download`, undefined, undefined, orgId)
    if (!res.ok) throw new Error(`Buildium download unit image url failed: ${res.status}`)
    const download = res.json as BuildiumFileDownloadMessage
    if (!download) throw new Error('Buildium download unit image returned no data')
    return download
  }

  static async updateImageOrder(unitId: number, imageIds: number[], orgId?: string): Promise<void> {
    const res = await buildiumFetch('PUT', `/rentals/units/${unitId}/images/order`, undefined, { ImageIds: imageIds }, orgId)
    if (!res.ok) throw new Error(`Buildium update unit image order failed: ${res.status}`)
    // Update local sort_index
    const localUnitId = await UnitService.resolveLocalUnitId(unitId).catch(() => null)
    if (localUnitId) {
      for (let i = 0; i < imageIds.length; i++) {
        await supabaseAdmin
          .from('unit_images')
          .update({ sort_index: i, updated_at: new Date().toISOString() })
          .eq('unit_id', localUnitId)
          .eq('buildium_image_id', imageIds[i])
      }
    }
  }

  // ------------------------
  // Unit Notes
  // ------------------------
  static async listNotes(unitId: number, params?: { limit?: number; offset?: number; orgId?: string }): Promise<BuildiumUnitNote[]> {
    const queryParams: Record<string, string> = {}
    if (params?.limit) queryParams.limit = String(params.limit)
    if (params?.offset) queryParams.offset = String(params.offset)
    const res = await buildiumFetch('GET', `/rentals/units/${unitId}/notes`, queryParams, undefined, params?.orgId)
    if (!res.ok) throw new Error(`Buildium list unit notes failed: ${res.status}`)
    const notes = (res.json as BuildiumUnitNote[]) ?? []
    await UnitService.persistNotes(unitId, notes, params?.orgId).catch(() => void 0)
    return notes
  }

  static async getNote(unitId: number, noteId: number, orgId?: string): Promise<BuildiumUnitNote> {
    const res = await buildiumFetch('GET', `/rentals/units/${unitId}/notes/${noteId}`, undefined, undefined, orgId)
    if (!res.ok) throw new Error(`Buildium get unit note failed: ${res.status}`)
    const note = res.json as BuildiumUnitNote
    if (!note) throw new Error('Buildium get unit note returned no data')
    return note
  }

  static async createNote(unitId: number, payload: { Subject: string; Body: string; IsPrivate?: boolean }, orgId?: string): Promise<BuildiumUnitNote> {
    const res = await buildiumFetch('POST', `/rentals/units/${unitId}/notes`, undefined, payload, orgId)
    if (!res.ok) throw new Error(`Buildium create unit note failed: ${res.status}`)
    const note = (res.json as BuildiumUnitNote) ?? null
    if (!note) throw new Error('Buildium create unit note returned no data')
    await UnitService.persistNotes(unitId, [note], orgId).catch(() => void 0)
    return note
  }

  static async updateNote(unitId: number, noteId: number, payload: { Subject?: string; Body?: string; IsPrivate?: boolean }, orgId?: string): Promise<BuildiumUnitNote> {
    const res = await buildiumFetch('PUT', `/rentals/units/${unitId}/notes/${noteId}`, undefined, payload, orgId)
    if (!res.ok) throw new Error(`Buildium update unit note failed: ${res.status}`)
    const note = (res.json as BuildiumUnitNote) ?? null
    if (!note) throw new Error('Buildium update unit note returned no data')
    await UnitService.persistNotes(unitId, [note], orgId).catch(() => void 0)
    return note
  }

  // ------------------------
  // Persistence helpers for images & notes
  // ------------------------
  static async resolveLocalUnitId(buildiumUnitId: number): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnitId)
      .single()
    return data?.id ?? null
  }

  static async persistImages(buildiumUnitId: number, images: BuildiumUnitImage[], orgId?: string): Promise<void> {
    let localUnitId = await UnitService.resolveLocalUnitId(buildiumUnitId)
    if (!localUnitId) {
      // Ensure unit exists locally only when org context is provided
      if (orgId) {
        await UnitService.getFromBuildium(buildiumUnitId, true, orgId).catch(() => null)
        localUnitId = await UnitService.resolveLocalUnitId(buildiumUnitId)
      }
    }
    if (!localUnitId) return
    const now = new Date().toISOString()
    for (const img of images) {
      let href = img.Href ?? null
      let fileType = img.FileType ?? null
      let fileSize = typeof img.FileSize === 'number' ? img.FileSize : null
      const needsLocalCopy = !href || !href.startsWith('data:')
      if (needsLocalCopy && typeof img?.Id === 'number') {
        const data = await UnitService.fetchBuildiumImageData(buildiumUnitId, img.Id)
        if (data?.dataUrl) {
          href = data.dataUrl
          fileType = data.mimeType ?? fileType
          fileSize = data.size ?? fileSize
        }
      }

      const row = {
        unit_id: localUnitId,
        buildium_image_id: img.Id,
        name: img.Name ?? null,
        description: img.Description ?? null,
        file_type: fileType ?? img.FileType ?? null,
        file_size: fileSize,
        is_private: img.IsPrivate ?? null,
        href,
        updated_at: now
      }
      const { data: existing } = await supabaseAdmin
        .from('unit_images')
        .select('id')
        .eq('buildium_image_id', img.Id)
        .single()
      if (existing?.id) {
        await supabaseAdmin.from('unit_images').update(row).eq('id', existing.id)
      } else {
        await supabaseAdmin.from('unit_images').insert({ ...row, created_at: now })
      }
    }
  }

  static async fetchBuildiumImageData(unitId: number, imageId: number): Promise<{ dataUrl: string; mimeType: string | null; size: number } | null> {
    try {
      const download = await UnitService.downloadImage(unitId, imageId)
      if (!download?.DownloadUrl) return null
      const res = await fetch(download.DownloadUrl)
      if (!res.ok) return null
      const buffer = Buffer.from(await res.arrayBuffer())
      const mime = res.headers.get('content-type') || 'image/jpeg'
      return { dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, mimeType: mime, size: buffer.length }
    } catch (error) {
      console.warn('Failed to fetch Buildium image data', error)
      return null
    }
  }

  private static inferMimeTypeFromName(name?: string | null): string | null {
    if (!name) return null
    const lower = name.toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.gif')) return 'image/gif'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.bmp')) return 'image/bmp'
    if (lower.endsWith('.svg') || lower.endsWith('.svgz')) return 'image/svg+xml'
    if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic'
    return lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : null
  }

  static async persistNotes(buildiumUnitId: number, notes: BuildiumUnitNote[], orgId?: string): Promise<void> {
    let localUnitId = await UnitService.resolveLocalUnitId(buildiumUnitId)
    if (!localUnitId) {
      if (orgId) {
        await UnitService.getFromBuildium(buildiumUnitId, true, orgId).catch(() => null)
        localUnitId = await UnitService.resolveLocalUnitId(buildiumUnitId)
      }
    }
    if (!localUnitId) return
    const now = new Date().toISOString()
    for (const n of notes) {
      const row = {
        unit_id: localUnitId,
        buildium_note_id: n.Id,
        subject: n.Subject ?? null,
        body: n.Body ?? null,
        is_private: n.IsPrivate ?? null,
        updated_at: now
      }
      const { data: existing } = await supabaseAdmin
        .from('unit_notes')
        .select('id')
        .eq('buildium_note_id', n.Id)
        .single()
      if (existing?.id) {
        await supabaseAdmin.from('unit_notes').update(row).eq('id', existing.id)
      } else {
        await supabaseAdmin.from('unit_notes').insert({ ...row, created_at: now })
      }
    }
  }
}
