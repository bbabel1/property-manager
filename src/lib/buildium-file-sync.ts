// @ts-nocheck
"use server"

import { getOrgScopedBuildiumClient } from '@/lib/buildium-client'
import { getOrgScopedBuildiumConfig } from '@/lib/buildium/credentials-manager'
import { extractBuildiumFileIdFromPayload } from '@/lib/buildium-utils'
import { FILE_ENTITY_TYPES, type FileRow } from '@/lib/files'
import { logger } from '@/lib/logger'
import type { TypedSupabaseClient } from '@/lib/db'

type LocalFileCategoryRecord = Record<string, unknown>
type BuildiumUploadTicket = {
  BucketUrl?: string
  FormData?: Record<string, string>
  Href?: string
  Id?: number | string
}
type UploadRequestPayload = {
  FileName: string
  Title?: string | null
  FileTitle?: string | null
  Description?: string | null
  CategoryId?: number | null
  Category?: string | null
  ContentType?: string | null
  IsPrivate?: boolean | null
  PropertyId?: number | null
  UnitId?: number | null
}

const FILE_CATEGORY_TABLE_CANDIDATES = [
  'file_categories',
  'files_category',
  'files_categories',
  'buildium_file_categories'
] as const

const CATEGORY_NAME_FIELDS = [
  'display_name',
  'displayName',
  'category_name',
  'categoryName',
  'name',
  'label',
  'title',
  'category',
  'slug',
  'value',
  'key'
] as const

const CATEGORY_ALIAS_FIELDS = [
  'aliases',
  'alias',
  'synonyms',
  'keywords',
  'tags',
  'values',
  'labels',
  'alternate_names',
  'alternateNames'
] as const

const CATEGORY_ENTITY_FIELDS = [
  'entity_type',
  'entityType',
  'entity_types',
  'entityTypes',
  'scope',
  'applies_to',
  'appliesTo',
  'entities',
  'supported_entities',
  'usage'
] as const

const CATEGORY_ID_FIELDS = [
  'buildium_category_id',
  'buildiumCategoryId',
  'buildium_id',
  'buildiumId',
  'category_id',
  'categoryId'
] as const

const CATEGORY_ALIAS_MAP: Record<string, string[]> = {
  lease: ['lease documents', 'lease document', 'lease agreement'],
  'lease documents': ['lease documents', 'lease document', 'lease'],
  statement: ['statement', 'owner statement', 'statement of account'],
  maintenance: ['maintenance', 'repairs', 'work order'],
  compliance: ['compliance'],
  other: ['other', 'misc', 'miscellaneous'],
  uncategorized: ['uncategorized', 'other', 'misc', 'miscellaneous']
}

const FILE_CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000
let cachedFileCategories: { data: LocalFileCategoryRecord[]; expires: number } | null = null

export type BuildiumFileSyncResult = {
  buildiumFile: Record<string, unknown> | null
  updatedFile?: FileRow
  error?: string
}

const collectNormalizedStrings = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value
      .split(/[,|]/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectNormalizedStrings(entry))
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if ('value' in record) {
      return collectNormalizedStrings(record.value)
    }
  }
  return []
}

const extractBuildiumCategoryId = (record: LocalFileCategoryRecord): number | null => {
  for (const field of CATEGORY_ID_FIELDS) {
    if (field in record) {
      const raw = (record as Record<string, unknown>)[field]
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = Number(raw.trim())
        if (Number.isFinite(parsed)) return parsed
      }
    }
  }
  return null
}

