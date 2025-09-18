import supabaseAdmin, { supabase as supabaseClient } from './db'
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
    const local = await supabase
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumId)
      .single()
      .then(r => r.data)
      .catch(() => null)

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
    const propertyRow = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumUnit.PropertyId)
      .single()
      .then(r => r.data)
      .catch(() => null)

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

    const existing = await supabase
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnit.Id)
      .single()
      .then(r => r.data)
      .catch(() => null)

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

  static async uploadImage(unitId: number, payload: { FileName: string; FileData: string; Description?: string }): Promise<BuildiumUnitImage> {
    const res = await fetch(`${BASE}/rentals/units/${unitId}/images`, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(`Buildium upload unit image failed: ${res.status}`)
    const img = await res.json()
    await UnitService.persistImages(unitId, [img]).catch(() => void 0)
    return img
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
      const row = {
        unit_id: localUnitId,
        buildium_image_id: img.Id,
        name: img.Name ?? null,
        description: img.Description ?? null,
        file_type: img.FileType ?? null,
        file_size: typeof img.FileSize === 'number' ? img.FileSize : null,
        is_private: img.IsPrivate ?? null,
        href: img.Href ?? null,
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
