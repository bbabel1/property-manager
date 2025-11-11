import { createClient } from '@supabase/supabase-js';
import type { BuildiumEntityType } from '@/types/buildium';

type SupabaseClient = ReturnType<typeof createClient<any>> | any;

export const FILE_ENTITY_TYPES = {
  PROPERTIES: 'Properties',
  UNITS: 'Units',
  LEASES: 'Leases',
  TENANTS: 'Tenants',
  RENTAL_OWNERS: 'Rental Owners',
  ASSOCIATIONS: 'Associations',
  ASSOCIATION_OWNERS: 'Association Owners',
  ASSOCIATION_UNITS: 'Association Units',
  OWNERSHIP_ACCOUNTS: 'Ownership Accounts',
  ACCOUNTS: 'Accounts',
  VENDORS: 'Vendors',
} as const;

export type EntityTypeEnum = (typeof FILE_ENTITY_TYPES)[keyof typeof FILE_ENTITY_TYPES];

const ENTITY_TYPE_NORMALIZATION: Record<string, EntityTypeEnum> = {
  [FILE_ENTITY_TYPES.PROPERTIES]: FILE_ENTITY_TYPES.PROPERTIES,
  Rental: FILE_ENTITY_TYPES.PROPERTIES,
  PublicAsset: FILE_ENTITY_TYPES.PROPERTIES,
  [FILE_ENTITY_TYPES.UNITS]: FILE_ENTITY_TYPES.UNITS,
  RentalUnit: FILE_ENTITY_TYPES.UNITS,
  [FILE_ENTITY_TYPES.LEASES]: FILE_ENTITY_TYPES.LEASES,
  Lease: FILE_ENTITY_TYPES.LEASES,
  [FILE_ENTITY_TYPES.TENANTS]: FILE_ENTITY_TYPES.TENANTS,
  Tenant: FILE_ENTITY_TYPES.TENANTS,
  [FILE_ENTITY_TYPES.RENTAL_OWNERS]: FILE_ENTITY_TYPES.RENTAL_OWNERS,
  RentalOwner: FILE_ENTITY_TYPES.RENTAL_OWNERS,
  [FILE_ENTITY_TYPES.ASSOCIATIONS]: FILE_ENTITY_TYPES.ASSOCIATIONS,
  Association: FILE_ENTITY_TYPES.ASSOCIATIONS,
  [FILE_ENTITY_TYPES.ASSOCIATION_OWNERS]: FILE_ENTITY_TYPES.ASSOCIATION_OWNERS,
  AssociationOwner: FILE_ENTITY_TYPES.ASSOCIATION_OWNERS,
  [FILE_ENTITY_TYPES.ASSOCIATION_UNITS]: FILE_ENTITY_TYPES.ASSOCIATION_UNITS,
  AssociationUnit: FILE_ENTITY_TYPES.ASSOCIATION_UNITS,
  [FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS]: FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS,
  OwnershipAccount: FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS,
  [FILE_ENTITY_TYPES.ACCOUNTS]: FILE_ENTITY_TYPES.ACCOUNTS,
  Account: FILE_ENTITY_TYPES.ACCOUNTS,
  [FILE_ENTITY_TYPES.VENDORS]: FILE_ENTITY_TYPES.VENDORS,
  Vendor: FILE_ENTITY_TYPES.VENDORS,
};

const FILE_TO_BUILDIUM_ENTITY_TYPES: Record<EntityTypeEnum, BuildiumEntityType[]> = {
  [FILE_ENTITY_TYPES.PROPERTIES]: ['Rental', 'PublicAsset'],
  [FILE_ENTITY_TYPES.UNITS]: ['RentalUnit'],
  [FILE_ENTITY_TYPES.LEASES]: ['Lease'],
  [FILE_ENTITY_TYPES.TENANTS]: ['Tenant'],
  [FILE_ENTITY_TYPES.RENTAL_OWNERS]: ['RentalOwner'],
  [FILE_ENTITY_TYPES.ASSOCIATIONS]: ['Association'],
  [FILE_ENTITY_TYPES.ASSOCIATION_OWNERS]: ['AssociationOwner'],
  [FILE_ENTITY_TYPES.ASSOCIATION_UNITS]: ['AssociationUnit'],
  [FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS]: ['OwnershipAccount'],
  [FILE_ENTITY_TYPES.ACCOUNTS]: ['Account'],
  [FILE_ENTITY_TYPES.VENDORS]: ['Vendor'],
};