const extractDisplayName = (record: LocalFileCategoryRecord): string | undefined => {
  for (const field of CATEGORY_NAME_FIELDS) {
    const value = (record as Record<string, unknown>)[field]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

const extractCategoryNames = (record: LocalFileCategoryRecord): string[] => {
  const normalized = new Set<string>()
  for (const field of CATEGORY_NAME_FIELDS) {
    if (field in record) {
      collectNormalizedStrings((record as Record<string, unknown>)[field]).forEach((value) => normalized.add(value))
    }
  }
  for (const field of CATEGORY_ALIAS_FIELDS) {
    if (field in record) {
      collectNormalizedStrings((record as Record<string, unknown>)[field]).forEach((value) => normalized.add(value))
    }
  }
  return Array.from(normalized)
}

const extractEntityTypes = (record: LocalFileCategoryRecord): string[] => {
  const normalized = new Set<string>()
  for (const field of CATEGORY_ENTITY_FIELDS) {
    if (field in record) {
      collectNormalizedStrings((record as Record<string, unknown>)[field]).forEach((value) => normalized.add(value))
    }
  }
  return Array.from(normalized)
}

const matchesLeaseEntity = (record: LocalFileCategoryRecord): boolean => {
  const entityTypes = extractEntityTypes(record)
  if (entityTypes.length === 0) return true
  return entityTypes.some((value) => {
    if (value === 'all' || value === 'any') return true
    return value.includes('lease')
  })
}

const findMatchingRecord = (
  records: LocalFileCategoryRecord[],
  candidates: string[],
  { allowPartial }: { allowPartial: boolean },
): LocalFileCategoryRecord | null => {
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.trim().toLowerCase()
    if (!normalizedCandidate) continue
    for (const record of records) {
      const names = extractCategoryNames(record)
      if (!names.length) continue
      const isMatch = allowPartial
        ? names.some((name) => name.includes(normalizedCandidate) || normalizedCandidate.includes(name))
        : names.includes(normalizedCandidate)
      if (isMatch) return record
    }
  }
  return null
}

const loadLocalFileCategories = async (admin: TypedSupabaseClient): Promise<LocalFileCategoryRecord[]> => {
  const now = Date.now()
  if (cachedFileCategories && cachedFileCategories.expires > now) {
    return cachedFileCategories.data
  }

  for (const tableName of FILE_CATEGORY_TABLE_CANDIDATES) {
    try {
      const { data, error } = await admin.from(tableName).select('*')
      if (error) {
        const code = (error as { code?: string }).code
        const message = (error as { message?: string }).message || ''
        if (code === '42P01' || /does not exist/i.test(message)) {
          continue
        }
        logger.warn(
          { tableName, error: message || code || 'unknown' },
          'Failed to load file categories from Supabase table',
        )
        continue
      }
      if (Array.isArray(data) && data.length) {
        cachedFileCategories = {
          data: data as LocalFileCategoryRecord[],
          expires: now + FILE_CATEGORY_CACHE_TTL_MS,
        }
        return cachedFileCategories.data
      }
    } catch (err) {
      logger.warn(
        { tableName, error: err instanceof Error ? err.message : err },
        'Error loading file categories table',
      )
    }
  }

  cachedFileCategories = { data: [], expires: now + FILE_CATEGORY_CACHE_TTL_MS }
  return []
}

export async function uploadLeaseDocumentToBuildium(options: {
  admin: TypedSupabaseClient
  leaseId: string | number
  fileId: string
  fileName: string
  mimeType?: string
  base64: string
  category?: string | null
  buildiumCategoryId?: number | null
  orgId?: string
}): Promise<BuildiumFileSyncResult | null> {
  const {
    admin,
    leaseId,
    fileId,
    fileName,
    mimeType,
    base64,
    category,
    buildiumCategoryId,
    orgId
  } = options

  // Check for org-scoped Buildium credentials
  let resolvedOrgId = orgId
  if (!resolvedOrgId) {
    // Try to resolve orgId from lease
    const { data: leaseRow } = await admin
      .from('lease')
      .select('org_id')
      .eq('id', leaseId)
      .maybeSingle()
    resolvedOrgId = leaseRow?.org_id ?? undefined
  }

  const buildiumConfig = await getOrgScopedBuildiumConfig(resolvedOrgId)
  if (!buildiumConfig) {
    logger.warn({ orgId: resolvedOrgId }, 'Buildium credentials missing; skipping lease file sync')
    return null
  }

  try {
    const { data: leaseRow, error: leaseErr } = await admin
      .from('lease')
      .select('buildium_lease_id, buildium_unit_id, buildium_property_id')
      .eq('id', leaseId)
      .maybeSingle()

    if (leaseErr) throw leaseErr
    const buildiumLeaseIdRaw = leaseRow?.buildium_lease_id
    const buildiumLeaseId =
      typeof buildiumLeaseIdRaw === 'number' ? buildiumLeaseIdRaw : Number(buildiumLeaseIdRaw)
    if (!Number.isFinite(buildiumLeaseId) || buildiumLeaseId <= 0) {
      logger.warn({ leaseId, fileId }, 'Lease missing Buildium lease id; skipping Buildium file sync')
      return null
    }

    const buildiumUnitIdRaw = leaseRow?.buildium_unit_id
    const buildiumUnitId =
      typeof buildiumUnitIdRaw === 'number' ? buildiumUnitIdRaw : Number(buildiumUnitIdRaw)
    const buildiumPropertyIdRaw = leaseRow?.buildium_property_id
    const buildiumPropertyId =
      typeof buildiumPropertyIdRaw === 'number' ? buildiumPropertyIdRaw : Number(buildiumPropertyIdRaw)

    const buildiumClient = await getOrgScopedBuildiumClient(resolvedOrgId)

    const extractDocumentId = (entry: Record<string, unknown> | null | undefined): number | null => {
      if (!entry) return null
      const candidateKeys = ['DocumentId', 'DocumentID', 'Id', 'ID'] as const
      for (const key of candidateKeys) {
        const value = entry[key]
        if (typeof value === 'number' && Number.isFinite(value)) return value
        const coerced = Number(value)
        if (Number.isFinite(coerced)) return coerced
      }
      return null
    }

    const { data: fileRow, error: fileErr } = await admin
      .from('files')
      .select('id, file_name, description')
      .eq('id', fileId)
      .maybeSingle()

    if (fileErr) {
      logger.error(
        { leaseId: buildiumLeaseId, fileId, error: fileErr.message },
        'Lease file lookup failed before Buildium upload'
      )
      return { buildiumFile: null, error: 'Failed to load file record' }
    }
    if (!fileRow) {
      return { buildiumFile: null, error: 'File not found' }
    }

    const existingDocuments = (await buildiumClient
      .getLeaseDocuments(buildiumLeaseId)
      .catch(() => [])) as Array<Record<string, unknown>>
    const existingIds = new Set<number>()
    for (const entry of existingDocuments) {
      const id = extractDocumentId(entry)
      if (id != null) existingIds.add(id)
    }

    const uploadTitle =
      typeof fileRow.file_name === 'string' && fileRow.file_name.trim()
        ? fileRow.file_name
        : fileName

    const genericUploadPayload: UploadRequestPayload = {
      FileName: fileName,
      Title: uploadTitle
    }

    const descriptionValue =
      typeof fileRow.description === 'string' && fileRow.description.trim()
        ? fileRow.description.trim()
        : null
    if (descriptionValue) {
      genericUploadPayload.Description = descriptionValue
    }

    if (mimeType) {
      genericUploadPayload.ContentType = mimeType
    }

    const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : ''
    const candidateSet = new Set<string>()
    if (normalizedCategory) candidateSet.add(normalizedCategory)
    const aliasCandidates = CATEGORY_ALIAS_MAP[normalizedCategory]
    if (aliasCandidates) {
      aliasCandidates.forEach((alias) => candidateSet.add(alias.trim().toLowerCase()))
    }
    const candidateList = Array.from(candidateSet).filter(Boolean)
    const fallbackCandidates = ['lease documents', 'lease document', 'lease']

    const localCategories = await loadLocalFileCategories(admin)
    const leaseScopedCategories = localCategories.filter(matchesLeaseEntity)
    const categoriesWithId = leaseScopedCategories.filter(
      (record) => extractBuildiumCategoryId(record) !== null,
    )

    const providedCategoryId =
      typeof buildiumCategoryId === 'number' && Number.isFinite(buildiumCategoryId)
        ? buildiumCategoryId
        : null

    let categoryRecordWithId: LocalFileCategoryRecord | null = null
    let categoryId: number | null = providedCategoryId

    if (categoryId != null) {
      categoryRecordWithId =
        categoriesWithId.find(
          (record) => extractBuildiumCategoryId(record) === categoryId,
        ) ?? null
      if (!categoryRecordWithId) {
        categoryId = null
      }
    }

    if (!categoryRecordWithId && candidateList.length) {
      categoryRecordWithId = findMatchingRecord(categoriesWithId, candidateList, { allowPartial: false })
      if (categoryRecordWithId) {
        categoryId = extractBuildiumCategoryId(categoryRecordWithId)
      }
    }
    if (!categoryRecordWithId && candidateList.length) {
      categoryRecordWithId = findMatchingRecord(categoriesWithId, candidateList, { allowPartial: true })
      if (categoryRecordWithId && categoryId == null) {
        categoryId = extractBuildiumCategoryId(categoryRecordWithId)
      }
    }
    if (!categoryRecordWithId) {
      categoryRecordWithId = findMatchingRecord(categoriesWithId, fallbackCandidates, { allowPartial: false })
      if (categoryRecordWithId && categoryId == null) {
        categoryId = extractBuildiumCategoryId(categoryRecordWithId)
      }
    }
    if (!categoryRecordWithId) {
      categoryRecordWithId = findMatchingRecord(categoriesWithId, fallbackCandidates, { allowPartial: true })
      if (categoryRecordWithId && categoryId == null) {
        categoryId = extractBuildiumCategoryId(categoryRecordWithId)
      }
    }

    if (categoryId != null && !Number.isFinite(categoryId)) {
      categoryId = null
    }

    let categoryRecordForLabel: LocalFileCategoryRecord | null = categoryRecordWithId
    if (!categoryRecordForLabel && candidateList.length) {
      categoryRecordForLabel = findMatchingRecord(leaseScopedCategories, candidateList, { allowPartial: false })
    }
    if (!categoryRecordForLabel && candidateList.length) {
      categoryRecordForLabel = findMatchingRecord(leaseScopedCategories, candidateList, { allowPartial: true })
    }
    if (!categoryRecordForLabel) {
      categoryRecordForLabel = findMatchingRecord(leaseScopedCategories, fallbackCandidates, { allowPartial: false })
    }
    if (!categoryRecordForLabel) {
      categoryRecordForLabel = findMatchingRecord(leaseScopedCategories, fallbackCandidates, { allowPartial: true })
    }

    const resolvedCategoryLabel =
      (categoryRecordForLabel ? extractDisplayName(categoryRecordForLabel) : undefined) ||
      (typeof category === 'string' && category.trim()) ||
      'Lease Documents'

    if (categoryId != null && categoryId > 0) {
      genericUploadPayload.CategoryId = categoryId
    } else {
      categoryId = null
    }

    if (categoryId != null) {
      logger.debug(
        {
          leaseId: buildiumLeaseId,
          fileId,
          categoryId,
          categoryName: resolvedCategoryLabel
        },
        'Resolved Buildium file category for lease document upload'
      )
    } else {
      logger.debug(
        {
          leaseId: buildiumLeaseId,
          fileId,
          requestedCategory: typeof category === 'string' ? category : null
        },
        'No Buildium file category id found; falling back to lease-scoped upload',
      )
    }

    let ticket: BuildiumUploadTicket | null = null

    const shouldUseGenericUpload = categoryId != null

    if (shouldUseGenericUpload) {
      try {
        ticket = await buildiumClient.createFileUploadRequest(
          'Lease',
          buildiumLeaseId,
          genericUploadPayload,
        )
      } catch (primaryError) {
        logger.warn(
          {
            leaseId: buildiumLeaseId,
            fileId,
            error: primaryError instanceof Error ? primaryError.message : primaryError
          },
          'General Buildium file upload request failed; retrying with lease-scoped endpoint'
        )
      }
    } else {
      logger.debug(
        { leaseId: buildiumLeaseId, fileId },
        'Skipping Buildium general file upload endpoint due to missing category mapping',
      )
    }

    if (!ticket) {
      const leaseScopedPayload: UploadRequestPayload = {
        FileName: fileName,
        FileTitle: uploadTitle,
        ContentType: mimeType || 'application/octet-stream',
        Description: descriptionValue ?? '',
        Category: resolvedCategoryLabel,
        IsPrivate: true
      }

      if (Number.isFinite(buildiumPropertyId) && buildiumPropertyId > 0) {
        leaseScopedPayload.PropertyId = buildiumPropertyId
      }
      if (Number.isFinite(buildiumUnitId) && buildiumUnitId > 0) {
        leaseScopedPayload.UnitId = buildiumUnitId
      }

      ticket = await buildiumClient.createLeaseDocumentUploadRequest(
        buildiumLeaseId,
        leaseScopedPayload,
      )
    }

    if (!ticket) {
      throw new Error('Failed to obtain Buildium upload ticket')
    }

    const bucketUrl: string | undefined = ticket?.BucketUrl
    const ticketForm: Record<string, string> | undefined = ticket?.FormData
    if (!bucketUrl || !ticketForm) {
      throw new Error('Buildium upload ticket for lease missing bucket information')
    }

    const ticketFileId = extractBuildiumFileIdFromPayload(ticket)
    const ticketHref =
      typeof (ticket as Record<string, unknown>)?.Href === 'string'
        ? String(ticket.Href)
        : null

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
      throw new Error(`Buildium lease document upload failed: ${uploadResponse.status} ${errorText}`)
    }

    const locateUploadedDocument = async (): Promise<Record<string, unknown> | null> => {
      const attempts = 8
      for (let attempt = 0; attempt < attempts; attempt++) {
        const docs = (await buildiumClient
          .getLeaseDocuments(buildiumLeaseId)
          .catch(() => [])) as Array<Record<string, unknown>>
        for (const entry of docs) {
          const docId = extractDocumentId(entry)
          if (docId != null && !existingIds.has(docId)) {
            return entry
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      }
      return null
    }

    const buildiumFile = await locateUploadedDocument()
    const locatedDocumentId = buildiumFile ? extractDocumentId(buildiumFile) : null
    const buildiumDocumentId = locatedDocumentId ?? ticketFileId ?? null

    if (!buildiumDocumentId) {
      logger.warn(
        { leaseId: buildiumLeaseId, fileId },
        'Uploaded lease document to Buildium storage but could not confirm presence via API'
      )
      return { buildiumFile: null, error: 'File uploaded but Buildium did not return a document id yet' }
    }

    const buildiumHref =
      (buildiumFile && typeof (buildiumFile as { Href?: unknown }).Href === 'string'
        ? (buildiumFile as { Href: string }).Href
        : null) || ticketHref || null

    const updates: Record<string, unknown> = {
      buildium_file_id: buildiumDocumentId,
      buildium_href: buildiumHref,
      entity_type: FILE_ENTITY_TYPES.LEASES,
      entity_id: buildiumLeaseId
    }

    await admin.from('files').update(updates).eq('id', fileId)
    const { data: updatedFile } = await admin.from('files').select('*').eq('id', fileId).maybeSingle()

    logger.info(
      {
        leaseId: buildiumLeaseId,
        fileId,
        buildiumDocumentId
      },
      'Uploaded lease file to Buildium'
    )

    const buildiumFilePayload = buildiumFile ?? {
      Id: buildiumDocumentId,
      Href: ticketHref ?? undefined
    }

    return { buildiumFile: buildiumFilePayload, updatedFile }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Unknown error'
    const normalized = /404/i.test(rawMessage)
      ? 'Buildium lease not found. Sync this lease to Buildium before uploading documents.'
      : rawMessage
    logger.error({ error: rawMessage, leaseId, fileId }, 'Failed to upload lease file to Buildium')
    return { buildiumFile: null, error: normalized }
  }
}
