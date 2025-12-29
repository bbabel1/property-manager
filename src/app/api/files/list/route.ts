import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { supabaseAdminMaybe, type TypedSupabaseClient } from '@/lib/db';
import {
  FILE_ENTITY_TYPES,
  normalizeEntityType,
  resolveFileEntityFromRow,
  type EntityTypeEnum,
} from '@/lib/files';
import type { Database } from '@/types/database';

type MinimalUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

type FileRow = Database['public']['Tables']['files']['Row'];
type ContactRow = Pick<
  Database['public']['Tables']['contacts']['Row'],
  | 'id'
  | 'display_name'
  | 'first_name'
  | 'last_name'
  | 'company_name'
  | 'primary_email'
  | 'primary_phone'
>;
type FileCategoryRow = Pick<
  Database['public']['Tables']['file_categories']['Row'],
  'id' | 'buildium_category_id' | 'category_name'
>;
type PropertyRow = Pick<
  Database['public']['Tables']['properties']['Row'],
  | 'id'
  | 'name'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'property_type'
  | 'buildium_property_id'
> & { address_line_1?: string | null };
type UnitRow = Pick<
  Database['public']['Tables']['units']['Row'],
  'id' | 'unit_number' | 'property_id' | 'buildium_unit_id' | 'buildium_property_id'
>;
type LeaseRow = Pick<
  Database['public']['Tables']['lease']['Row'],
  | 'id'
  | 'buildium_lease_id'
  | 'property_id'
  | 'unit_id'
  | 'buildium_property_id'
  | 'buildium_unit_id'
  | 'status'
>;
type TenantRow = {
  id: string;
  buildium_tenant_id: number | null;
  contact?: ContactRow | null;
};
type OwnerRow = Pick<
  Database['public']['Tables']['owners']['Row'],
  'id' | 'buildium_owner_id' | 'contact_id'
>;
type VendorRow = {
  id: string;
  buildium_vendor_id: number | null;
  contact?: ContactRow | null;
};

