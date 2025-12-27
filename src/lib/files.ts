import type { SupabaseClient } from '@supabase/supabase-js';
import type { BuildiumFileEntityType } from '@/types/buildium';
import type { Database } from '@/types/database';

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

type FilesTable = Database['public']['Tables']['files'];
type FileCategoryTable = Database['public']['Tables']['file_categories'];

export type EntityTypeEnum = Database['public']['Enums']['files_entity_type_enum'];

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

const FILE_TO_BUILDIUM_ENTITY_TYPES: Record<EntityTypeEnum, BuildiumFileEntityType[]> = {
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

const BUILDIUM_TO_FILE_ENTITY_TYPE: Record<BuildiumFileEntityType, EntityTypeEnum> = {
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

export function mapFileEntityTypeToBuildium(entityType: EntityTypeEnum): BuildiumFileEntityType[] {
  return FILE_TO_BUILDIUM_ENTITY_TYPES[entityType] ?? ['Rental'];
}

export function mapBuildiumEntityTypeToFile(
  entityType: BuildiumFileEntityType | null | undefined,
): EntityTypeEnum {
  if (!entityType) {
    return FILE_ENTITY_TYPES.PROPERTIES;
  }
  return BUILDIUM_TO_FILE_ENTITY_TYPE[entityType] ?? FILE_ENTITY_TYPES.PROPERTIES;
}

const FILE_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveFileEntityFromRow<
  T extends {
    entity_type: string | null;
    entity_id: number | string | null;
    storage_key?: string | null;
  },
>(file: T): { entityType: EntityTypeEnum | null; entityId: number | string | null } {
  let entityType: EntityTypeEnum | null = null;
  let entityId: number | string | null = null;

  if (file.entity_type) {
    const normalized = normalizeEntityType(file.entity_type);
    if (normalized) {
      entityType = normalized;
      entityId = file.entity_id ?? null;
    }
  }

  if (!entityType && file.storage_key) {
    const storageKeyParts = file.storage_key.split('/');
    if (storageKeyParts.length >= 2) {
      const localEntityType = storageKeyParts[0];
      const localEntityId = storageKeyParts[1];

      const storageKeyToEntityType: Record<string, EntityTypeEnum> = {
        property: FILE_ENTITY_TYPES.PROPERTIES,
        unit: FILE_ENTITY_TYPES.UNITS,
        lease: FILE_ENTITY_TYPES.LEASES,
        tenant: FILE_ENTITY_TYPES.TENANTS,
        owner: FILE_ENTITY_TYPES.RENTAL_OWNERS,
        vendor: FILE_ENTITY_TYPES.VENDORS,
      };

      entityType = storageKeyToEntityType[localEntityType] ?? null;

      if (
        localEntityId &&
        (FILE_UUID_REGEX.test(localEntityId) ||
          Number.isFinite(Number(localEntityId)))
      ) {
        if (localEntityType === 'unit' || localEntityType === 'property') {
          entityId = localEntityId;
        } else {
          entityId = Number.isFinite(Number(localEntityId))
            ? Number(localEntityId)
            : localEntityId;
        }
      }
    }
  }

  return { entityType, entityId };
}

type FileInsert = FilesTable['Insert'];
type FileRowBase = FilesTable['Row'];

export type FileRow = FileRowBase & {
  buildium_entity_type?: BuildiumFileEntityType | null;
  buildium_entity_id?: number | null;
};

type FileInsertWithExtras = FileInsert & {
  buildium_entity_type?: BuildiumFileEntityType | null;
  buildium_entity_id?: number | null;
};

// File category row matching file_categories table
export type FileCategoryRow = FileCategoryTable['Row'];

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
  client: SupabaseClient<Database>,
  orgId: string,
  entityTypeInput: EntityTypeEnum | BuildiumFileEntityType | string,
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

  let lastError: unknown = null;
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
        `Failed to fetch files: ${(error as { message?: string } | null)?.message || 'Unknown error'}`,
      ) as Error & { originalError?: unknown; context?: Record<string, unknown> };
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

  console.warn(
    'Files lookup failed for all entity_type attempts; returning empty list',
    {
      orgId,
      entityType: normalizedEntityType,
      rawEntityType: entityTypeInput,
      fallbackType,
      entityId,
      lastError: (lastError as { message?: string } | null)?.message,
    },
  );
  return [];
}

/**
 * Get all file categories for an organization
 */
export async function getFileCategories(
  client: SupabaseClient<Database>,
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
export async function getFileById(
  client: SupabaseClient<Database>,
  fileId: string,
): Promise<FileRow | null> {
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
  client: SupabaseClient<Database>,
  fileData: {
    org_id: string;
    file_name: string;
    title: string;
    description?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
    entity_type: EntityTypeEnum;
    entity_id: number;
    buildium_entity_type?: BuildiumFileEntityType | null;
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

  let lastError: unknown = null;
  for (let index = 0; index < entityTypesToTry.length; index++) {
    const typeToInsert = entityTypesToTry[index];
    const basePayload: FileInsertWithExtras = {
      ...fileData,
      entity_type: typeToInsert,
      is_private: fileData.is_private ?? true,
      storage_provider: fileData.storage_provider ?? 'supabase',
    };

    const preparePayload = (withBuildium: boolean): FileInsert | FileInsertWithExtras => {
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
      return payloadWithBuildium as FileInsertWithExtras;
    };

    const attemptInsert = async (withBuildium: boolean) =>
      client
        .from('files')
        .insert(preparePayload(withBuildium) as FileInsert)
        .select()
        .single();

    let data: FileRow | null = null;
    let error: unknown = null;

    if (shouldAttemptBuildiumColumns) {
      const response = await attemptInsert(buildiumEntityColumnsSupported !== false);
      data = (response.data as FileRow | null) ?? null;
      error = response.error;

      if (
        error &&
        isMissingBuildiumColumnsError(error as { message?: string; details?: string; hint?: string })
      ) {
        buildiumEntityColumnsSupported = false;
        const fallbackResponse = await attemptInsert(false);
        data = (fallbackResponse.data as FileRow | null) ?? null;
        error = fallbackResponse.error;
      } else if (!error && buildiumEntityColumnsSupported === null) {
        buildiumEntityColumnsSupported = true;
      }
    } else {
      const response = await attemptInsert(false);
      data = (response.data as FileRow | null) ?? null;
      error = response.error;
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
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  const fallbackError =
    lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? 'Failed to create file record'));
  throw fallbackError;
}

/**
 * Update an existing file record
 */
export async function updateFile(
  client: SupabaseClient<Database>,
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
export async function deleteFile(client: SupabaseClient<Database>, fileId: string): Promise<void> {
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
  client: SupabaseClient<Database>,
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