const BUILDIUM_TO_FILE_ENTITY_TYPE: Record<BuildiumEntityType, EntityTypeEnum> = {
  Rental: FILE_ENTITY_TYPES.PROPERTIES,
  PublicAsset: FILE_ENTITY_TYPES.PROPERTIES,
  RentalUnit: FILE_ENTITY_TYPES.UNITS,
  Lease: FILE_ENTITY_TYPES.LEASES,
  Tenant: FILE_ENTITY_TYPES.TENANTS,
  RentalOwner: FILE_ENTITY_TYPES.RENTAL_OWNERS,
  Association: FILE_ENTITY_TYPES.ASSOCIATIONS,
  AssociationOwner: FILE_ENTITY_TYPES.ASSOCIATION_OWNERS,
  AssociationUnit: FILE_ENTITY_TYPES.ASSOCIATION_UNITS,
  OwnershipAccount: FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS,
  Account: FILE_ENTITY_TYPES.ACCOUNTS,
  Vendor: FILE_ENTITY_TYPES.VENDORS,
};

const ENTITY_TYPE_FALLBACKS: Partial<Record<EntityTypeEnum, EntityTypeEnum>> = {
  [FILE_ENTITY_TYPES.LEASES]: FILE_ENTITY_TYPES.PROPERTIES,
  [FILE_ENTITY_TYPES.UNITS]: FILE_ENTITY_TYPES.PROPERTIES,
  [FILE_ENTITY_TYPES.TENANTS]: FILE_ENTITY_TYPES.PROPERTIES,
  [FILE_ENTITY_TYPES.ASSOCIATION_UNITS]: FILE_ENTITY_TYPES.ASSOCIATIONS,
  [FILE_ENTITY_TYPES.ASSOCIATION_OWNERS]: FILE_ENTITY_TYPES.ASSOCIATIONS,
  [FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS]: FILE_ENTITY_TYPES.ACCOUNTS,
  [FILE_ENTITY_TYPES.RENTAL_OWNERS]: FILE_ENTITY_TYPES.ACCOUNTS,
  [FILE_ENTITY_TYPES.VENDORS]: FILE_ENTITY_TYPES.ACCOUNTS,
};

export function normalizeEntityType(entityType: string | null | undefined): EntityTypeEnum | null {
  if (!entityType) return null;
  return ENTITY_TYPE_NORMALIZATION[entityType] ?? null;
}

export function mapFileEntityTypeToBuildium(entityType: EntityTypeEnum): BuildiumEntityType[] {
  return FILE_TO_BUILDIUM_ENTITY_TYPES[entityType] ?? ['Rental'];
}

export function mapBuildiumEntityTypeToFile(
  entityType: BuildiumEntityType | null | undefined,
): EntityTypeEnum {
  if (!entityType) {
    return FILE_ENTITY_TYPES.PROPERTIES;
  }
  return BUILDIUM_TO_FILE_ENTITY_TYPE[entityType] ?? FILE_ENTITY_TYPES.PROPERTIES;
}

// File row matching new simplified files table
export interface FileRow {
  id: string;
  org_id: string;
  file_name: string;
  title: string;
  description: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  entity_type: EntityTypeEnum;
  entity_id: number;
  buildium_entity_type?: BuildiumEntityType | null;
  buildium_entity_id?: number | null;
  buildium_category_id: number | null;
  storage_provider: string | null;
  bucket: string | null;
  storage_key: string | null;
  external_url: string | null;
  buildium_file_id: number | null;
  buildium_href: string | null;
  is_private: boolean;
  sha256: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// File category row matching file_categories table
export interface FileCategoryRow {
  id: string;
  org_id: string;
  category_name: string;
  buildium_category_id: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function getEntityTypeFallback(entityType: EntityTypeEnum): EntityTypeEnum | null {
  return ENTITY_TYPE_FALLBACKS[entityType] ?? null;
}

let buildiumEntityColumnsSupported: boolean | null = null;

const isMissingBuildiumColumnsError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? ((error as { message?: string }).message ?? '')
      : '';
  const details =
    typeof (error as { details?: unknown }).details === 'string'
      ? ((error as { details?: string }).details ?? '')
      : '';
  const hint =
    typeof (error as { hint?: unknown }).hint === 'string'
      ? ((error as { hint?: string }).hint ?? '')
      : '';
  return [message, details, hint].some(
    (text) => text.includes('buildium_entity_id') || text.includes('buildium_entity_type'),
  );
};

function isUnsupportedEntityTypeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  const message = (error as { message?: unknown }).message;
  return (
    code === '22P02' &&
    typeof message === 'string' &&
    (message.includes('entity_type_enum') || message.includes('files_entity_type_enum'))
  );
}