type FileWithResolvedEntity = Omit<FileRow, 'entity_type' | 'entity_id'> & {
  entity_type: EntityTypeEnum;
  entity_id: number | string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTITY_FILTER_MAP: Record<string, EntityTypeEnum[]> = {
  property: [FILE_ENTITY_TYPES.PROPERTIES],
  unit: [FILE_ENTITY_TYPES.UNITS],
  association: [FILE_ENTITY_TYPES.ASSOCIATIONS],
  associationUnit: [FILE_ENTITY_TYPES.ASSOCIATION_UNITS],
  lease: [FILE_ENTITY_TYPES.LEASES],
  tenant: [FILE_ENTITY_TYPES.TENANTS],
  owner: [FILE_ENTITY_TYPES.RENTAL_OWNERS],
  associationOwner: [FILE_ENTITY_TYPES.ASSOCIATION_OWNERS],
  ownershipAccount: [FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS],
  vendor: [FILE_ENTITY_TYPES.VENDORS],
  account: [FILE_ENTITY_TYPES.ACCOUNTS],
};

async function resolveOrgId(
  request: NextRequest,
  supabase: TypedSupabaseClient,
  user: MinimalUser,
): Promise<string> {
  const isValidUUID = (str: string): boolean => UUID_REGEX.test(str);

  const membershipCandidateUserIds = new Set<string>();
  const addCandidateUserId = (value: unknown) => {
    if (typeof value === 'string' && isValidUUID(value)) {
      membershipCandidateUserIds.add(value);
    }
  };

  addCandidateUserId(user?.id);

  const adminClient = supabaseAdminMaybe ?? supabase;

  const normalizeOrgId = (value: unknown): string | null => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  };

  const pickFirstOrgId = (...values: unknown[]): string | null => {
    for (const value of values) {
      const normalized = normalizeOrgId(value);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  };

  const claimOrgIds = new Set<string>();
  const addClaimOrgIds = (values: unknown[]) => {
    for (const value of values) {
      const normalized = normalizeOrgId(value);
      if (normalized) {
        claimOrgIds.add(normalized);
      }
    }
  };

  let orgId: string | null =
    request.headers.get('x-org-id') || request.cookies.get('x-org-id')?.value || null;

  let headerUser: Record<string, unknown> | null = null;
  const encodedHeader = request.headers.get('x-auth-user');
  if (encodedHeader) {
    try {
      headerUser = JSON.parse(decodeURIComponent(encodedHeader)) as Record<string, unknown>;
    } catch (error) {
      console.warn('Failed to parse x-auth-user header while resolving org context', error);
    }
  }
  addCandidateUserId(headerUser?.['id']);

  const headerAppMeta = headerUser?.app_metadata as Record<string, unknown> | undefined;
  const headerUserMeta = headerUser?.user_metadata as Record<string, unknown> | undefined;
  const headerClaims =
    headerAppMeta && typeof headerAppMeta['claims'] === 'object'
      ? (headerAppMeta['claims'] as Record<string, unknown>)
      : undefined;
  const headerClaimOrgIds = Array.isArray(headerClaims?.['org_ids'])
    ? (headerClaims['org_ids'] as unknown[])
    : [];
  const headerUserOrgIds = Array.isArray(headerUserMeta?.['org_ids'])
    ? (headerUserMeta['org_ids'] as unknown[])
    : [];
  const userMeta = (user.user_metadata ?? undefined) as Record<string, unknown> | undefined;
  const userOrgIds = Array.isArray(userMeta?.['org_ids']) ? (userMeta['org_ids'] as unknown[]) : [];
  const userAppMeta = (user.app_metadata ?? undefined) as Record<string, unknown> | undefined;
  const userAppClaims =
    userAppMeta && typeof userAppMeta['claims'] === 'object'
      ? (userAppMeta['claims'] as Record<string, unknown>)
      : undefined;
  const userAppClaimOrgIds = Array.isArray(userAppClaims?.['org_ids'])
    ? (userAppClaims['org_ids'] as unknown[])
    : [];
  const userAppOrgIds = Array.isArray(userAppMeta?.['org_ids'])
    ? (userAppMeta['org_ids'] as unknown[])
    : [];

  addClaimOrgIds([
    headerUserMeta?.default_org_id,
    headerAppMeta?.default_org_id,
    userMeta?.default_org_id,
    userAppMeta?.default_org_id,
    headerUserMeta?.org_id,
    userMeta?.org_id,
    userAppMeta?.org_id,
  ]);
  addClaimOrgIds(headerClaimOrgIds);
  addClaimOrgIds(headerUserOrgIds);
  addClaimOrgIds(userOrgIds);
  addClaimOrgIds(userAppClaimOrgIds);
  addClaimOrgIds(userAppOrgIds);

  if (!orgId) {
    orgId =
      pickFirstOrgId(
        headerUserMeta?.default_org_id,
        headerAppMeta?.default_org_id,
        userMeta?.default_org_id,
        userAppMeta?.default_org_id,
        headerUserMeta?.org_id,
        userMeta?.org_id,
        userAppMeta?.org_id,
        ...headerClaimOrgIds,
        ...headerUserOrgIds,
        ...userOrgIds,
        ...userAppClaimOrgIds,
        ...userAppOrgIds,
      ) ?? null;
  }

  if (!orgId && isValidUUID(user.id)) {
    // Only query org_memberships if user.id is a valid UUID
    const { data: rows } = await adminClient
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);
    orgId = normalizeOrgId(rows?.[0]?.org_id);
  }

  // If user.id is not a valid UUID, try to look up user by email if available
  // This can happen if authentication is not properly configured
  if (!orgId && !isValidUUID(user.id) && user.email && supabaseAdminMaybe) {
    // Try to find the real user by email using users_with_auth view
    // This view joins auth.users with profiles and org_memberships
    try {
      const { data: userRow, error: userLookupError } = await (supabaseAdminMaybe as any)
        .from('users_with_auth')
        .select('user_id, memberships')
        .eq('email', user.email)
        .maybeSingle();

      type UserWithAuthRow = {
        user_id?: string;
        memberships?: Array<{ org_id?: string; role?: string }>;
      };

      const typedUserRow = userRow as UserWithAuthRow | null;

      if (userLookupError) {
        console.warn('Failed to resolve user via users_with_auth', userLookupError);
      }
      if (typedUserRow?.user_id) {
        addCandidateUserId(typedUserRow.user_id);
      }

      // Extract org_ids from memberships array
      const orgIdsFromMemberships =
        typedUserRow?.memberships
          ?.map((m: { org_id?: string; role?: string }) => m.org_id)
          .filter(
            (id: string | undefined): id is string =>
              typeof id === 'string' && id.trim().length > 0,
          ) ?? [];

      if (orgIdsFromMemberships.length > 0) {
        // Use the first org_id from the user's memberships
        orgId = normalizeOrgId(orgIdsFromMemberships[0]);
        addClaimOrgIds(orgIdsFromMemberships);
      } else if (typedUserRow?.user_id && isValidUUID(typedUserRow.user_id)) {
        // If we found the user but no memberships, try to get org from org_memberships directly
        const { data: membershipRows } = await supabaseAdminMaybe
          .from('org_memberships')
          .select('org_id')
          .eq('user_id', typedUserRow.user_id)
          .order('created_at', { ascending: true })
          .limit(1);
        orgId = normalizeOrgId(membershipRows?.[0]?.org_id);
      }
    } catch (emailLookupError) {
      // Silently fail and fall through to first org fallback
      console.warn('Failed to look up user by email:', emailLookupError);
    }
  }

  if (!orgId && process.env.NODE_ENV !== 'production') {
    const { data: orgRow } = await adminClient
      .from('organizations')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = normalizeOrgId(orgRow?.id);
  }

  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED');

  const verifyMembership = async (candidateOrgId: string): Promise<boolean> => {
    if (claimOrgIds.has(candidateOrgId)) {
      return true;
    }

    if (!membershipCandidateUserIds.size) {
      return false;
    }

    for (const candidateUserId of membershipCandidateUserIds) {
      try {
        const { data: existingMembership, error } = await adminClient
          .from('org_memberships')
          .select('user_id')
          .eq('org_id', candidateOrgId)
          .eq('user_id', candidateUserId)
          .maybeSingle();

        if (error) {
          console.warn('Failed to verify org membership while resolving org context', {
            error,
            orgId: candidateOrgId,
            userId: candidateUserId,
          });
          continue;
        }

        if (existingMembership) {
          return true;
        }
      } catch (membershipError) {
        console.warn('Failed to verify org membership while resolving org context', {
          error: membershipError,
          orgId: candidateOrgId,
          userId: candidateUserId,
        });
      }
    }

    return false;
  };

  const hasMembership = await verifyMembership(orgId);
  if (!hasMembership) {
    throw new Error('ORG_FORBIDDEN');
  }

  return orgId;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const cookieClient = (await getSupabaseServerClient()) as unknown as TypedSupabaseClient;
    // Use admin client in non-production if available for better debugging
    const supabase: TypedSupabaseClient =
      process.env.NODE_ENV !== 'production' && supabaseAdminMaybe
        ? supabaseAdminMaybe
        : cookieClient;
    const url = new URL(request.url);

    const orgId = await resolveOrgId(request, supabase, user);

    // Query parameters
    const entityType = url.searchParams.get('entityType');
    const categoryId = url.searchParams.get('categoryId');
    const search = url.searchParams.get('search');
    const fileType = url.searchParams.get('fileType');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    const filterEntityTypes = entityType ? (ENTITY_FILTER_MAP[entityType] ?? null) : null;
    if (entityType && (!filterEntityTypes || filterEntityTypes.length === 0)) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    let filterBuildiumCategoryId: number | null = null;
    let categoryFilterProvidedButUnmapped = false;
    let categoryFilterMatchesNull = false;

    if (categoryId) {
      try {
        const { data: categoryRow, error: categoryLookupError } = await supabase
          .from('file_categories')
          .select('id, buildium_category_id')
          .eq('org_id', orgId)
          .eq('id', categoryId)
          .maybeSingle();
        if (categoryLookupError) {
          console.error('Failed to resolve category for filter:', {
            error: categoryLookupError,
            categoryId,
            orgId,
          });
        } else if (!categoryRow) {
          categoryFilterProvidedButUnmapped = true;
        } else if (categoryRow.buildium_category_id != null) {
          filterBuildiumCategoryId = Number(categoryRow.buildium_category_id);
        } else {
          // Category exists but is not linked to a Buildium category ID
          categoryFilterMatchesNull = true;
        }
      } catch (lookupError) {
        console.error('Unexpected error resolving category filter:', lookupError);
        categoryFilterProvidedButUnmapped = true;
      }
    }

    if (categoryFilterProvidedButUnmapped && categoryId) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Base query against files table
    let query = supabase
      .from('files')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .is('deleted_at', null);

    // Entity type filtering using the dedicated enum column
    if (filterEntityTypes?.length) {
      const normalizedFilters = filterEntityTypes
        .map((type) => normalizeEntityType(type))
        .filter((type): type is EntityTypeEnum => Boolean(type));

      if (normalizedFilters.length === 1) {
        query = query.eq('entity_type', normalizedFilters[0]);
      } else if (normalizedFilters.length > 1) {
        query = query.in('entity_type', normalizedFilters);
      }
    }

    if (filterBuildiumCategoryId !== null) {
      query = query.eq('buildium_category_id', filterBuildiumCategoryId);
    } else if (categoryFilterMatchesNull) {
      query = query.is('buildium_category_id', null);
    }

    if (search) {
      query = query.or(`file_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // File type filtering
    if (fileType) {
      switch (fileType) {
        case 'pdf':
          query = query.ilike('mime_type', '%pdf%');
          break;
        case 'image':
          query = query.ilike('mime_type', 'image/%');
          break;
        case 'document':
          query = query.or(
            `mime_type.ilike.%word%,mime_type.ilike.%document%,mime_type.ilike.%text%`,
          );
          break;
        case 'spreadsheet':
          query = query.or(
            `mime_type.ilike.%excel%,mime_type.ilike.%spreadsheet%,mime_type.ilike.%csv%`,
          );
          break;
      }
    }

    // Date range filtering
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      // Add one day to include the entire day
      const dateToEnd = new Date(dateTo);
      dateToEnd.setDate(dateToEnd.getDate() + 1);
      query = query.lt('created_at', dateToEnd.toISOString());
    }

    // Note: Total count will be calculated after filtering

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: files, error, count } = await query;

    if (error) {
      console.error('Error fetching files:', error);
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
    }

    const filesList: FileRow[] = files ?? [];

    // Note: file_links table was dropped in migration 20251103000000_143_consolidate_file_storage.sql
    // Entity info is now stored directly in files.entity_type and files.entity_id columns

    const categoryIds = new Set<number>();
    const propertyIds = new Set<number>();
    const unitIds = new Set<number>();
    const leaseIds = new Set<number>();
    const tenantIds = new Set<number>();
    const ownerIds = new Set<number>();
    const vendorIds = new Set<number>();
    // Track local entity UUIDs for files with entity_id = -1 (local entities without Buildium IDs)
    const localUnitIds = new Set<string>();
    const localPropertyIds = new Set<string>();

    for (const file of filesList) {
      if (typeof file.buildium_category_id === 'number') {
        categoryIds.add(file.buildium_category_id);
      }

      const { entityType, entityId } = resolveFileEntityFromRow(file);

      // Handle local entities (UUIDs)
      if (entityType && typeof entityId === 'string' && UUID_REGEX.test(entityId)) {
        switch (entityType) {
          case FILE_ENTITY_TYPES.UNITS:
          case FILE_ENTITY_TYPES.ASSOCIATION_UNITS:
            localUnitIds.add(entityId);
            break;
          case FILE_ENTITY_TYPES.PROPERTIES:
          case FILE_ENTITY_TYPES.ASSOCIATIONS:
            localPropertyIds.add(entityId);
            break;
        }
        continue; // Skip buildium ID processing for local entities
      }

      // Handle Buildium entities (numeric IDs)
      if (!entityType || !entityId || typeof entityId !== 'number') continue;

      switch (entityType) {
        case FILE_ENTITY_TYPES.PROPERTIES:
        case FILE_ENTITY_TYPES.ASSOCIATIONS:
          propertyIds.add(entityId);
          break;
        case FILE_ENTITY_TYPES.UNITS:
        case FILE_ENTITY_TYPES.ASSOCIATION_UNITS:
          unitIds.add(entityId);
          break;
        case FILE_ENTITY_TYPES.LEASES:
          leaseIds.add(entityId);
          break;
        case FILE_ENTITY_TYPES.TENANTS:
          tenantIds.add(entityId);
          break;
        case FILE_ENTITY_TYPES.RENTAL_OWNERS:
        case FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS:
        case FILE_ENTITY_TYPES.ASSOCIATION_OWNERS:
          ownerIds.add(entityId);
          break;
        case FILE_ENTITY_TYPES.VENDORS:
          vendorIds.add(entityId);
          break;
        default:
          break;
      }
    }

    if (filterBuildiumCategoryId !== null) {
      categoryIds.add(filterBuildiumCategoryId);
    }

    const [
      categoryRes,
      propertyRes,
      unitRes,
      localUnitRes,
      leaseRes,
      tenantRes,
      ownerRes,
      vendorRes,
    ] = await Promise.all([
      categoryIds.size
        ? supabase
            .from('file_categories')
            .select('id, buildium_category_id, category_name')
            .eq('org_id', orgId)
            .in('buildium_category_id', Array.from(categoryIds))
        : Promise.resolve({ data: [] as FileCategoryRow[], error: null }),
      propertyIds.size
        ? supabase
            .from('properties')
            .select(
              'id, name, address_line1, address_line2, city, state, property_type, buildium_property_id',
            )
            .in('buildium_property_id', Array.from(propertyIds))
            .eq('org_id', orgId)
        : Promise.resolve({ data: [] as PropertyRow[], error: null }),
      unitIds.size
        ? supabase
            .from('units')
            .select('id, unit_number, property_id, buildium_unit_id, buildium_property_id')
            .in('buildium_unit_id', Array.from(unitIds))
            .eq('org_id', orgId)
        : Promise.resolve({ data: [] as UnitRow[], error: null }),
      localUnitIds.size
        ? supabase
            .from('units')
            .select('id, unit_number, property_id, buildium_unit_id, buildium_property_id')
            .in('id', Array.from(localUnitIds))
            .eq('org_id', orgId)
        : Promise.resolve({ data: [] as UnitRow[], error: null }),
      leaseIds.size
        ? supabase
            .from('lease')
            .select(
              'id, buildium_lease_id, property_id, unit_id, buildium_property_id, buildium_unit_id, status',
            )
            .in('buildium_lease_id', Array.from(leaseIds))
            .eq('org_id', orgId)
        : Promise.resolve({ data: [] as LeaseRow[], error: null }),
      tenantIds.size
        ? supabase
            .from('tenants')
            .select(
              'id, buildium_tenant_id, contact:contacts(id, display_name, first_name, last_name, company_name, primary_email, primary_phone)',
            )
            .in('buildium_tenant_id', Array.from(tenantIds))
            .eq('org_id', orgId)
        : Promise.resolve({ data: [] as TenantRow[], error: null }),
      ownerIds.size
        ? supabase
            .from('owners')
            .select('id, buildium_owner_id, contact_id')
            .in('buildium_owner_id', Array.from(ownerIds))
            .eq('org_id', orgId)
        : Promise.resolve({ data: [] as OwnerRow[], error: null }),
      vendorIds.size
        ? supabase
            .from('vendors')
            .select(
              'id, buildium_vendor_id, contact:contacts(id, display_name, first_name, last_name, company_name, primary_email, primary_phone)',
            )
            .in('buildium_vendor_id', Array.from(vendorIds))
            .eq('org_id', orgId)
        : Promise.resolve({ data: [] as VendorRow[], error: null }),
    ]);

    if (categoryRes.error) {
      console.error('Failed to load file categories for files list:', categoryRes.error);
    }
    if (propertyRes.error) {
      console.error('Failed to load properties for files list:', propertyRes.error);
    }
    if (unitRes.error) {
      console.error('Failed to load units for files list:', unitRes.error);
    }
    if (localUnitRes.error) {
      console.error('Failed to load local units for files list:', localUnitRes.error);
    }
    if (leaseRes.error) {
      console.error('Failed to load leases for files list:', leaseRes.error);
    }
    if (tenantRes.error) {
      console.error('Failed to load tenants for files list:', tenantRes.error);
    }
    if (ownerRes.error) {
      console.error('Failed to load owners for files list:', ownerRes.error);
    }
    if (vendorRes.error) {
      console.error('Failed to load vendors for files list:', vendorRes.error);
    }

    const categoryByBuildiumId = new Map<number, { id?: string; name: string }>();
    for (const category of categoryRes.data || []) {
      if (typeof category.buildium_category_id === 'number') {
        categoryByBuildiumId.set(category.buildium_category_id, {
          id: category.id,
          name: category.category_name || 'Uncategorized',
        });
      }
    }

    const propertiesByBuildiumId = new Map<number, PropertyRow>();
    const propertiesByLocalId = new Map<string, PropertyRow>();
    for (const property of propertyRes.data || []) {
      if (typeof property.buildium_property_id === 'number') {
        propertiesByBuildiumId.set(property.buildium_property_id, property);
      }
      if (typeof property.id === 'string') {
        propertiesByLocalId.set(property.id, property);
      }
    }

    const unitsByBuildiumId = new Map<number, UnitRow>();
    const unitsByLocalId = new Map<string, UnitRow>();
    for (const unit of unitRes.data || []) {
      if (typeof unit.buildium_unit_id === 'number') {
        unitsByBuildiumId.set(unit.buildium_unit_id, unit);
      }
      if (typeof unit.id === 'string') {
        unitsByLocalId.set(unit.id, unit);
      }
    }
    // Also add local units (queried by local ID) to the map
    for (const unit of localUnitRes.data || []) {
      if (typeof unit.id === 'string') {
        unitsByLocalId.set(unit.id, unit);
      }
      // Also add to Buildium map if it has a Buildium ID
      if (typeof unit.buildium_unit_id === 'number') {
        unitsByBuildiumId.set(unit.buildium_unit_id, unit);
      }
    }

    const leasesByBuildiumId = new Map<number, LeaseRow>();
    const leasesById = new Map<number, LeaseRow>();
    for (const lease of leaseRes.data || []) {
      if (typeof lease.buildium_lease_id === 'number') {
        leasesByBuildiumId.set(lease.buildium_lease_id, lease);
      }
      if (typeof lease.id === 'number') {
        leasesById.set(lease.id, lease);
      }
    }

    const tenantsByBuildiumId = new Map<number, TenantRow>();
    for (const tenant of tenantRes.data || []) {
      if (typeof tenant.buildium_tenant_id === 'number') {
        tenantsByBuildiumId.set(tenant.buildium_tenant_id, tenant);
      }
    }

    const ownersByBuildiumId = new Map<number, OwnerRow & { contact?: ContactRow }>();
    const contactIds = new Set<number>();
    for (const owner of ownerRes.data || []) {
      if (typeof owner.contact_id === 'number') {
        contactIds.add(owner.contact_id);
      }
    }

    let contactsById = new Map<number, ContactRow>();
    if (contactIds.size) {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(
          'id, display_name, first_name, last_name, company_name, primary_email, primary_phone',
        )
        .in('id', Array.from(contactIds));
      if (contactsError) {
        console.error('Failed to load contacts for owner display:', contactsError);
      } else {
        contactsById = new Map(
          (contactsData || []).map((contact) => [contact.id as number, contact]),
        );
      }
    }

    for (const owner of ownerRes.data || []) {
      if (typeof owner.buildium_owner_id === 'number') {
        const contact =
          typeof owner.contact_id === 'number'
            ? contactsById.get(owner.contact_id) || undefined
            : undefined;
        ownersByBuildiumId.set(owner.buildium_owner_id, { ...owner, contact });
      }
    }
    const vendorsByBuildiumId = new Map<number, VendorRow>();
    for (const vendor of vendorRes.data || []) {
      if (typeof vendor.buildium_vendor_id === 'number') {
        vendorsByBuildiumId.set(vendor.buildium_vendor_id, vendor);
      }
    }

    // Ensure we have property/unit lookups derived from leases/units
    const missingPropertyIds = new Set<number>();
    for (const lease of leasesById.values()) {
      if (
        typeof lease.buildium_property_id === 'number' &&
        !propertiesByBuildiumId.has(lease.buildium_property_id)
      ) {
        missingPropertyIds.add(lease.buildium_property_id);
      }
    }
    for (const unit of unitsByBuildiumId.values()) {
      if (
        typeof unit.buildium_property_id === 'number' &&
        !propertiesByBuildiumId.has(unit.buildium_property_id)
      ) {
        missingPropertyIds.add(unit.buildium_property_id);
      }
    }
    if (missingPropertyIds.size) {
      const { data: extraProperties, error: extraPropertyError } = await supabase
        .from('properties')
        .select(
          'id, name, address_line1, address_line2, city, state, property_type, buildium_property_id',
        )
        .in('buildium_property_id', Array.from(missingPropertyIds));
      if (extraPropertyError) {
        console.error('Failed to load supplemental properties for files list:', extraPropertyError);
      } else {
        for (const property of extraProperties || []) {
          if (typeof property.buildium_property_id === 'number') {
            propertiesByBuildiumId.set(property.buildium_property_id, property);
          }
          if (typeof property.id === 'string') {
            propertiesByLocalId.set(property.id, property);
          }
        }
      }
    }

    const missingUnitIds = new Set<number>();
    for (const lease of leasesById.values()) {
      if (
        typeof lease.buildium_unit_id === 'number' &&
        !unitsByBuildiumId.has(lease.buildium_unit_id)
      ) {
        missingUnitIds.add(lease.buildium_unit_id);
      }
    }
    if (missingUnitIds.size) {
      const { data: extraUnits, error: extraUnitError } = await supabase
        .from('units')
        .select('id, unit_number, property_id, buildium_unit_id, buildium_property_id')
        .in('buildium_unit_id', Array.from(missingUnitIds));
      if (extraUnitError) {
        console.error('Failed to load supplemental units for files list:', extraUnitError);
      } else {
        for (const unit of extraUnits || []) {
          if (typeof unit.buildium_unit_id === 'number') {
            unitsByBuildiumId.set(unit.buildium_unit_id, unit);
          }
          if (typeof unit.id === 'string') {
            unitsByLocalId.set(unit.id, unit);
          }
        }
      }
    }

    const context = {
      propertiesByBuildiumId,
      propertiesByLocalId,
      unitsByBuildiumId,
      unitsByLocalId,
      leasesByBuildiumId,
      leasesById,
      tenantsByBuildiumId,
      ownersByBuildiumId,
      vendorsByBuildiumId,
    };

    const enrichedFiles = filesList.map((file) => {
      const { entityType, entityId } = resolveFileEntityFromRow(file);

      const normalizedFileEntity =
        normalizeEntityType(file.entity_type) ?? FILE_ENTITY_TYPES.PROPERTIES;
      const resolvedEntityType = entityType ?? normalizedFileEntity;
      const resolvedEntityId =
        typeof entityId === 'number' || typeof entityId === 'string' ? entityId : file.entity_id;

      // Create a file object with resolved entity_type and entity_id for compatibility
      const fileWithEntity: FileWithResolvedEntity = {
        ...file,
        entity_type: resolvedEntityType,
        entity_id: resolvedEntityId,
      };

      const filterValue = mapEntityTypeToFilterValue(resolvedEntityType);
      const categoryName =
        (typeof file.buildium_category_id === 'number'
          ? categoryByBuildiumId.get(file.buildium_category_id)?.name
          : undefined) || 'Uncategorized';
      const { location, entityUrl } = resolveEntityPresentation(fileWithEntity, context);

      return {
        ...file,
        category_name: categoryName,
        location,
        entity_url: entityUrl,
        is_shared: false,
        entity_types: filterValue ? [filterValue] : [],
      };
    });

    const total = typeof count === 'number' ? count : enrichedFiles.length;

    return NextResponse.json({
      success: true,
      data: enrichedFiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching files list:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 },
        );
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json(
          { success: false, error: 'Organization context required' },
          { status: 400 },
        );
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json(
          { success: false, error: 'Not authorized for this organization' },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

function mapEntityTypeToFilterValue(entityType: unknown): string | null {
  if (typeof entityType !== 'string') return null;
  for (const [filterValue, entityTypes] of Object.entries(ENTITY_FILTER_MAP)) {
    if ((entityTypes as EntityTypeEnum[]).includes(entityType as EntityTypeEnum)) {
      return filterValue;
    }
  }
  return null;
}

type EntityContext = {
  propertiesByBuildiumId: Map<number, PropertyRow>;
  propertiesByLocalId: Map<string, PropertyRow>;
  unitsByBuildiumId: Map<number, UnitRow>;
  unitsByLocalId: Map<string, UnitRow>;
  leasesByBuildiumId: Map<number, LeaseRow>;
  leasesById: Map<number, LeaseRow>;
  tenantsByBuildiumId: Map<number, TenantRow>;
  ownersByBuildiumId: Map<number, OwnerRow & { contact?: ContactRow }>;
  vendorsByBuildiumId: Map<number, VendorRow>;
};

function resolveEntityPresentation(
  file: FileWithResolvedEntity,
  context: EntityContext,
): {
  location: string;
  entityUrl?: string;
} {
  const entityIdNum =
    typeof file.entity_id === 'number'
      ? file.entity_id
      : Number.isFinite(Number(file.entity_id))
        ? Number(file.entity_id)
        : null;
  const fallbackLabel = entityIdNum
    ? `${file.entity_type || 'Entity'} #${entityIdNum}`
    : 'Unassigned';
  const fallback = { location: fallbackLabel, entityUrl: undefined as string | undefined };

  if (!entityIdNum) {
    return { location: 'Unassigned', entityUrl: undefined };
  }

  switch (file.entity_type) {
    case FILE_ENTITY_TYPES.PROPERTIES:
    case FILE_ENTITY_TYPES.ASSOCIATIONS: {
      const property = context.propertiesByBuildiumId.get(entityIdNum);
      if (property) {
        const name =
          property.name ||
          property.address_line_1 ||
          property.address_line1 ||
          `Property #${entityIdNum}`;
        const cityState = [property.city, property.state].filter(Boolean).join(', ');
        const location = cityState ? `${name} • ${cityState}` : name;
        const entityUrl =
          typeof property.id === 'string' ? `/properties/${property.id}` : undefined;
        return { location, entityUrl };
      }
      return fallback;
    }
    case FILE_ENTITY_TYPES.UNITS:
    case FILE_ENTITY_TYPES.ASSOCIATION_UNITS: {
      let unit = context.unitsByBuildiumId.get(entityIdNum);

      // If entity_id = -1, try to find unit by local UUID from storage_key
      if (!unit && entityIdNum === -1 && file.storage_key) {
        const storageKeyParts = file.storage_key.split('/');
        if (storageKeyParts.length >= 2 && storageKeyParts[0] === 'unit') {
          const localUnitId = storageKeyParts[1];
          // Validate UUID format
          if (
            localUnitId &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localUnitId)
          ) {
            unit = context.unitsByLocalId.get(localUnitId);
            if (!unit) {
              console.warn('File has entity_id=-1 but unit not found by local ID', {
                fileId: file.id,
                storageKey: file.storage_key,
                extractedUnitId: localUnitId,
                availableUnitIds: Array.from(context.unitsByLocalId.keys()).slice(0, 5),
              });
            }
          } else {
            console.warn('File has entity_id=-1 but storage_key format is invalid', {
              fileId: file.id,
              storageKey: file.storage_key,
              extractedUnitId: localUnitId,
            });
          }
        }
      }

      if (unit) {
        const property =
          (typeof unit.property_id === 'string'
            ? context.propertiesByLocalId.get(unit.property_id)
            : undefined) ||
          (typeof unit.buildium_property_id === 'number'
            ? context.propertiesByBuildiumId.get(unit.buildium_property_id)
            : undefined);
        const propertyName =
          property?.name || property?.address_line_1 || property?.address_line1 || undefined;
        const unitLabel = unit.unit_number ? `Unit ${unit.unit_number}` : `Unit #${entityIdNum}`;
        const location = propertyName ? `${propertyName} • ${unitLabel}` : unitLabel;
        const entityUrl =
          property?.id && unit.id ? `/properties/${property.id}/units/${unit.id}` : undefined;
        return { location, entityUrl };
      }
      return fallback;
    }
    case FILE_ENTITY_TYPES.LEASES: {
      const lease =
        context.leasesByBuildiumId.get(entityIdNum) || context.leasesById.get(entityIdNum);
      if (lease) {
        const property =
          (typeof lease.property_id === 'string'
            ? context.propertiesByLocalId.get(lease.property_id)
            : undefined) ||
          (typeof lease.buildium_property_id === 'number'
            ? context.propertiesByBuildiumId.get(lease.buildium_property_id)
            : undefined);
        const unit =
          (typeof lease.unit_id === 'string'
            ? context.unitsByLocalId.get(lease.unit_id)
            : undefined) ||
          (typeof lease.buildium_unit_id === 'number'
            ? context.unitsByBuildiumId.get(lease.buildium_unit_id)
            : undefined);

        const propertyName =
          property?.name || property?.address_line_1 || property?.address_line1 || undefined;
        const unitLabel = unit?.unit_number ? `Unit ${unit.unit_number}` : undefined;
        const parts = [propertyName, unitLabel].filter(Boolean) as string[];
        const base = parts.length
          ? `${parts.join(' • ')} Lease`
          : `Lease #${lease.id ?? entityIdNum}`;

        return {
          location: base,
          entityUrl: `/leases/${lease.id ?? entityIdNum}`,
        };
      }
      return fallback;
    }
    case FILE_ENTITY_TYPES.TENANTS: {
      const tenant = context.tenantsByBuildiumId.get(entityIdNum);
      if (tenant) {
        const contact = tenant.contact;
        const contactName =
          contact && `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
        const name =
          contact?.display_name ||
          contact?.company_name ||
          (contactName && contactName.trim()) ||
          contact?.primary_email ||
          `Tenant #${entityIdNum}`;
        const entityUrl = tenant.id ? `/tenants/${tenant.id}` : undefined;
        return { location: name, entityUrl };
      }
      return fallback;
    }
    case FILE_ENTITY_TYPES.RENTAL_OWNERS:
    case FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS:
    case FILE_ENTITY_TYPES.ASSOCIATION_OWNERS: {
      const owner = context.ownersByBuildiumId.get(entityIdNum);
      if (owner) {
        const contact = owner.contact;
        const contactName =
          contact && `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
        const name =
          contact?.display_name ||
          contact?.company_name ||
          (contactName && contactName.trim()) ||
          contact?.primary_email ||
          `Owner #${entityIdNum}`;
        const entityUrl = owner.id ? `/owners/${owner.id}` : undefined;
        return { location: name, entityUrl };
      }
      return fallback;
    }
    case FILE_ENTITY_TYPES.VENDORS: {
      const vendor = context.vendorsByBuildiumId.get(entityIdNum);
      if (vendor) {
        const contact = vendor.contact;
        const contactName =
          contact && `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
        const name =
          contact?.display_name ||
          contact?.company_name ||
          (contactName && contactName.trim()) ||
          contact?.primary_email ||
          `Vendor #${entityIdNum}`;
        const entityUrl = vendor.id ? `/vendors/${vendor.id}` : undefined;
        return { location: name, entityUrl };
      }
      return fallback;
    }
    default:
      return fallback;
  }
}
