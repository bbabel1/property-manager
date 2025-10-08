import { Blob } from 'buffer'
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

const BASE = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1'
const HEADERS = () => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
  'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || ''
})

export type UnitRow = Database['public']['Tables']['units']['Row']

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
  }): Promise<BuildiumUnit[]> {
    const qs = new URLSearchParams()
    if (params?.limit) qs.append('limit', String(params.limit))
    if (params?.offset) qs.append('offset', String(params.offset))
    if (params?.orderby) qs.append('orderby', params.orderby)
    if (params?.lastUpdatedFrom) qs.append('lastupdatedfrom', params.lastUpdatedFrom)
    if (params?.lastUpdatedTo) qs.append('lastupdatedto', params.lastUpdatedTo)
    if (params?.propertyIds) {
      const val = Array.isArray(params.propertyIds) ? params.propertyIds.join(',') : String(params.propertyIds)
      qs.append('propertyids', val)
    }

    const res = await fetch(`${BASE}/rentals/units?${qs.toString()}`, { headers: HEADERS() })
    if (!res.ok) throw new Error(`Buildium units fetch failed: ${res.status}`)
    const items: BuildiumUnit[] = await res.json()

    if (params?.persist) {
      for (const u of items) {
        await UnitService.persistBuildiumUnit(u).catch(err =>
          logger.error({ unitId: u.Id, error: (err as Error).message }, 'Failed persisting Buildium unit')
        )
      }
    }

    return items
  }

  // Get one Buildium unit, optionally persisting
  static async getFromBuildium(id: number, persist = false): Promise<BuildiumUnit | null> {
    const res = await fetch(`${BASE}/rentals/units/${id}`, { headers: HEADERS() })
    if (!res.ok) return null
    const item: BuildiumUnit = await res.json()
    if (persist) await UnitService.persistBuildiumUnit(item).catch(() => void 0)
    return item
  }

  // Create in Buildium from local DB row, then insert/update in DB
  static async createInBuildiumAndDB(local: UnitRow): Promise<{ buildium: BuildiumUnit; localId: string }> {
    if (!local.buildium_property_id) throw new Error('Local unit must have buildium_property_id to create in Buildium')
    const payload: BuildiumUnitCreate = mapUnitToBuildium(local)
    const res = await fetch(`${BASE}/rentals/units`, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(`Buildium unit create failed: ${res.status}`)
    const created: BuildiumUnit = await res.json()

    await UnitService.persistBuildiumUnit(created)
    return { buildium: created, localId: local.id }
  }

  // Update in Buildium (by buildium id), then update DB row
  static async updateInBuildiumAndDB(buildiumId: number, partial: Partial<UnitRow>): Promise<BuildiumUnit> {
    const payload: BuildiumUnitUpdate = mapUnitToBuildium({ ...partial, buildium_property_id: partial.buildium_property_id })
    const res = await fetch(`${BASE}/rentals/units/${buildiumId}`, {
      method: 'PUT',
      headers: HEADERS(),
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(`Buildium unit update failed: ${res.status}`)
    const updated: BuildiumUnit = await res.json()

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
  static async persistBuildiumUnit(buildiumUnit: BuildiumUnit): Promise<string | null> {
    // Resolve local property by Buildium PropertyId
    const supabase = supabaseAdmin
    const { data: propertyRow, error: propertyLookupError } = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumUnit.PropertyId)
      .maybeSingle()

    if (propertyLookupError) {
      logger.error({ propertyId: buildiumUnit.PropertyId, error: propertyLookupError }, 'Failed to find local property for Buildium unit')
    }

    let propertyId: string | null = propertyRow?.id ?? null

    if (!propertyId) {
      // Auto-create local property by fetching from Buildium
      const pres = await fetch(`${BASE}/rentals/${buildiumUnit.PropertyId}`, { headers: HEADERS() })
      if (!pres.ok) {
        throw new Error(`No local property and failed to fetch Buildium property ${buildiumUnit.PropertyId}: ${pres.status}`)
      }
      const buildiumProperty = await pres.json()
      const mappedProperty = await mapPropertyFromBuildiumWithBankAccount(buildiumProperty, supabase)
      const { data: newProp, error: propErr } = await supabase
        .from('properties')
        .insert(mappedProperty)
        .select('id')
        .single()
      if (propErr) throw propErr
      propertyId = newProp.id
    }

    const mapped = UnitService.mapForDB(buildiumUnit)
    mapped.property_id = propertyId || (propertyRow as any)?.id
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
      const { data, error } = await supabase.from('units').insert(mapped).select('id').single()
      if (error) throw error
      return data.id
    }
  }

  private static mapForDB(buildiumUnit: BuildiumUnit) {
    const base = mapUnitFromBuildium(buildiumUnit)
    return {
      ...base,
      country: base.country || 'United States'
    } as any
  }

  // ------------------------
  // Unit Images
  // ------------------------
  static async listImages(unitId: number, params?: { limit?: number; offset?: number }): Promise<BuildiumUnitImage[]> {
    const q = new URLSearchParams()
    if (params?.limit) q.append('limit', String(params.limit))
    if (params?.offset) q.append('offset', String(params.offset))
    const res = await fetch(`${BASE}/rentals/units/${unitId}/images?${q.toString()}`, { headers: HEADERS() })
    if (!res.ok) throw new Error(`Buildium list unit images failed: ${res.status}`)
    return res.json()
  }

  static async getImage(unitId: number, imageId: number): Promise<BuildiumUnitImage> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/images/${imageId}`, { headers: HEADERS() })
    if (!res.ok) throw new Error(`Buildium get unit image failed: ${res.status}`)
    return res.json()
  }

  static async uploadImage(
    unitId: number,
    prepared: PreparedImage,
    options: { Description?: string; ShowInListing?: boolean; PropertyId?: number | string } = {}
  ): Promise<BuildiumUnitImage> {
    const metadata = {
      FileName: prepared.fileName,
      Description: options.Description ?? null,
      ShowInListing: options.ShowInListing ?? true
    }

    const existingRes = await fetch(`${BASE}/rentals/units/${unitId}/images`, { headers: HEADERS() })
    const beforeImages: BuildiumUnitImage[] = existingRes.ok ? await existingRes.json().catch(() => []) : []
    const beforeIds = new Set<number>()
    for (const img of Array.isArray(beforeImages) ? beforeImages : []) {
      if (typeof img?.Id === 'number') beforeIds.add(img.Id)
    }

    const ticketRes = await fetch(`${BASE}/rentals/units/${unitId}/images/uploadrequests`, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify(metadata)
    })

    if (!ticketRes.ok) {
      const errorText = await ticketRes.text().catch(() => '')
      throw new Error(`Buildium unit image upload (metadata) failed: ${ticketRes.status} ${errorText}`)
    }

    const ticket: { BucketUrl?: string; FormData?: Record<string, string>; PhysicalFileName?: string } = await ticketRes.json()
    if (!ticket?.BucketUrl || !ticket.FormData) {
      throw new Error('Buildium unit image upload failed: missing upload ticket data')
    }

    const formData = new FormData()
    for (const [key, value] of Object.entries(ticket.FormData)) {
      if (value != null) formData.append(key, value)
    }

    formData.append('file', new Blob([prepared.buffer], { type: prepared.mimeType }), prepared.fileName)

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
        const listRes = await fetch(`${BASE}/rentals/units/${unitId}/images`, { headers: HEADERS() })
        if (!listRes.ok) {
          const errorText = await listRes.text().catch(() => '')
          throw new Error(`Buildium unit image fetch failed after upload: ${listRes.status} ${errorText}`)
        }
        const images: BuildiumUnitImage[] = await listRes.json()
        if (Array.isArray(images)) {
          let candidate = images.find(img => typeof img?.Id === 'number' && !beforeIds.has(img.Id)) || null
          if (!candidate && ticket?.PhysicalFileName) {
            candidate = images.find(img => String((img as any)?.PhysicalFileName || '').toLowerCase() === String(ticket.PhysicalFileName || '').toLowerCase()) || null
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

  static async updateImage(unitId: number, imageId: number, payload: { Description?: string }): Promise<BuildiumUnitImage> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/images/${imageId}`, {
      method: 'PUT',
      headers: HEADERS(),
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(`Buildium update unit image failed: ${res.status}`)
    const img = await res.json()
    await UnitService.persistImages(unitId, [img]).catch(() => void 0)
    return img
  }

  static async deleteImage(unitId: number, imageId: number): Promise<void> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/images/${imageId}`, {
      method: 'DELETE',
      headers: HEADERS()
    })
    if (!res.ok) throw new Error(`Buildium delete unit image failed: ${res.status}`)
    // Remove from DB if present
    const localUnitId = await UnitService.resolveLocalUnitId(unitId).catch(() => null)
    if (localUnitId) {
      await supabaseAdmin.from('unit_images').delete().eq('buildium_image_id', imageId).eq('unit_id', localUnitId)
    }
  }

  static async downloadImage(unitId: number, imageId: number): Promise<BuildiumFileDownloadMessage> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/images/${imageId}/download`, {
      method: 'POST',
      headers: HEADERS()
    })
    if (!res.ok) throw new Error(`Buildium download unit image url failed: ${res.status}`)
    return res.json()
  }

  static async updateImageOrder(unitId: number, imageIds: number[]): Promise<void> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/images/order`, {
      method: 'PUT',
      headers: HEADERS(),
      body: JSON.stringify({ ImageIds: imageIds })
    })
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
  static async listNotes(unitId: number, params?: { limit?: number; offset?: number }): Promise<any[]> {
    const q = new URLSearchParams()
    if (params?.limit) q.append('limit', String(params.limit))
    if (params?.offset) q.append('offset', String(params.offset))
    const res = await fetch(`${BASE}/rentals/units/${unitId}/notes?${q.toString()}`, { headers: HEADERS() })
    if (!res.ok) throw new Error(`Buildium list unit notes failed: ${res.status}`)
    const notes = await res.json()
    await UnitService.persistNotes(unitId, notes).catch(() => void 0)
    return notes
  }

  static async getNote(unitId: number, noteId: number): Promise<any> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/notes/${noteId}`, { headers: HEADERS() })
    if (!res.ok) throw new Error(`Buildium get unit note failed: ${res.status}`)
    return res.json()
  }

  static async createNote(unitId: number, payload: { Subject: string; Body: string; IsPrivate?: boolean }): Promise<any> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/notes`, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(`Buildium create unit note failed: ${res.status}`)
    const note = await res.json()
    await UnitService.persistNotes(unitId, [note]).catch(() => void 0)
    return note
  }

  static async updateNote(unitId: number, noteId: number, payload: { Subject?: string; Body?: string; IsPrivate?: boolean }): Promise<any> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/notes/${noteId}`, {
      method: 'PUT',
      headers: HEADERS(),
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(`Buildium update unit note failed: ${res.status}`)
    const note = await res.json()
    await UnitService.persistNotes(unitId, [note]).catch(() => void 0)
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

  static async persistImages(buildiumUnitId: number, images: BuildiumUnitImage[]): Promise<void> {
    let localUnitId = await UnitService.resolveLocalUnitId(buildiumUnitId)
    if (!localUnitId) {
      // Ensure unit exists locally
      const unit = await UnitService.getFromBuildium(buildiumUnitId, true).catch(() => null)
      localUnitId = await UnitService.resolveLocalUnitId(buildiumUnitId)
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

  static async persistNotes(buildiumUnitId: number, notes: any[]): Promise<void> {
    let localUnitId = await UnitService.resolveLocalUnitId(buildiumUnitId)
    if (!localUnitId) {
      const unit = await UnitService.getFromBuildium(buildiumUnitId, true).catch(() => null)
      localUnitId = await UnitService.resolveLocalUnitId(buildiumUnitId)
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