/**
 * Get files for a specific entity (by entity_type and entity_id)
 */
export async function getFilesByEntity(
  client: SupabaseClient,
  orgId: string,
  entityTypeInput: EntityTypeEnum | BuildiumEntityType | string,
  entityId: number,
): Promise<FileRow[]> {
  // Validate inputs
  if (!orgId) {
    throw new Error('getFilesByEntity: orgId is required');
  }
  if (!entityTypeInput) {
    throw new Error('getFilesByEntity: entityType is required');
  }
  if (!Number.isFinite(entityId)) {
    throw new Error(`getFilesByEntity: entityId must be a finite number, got ${entityId}`);
  }

  const normalizedEntityType = normalizeEntityType(entityTypeInput);
  if (!normalizedEntityType) {
    throw new Error(`getFilesByEntity: unsupported entityType "${entityTypeInput}"`);
  }

  const entityTypesToTry: EntityTypeEnum[] = [normalizedEntityType];
  const fallbackType = getEntityTypeFallback(normalizedEntityType);
  if (fallbackType && fallbackType !== normalizedEntityType) {
    entityTypesToTry.push(fallbackType);
  }

  let lastError: any = null;
  for (let index = 0; index < entityTypesToTry.length; index++) {
    const typeToQuery = entityTypesToTry[index];
    const { data, error } = await client
      .from('files')
      .select('*')
      .eq('org_id', orgId)
      .eq('entity_type', typeToQuery)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!error) {
      if (index > 0) {
        console.info('Files lookup used fallback entity_type due to legacy schema', {
          orgId,
          requestedType: normalizedEntityType,
          fallbackType: typeToQuery,
          entityId,
        });
      }
      return (data || []) as FileRow[];
    }

    lastError = error;
    const unsupported = isUnsupportedEntityTypeError(error);
    const isLastAttempt = index === entityTypesToTry.length - 1;

    if (!unsupported) {
      const enhancedError = new Error(
        `Failed to fetch files: ${error.message || 'Unknown error'}`,
      ) as Error & { originalError?: any; context?: any };
      enhancedError.originalError = error;
      enhancedError.context = {
        orgId,
        entityType: normalizedEntityType,
        rawEntityType: entityTypeInput,
        entityId,
        attemptedType: typeToQuery,
      };
      throw enhancedError;
    }

    if (unsupported && !isLastAttempt) {
      continue;
    }
  }

  console.warn('Files lookup failed for all entity_type attempts; returning empty list', {
    orgId,
    entityType: normalizedEntityType,
    rawEntityType: entityTypeInput,
    fallbackType,
    entityId,
    lastError: lastError?.message,
  });
  return [];
}

/**
 * Get all file categories for an organization
 */
export async function getFileCategories(
  client: SupabaseClient,
  orgId: string,
  includeInactive = false,
): Promise<FileCategoryRow[]> {
  let query = client.from('file_categories').select('*').eq('org_id', orgId);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('category_name', { ascending: true });

  if (error) throw error;
  return (data || []) as FileCategoryRow[];
}

/**
 * Get a single file by ID
 */
export async function getFileById(client: SupabaseClient, fileId: string): Promise<FileRow | null> {
  const { data, error } = await client
    .from('files')
    .select('*')
    .eq('id', fileId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as FileRow;
}

/**
 * Create a new file record
 */
export async function createFile(
  client: SupabaseClient,
  fileData: {
    org_id: string;
    file_name: string;
    title: string;
    description?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
    entity_type: EntityTypeEnum;
    entity_id: number;
    buildium_entity_type?: BuildiumEntityType | null;
    buildium_entity_id?: number | null;
    buildium_category_id?: number | null;
    storage_provider?: string;
    bucket?: string | null;
    storage_key?: string | null;
    external_url?: string | null;
    buildium_file_id?: number | null;
    buildium_href?: string | null;
    is_private?: boolean;
    sha256?: string | null;
    created_by?: string | null;
  },
): Promise<FileRow> {
  const entityTypesToTry: EntityTypeEnum[] = [fileData.entity_type];
  const fallbackType = getEntityTypeFallback(fileData.entity_type);
  if (fallbackType && fallbackType !== fileData.entity_type) {
    entityTypesToTry.push(fallbackType);
  }

  const shouldAttemptBuildiumColumns =
    buildiumEntityColumnsSupported !== false &&
    (fileData.buildium_entity_type !== undefined || fileData.buildium_entity_id !== undefined);

  let lastError: any = null;
  for (let index = 0; index < entityTypesToTry.length; index++) {
    const typeToInsert = entityTypesToTry[index];
    const basePayload = {
      ...fileData,
      entity_type: typeToInsert,
      is_private: fileData.is_private ?? true,
      storage_provider: fileData.storage_provider ?? 'supabase',
    };

    const preparePayload = (withBuildium: boolean) => {
      const {
        buildium_entity_type,
        buildium_entity_id,
        ...rest
      } = basePayload;
      if (!withBuildium) {
        return rest;
      }
      const payloadWithBuildium: Record<string, unknown> = { ...rest };
      if (buildium_entity_type !== undefined) {
        payloadWithBuildium.buildium_entity_type = buildium_entity_type ?? null;
      }
      if (buildium_entity_id !== undefined) {
        payloadWithBuildium.buildium_entity_id = buildium_entity_id ?? null;
      }
      return payloadWithBuildium;
    };

    const attemptInsert = async (withBuildium: boolean) =>
      client.from('files').insert(preparePayload(withBuildium)).select().single();

    let data: any;
    let error: any;

    if (shouldAttemptBuildiumColumns) {
      ({ data, error } = await attemptInsert(buildiumEntityColumnsSupported !== false));

      if (error && isMissingBuildiumColumnsError(error)) {
        buildiumEntityColumnsSupported = false;
        ({ data, error } = await attemptInsert(false));
      } else if (!error && buildiumEntityColumnsSupported === null) {
        buildiumEntityColumnsSupported = true;
      }
    } else {
      ({ data, error } = await attemptInsert(false));
    }

    if (!error) {
      if (index > 0) {
        console.info('Inserted file row using fallback entity_type due to legacy schema', {
          requestedType: fileData.entity_type,
          fallbackType: typeToInsert,
          entityId: fileData.entity_id,
          orgId: fileData.org_id,
        });
      }
      return data as FileRow;
    }

    lastError = error;
    const unsupported = isUnsupportedEntityTypeError(error);
    const isLastAttempt = index === entityTypesToTry.length - 1;

    if (!unsupported || isLastAttempt) {
      throw error;
    }
  }

  throw lastError ?? new Error('Failed to create file record');
}

/**
 * Update an existing file record
 */
export async function updateFile(
  client: SupabaseClient,
  fileId: string,
  updates: Partial<{
    file_name: string;
    title: string;
    description: string | null;
    buildium_category_id: number | null;
    is_private: boolean;
    deleted_at: string | null;
  }>,
): Promise<FileRow> {
  const { data, error } = await client
    .from('files')
    .update(updates)
    .eq('id', fileId)
    .select()
    .single();

  if (error) throw error;
  return data as FileRow;
}

/**
 * Soft delete a file (set deleted_at)
 */
export async function deleteFile(client: SupabaseClient, fileId: string): Promise<void> {
  const { error } = await client
    .from('files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fileId);

  if (error) throw error;
}

/**
 * Get or create a file category by Buildium category ID
 */
export async function getOrCreateFileCategory(
  client: SupabaseClient,
  orgId: string,
  buildiumCategoryId: number,
  categoryData: {
    category_name: string;
    description?: string | null;
  },
): Promise<FileCategoryRow> {
  // Try to find existing category
  const { data: existing } = await client
    .from('file_categories')
    .select('*')
    .eq('org_id', orgId)
    .eq('buildium_category_id', buildiumCategoryId)
    .single();

  if (existing) {
    return existing as FileCategoryRow;
  }

  // Create new category
  const { data, error } = await client
    .from('file_categories')
    .insert({
      org_id: orgId,
      buildium_category_id: buildiumCategoryId,
      ...categoryData,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as FileCategoryRow;
}
