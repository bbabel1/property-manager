import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { OwnerCreateSchema, OwnerQuerySchema } from '@/schemas/owner'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCSRFToken } from '@/lib/csrf'
import { mapOwnerFromDB, type Owner, type OwnerDB } from '@/types/owners'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'
import type { Database } from '@/types/database'
import { normalizeCountry, normalizeCountryWithDefault, normalizeEtfAccountType } from '@/lib/normalizers'

type ContactsInsert = Database['public']['Tables']['contacts']['Insert']
type OwnersInsert = Database['public']['Tables']['owners']['Insert']
type ContactsRow = Database['public']['Tables']['contacts']['Row']
type OwnersRow = Database['public']['Tables']['owners']['Row']
type ContactSelect = Pick<
  ContactsRow,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'company_name'
  | 'primary_email'
  | 'primary_phone'
  | 'primary_address_line_1'
  | 'primary_address_line_2'
  | 'primary_city'
  | 'primary_state'
  | 'primary_postal_code'
  | 'primary_country'
  | 'is_company'
>
type OwnerWithContact = OwnersRow & { contacts: ContactSelect | ContactSelect[] }
type OwnerWithContactFields = Owner & {
  first_name: string | null
  last_name: string | null
  company_name: string | null
  displayName: string | null
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // CSRF protection
    const isValidCSRF = await validateCSRFToken(request);
    if (!isValidCSRF) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Authentication
    const { supabase: db, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(request, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })
    logger.info({ userId: user.id, orgId, action: 'create_owner' }, 'Creating owner')

    // Parse and validate request body
    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch (parseError) {
      logger.error({ error: parseError }, 'Failed to parse request body');
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    // Provide sensible defaults so quick-create forms can work without full address
    const bodyInput =
      bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw) ? bodyRaw : {};
    const body = {
      addressLine1: 'N/A',
      postalCode: '00000',
      country: 'United States',
      ...bodyInput,
    };

    let data;
    try {
      data = sanitizeAndValidate(body, OwnerCreateSchema);
    } catch (zerr: unknown) {
      // Surface validation errors to the client clearly
      const details = Array.isArray((zerr as { errors?: Array<{ message?: string }> }).errors)
        ? (zerr as { errors?: Array<{ message?: string }> }).errors?.map((e) => e.message).join('; ')
        : null
      return NextResponse.json(
        {
          error: 'Invalid owner input',
          details: details || (zerr as { message?: string })?.message || String(zerr),
        },
        { status: 400 }
      )
    }

    // First create the contact (map to snake_case DB columns)
    const now = new Date().toISOString();
    const contactData: ContactsInsert = {
      is_company: data.isCompany ?? false,
      first_name: data.isCompany ? null : data.firstName ?? null,
      last_name: data.isCompany ? null : data.lastName ?? null,
      company_name: data.isCompany ? data.companyName ?? null : null,
      primary_email: data.primaryEmail ?? null,
      primary_phone: data.primaryPhone ?? null,
      primary_address_line_1: data.addressLine1 ?? null,
      primary_address_line_2: data.addressLine2 ?? null,
      primary_city: data.city ?? null,
      primary_state: data.state ?? null,
      primary_postal_code: data.postalCode ?? null,
      primary_country: normalizeCountryWithDefault(data.country),
      created_at: now,
      updated_at: now
    }

    const { data: contact, error: contactError } = await db
      .from('contacts')
      .insert(contactData)
      .select()
      .single();

    if (contactError) {
      console.error('Contact creation error:', contactError);
      logger.error({ error: contactError, userId: user.id }, 'Failed to create contact');
      return NextResponse.json(
        { error: 'Failed to create contact', details: contactError.message },
        { status: 500 }
      );
    }

    // Then create the owner referencing the contact
    const ownerInsert: OwnersInsert = {
      contact_id: contact.id,
      org_id: orgId,
      management_agreement_start_date: data.managementAgreementStartDate ?? null,
      management_agreement_end_date: data.managementAgreementEndDate ?? null,
      comment: data.comment ?? null,
      etf_account_type: normalizeEtfAccountType(data.etfAccountType),
      etf_account_number: data.etfAccountNumber ? Number(data.etfAccountNumber) : null,
      etf_routing_number: data.etfRoutingNumber ? Number(data.etfRoutingNumber) : null,
      tax_address_line1: null,
      tax_address_line2: null,
      tax_address_line3: null,
      tax_city: null,
      tax_state: null,
      tax_postal_code: null,
      tax_country: normalizeCountry(data.taxCountry),
      tax_payer_id: null,
      tax_payer_type:
        data.taxPayerType === 'SSN' || data.taxPayerType === 'EIN' ? data.taxPayerType : null,
      tax_payer_name1: null,
      tax_payer_name2: null,
      created_at: now,
      updated_at: now,
    }

    const { data: owner, error: ownerError } = await db
      .from('owners')
      .insert(ownerInsert)
      .select()
      .single()

    if (ownerError) {
      console.error('Database error:', ownerError);
      logger.error({ error: ownerError, userId: user.id }, 'Failed to create owner');
      try {
        if (contact?.id) {
          await db.from('contacts').delete().eq('id', contact.id)
        }
      } catch (cleanupError) {
        logger.warn(
          { error: cleanupError, contactId: contact?.id, userId: user.id },
          'Failed to roll back contact after owner creation error'
        )
      }
      return NextResponse.json(
        { error: 'Failed to create owner', details: ownerError.message },
        { status: 500 }
      )
    }

    // ============================================================================
    // BUILDIUM SYNC VIA EDGE FUNCTION - NEW SECTION
    // ============================================================================

    let buildiumSyncResult: { success: boolean; buildiumId?: number; error?: string } = { success: true, buildiumId: undefined, error: undefined };
    let contactRecord: ContactsRow | null = null;

    try {
      // Get contact data for Buildium sync
      const ownerContactId = owner.contact_id
      if (!ownerContactId) {
        throw new Error('Owner contact_id missing')
      }

      const { data: contact } = await db
        .from('contacts')
        .select('*')
        .eq('id', ownerContactId)
        .single<ContactsRow>();

      if (!contact) {
        throw new Error('Contact not found for owner');
      }
      contactRecord = contact;

      const buildiumOwnerData = {
        id: owner.id,
        FirstName: contact.first_name || '',
        LastName: contact.last_name || '',
        Email: contact.primary_email || undefined,
        PhoneNumber: contact.primary_phone || undefined,
        Address: {
          AddressLine1: contact.primary_address_line_1 || '',
          AddressLine2: contact.primary_address_line_2 || undefined,
          City: contact.primary_city || '',
          State: contact.primary_state || '',
          PostalCode: contact.primary_postal_code || '',
          Country: contact.primary_country || 'US'
        },
        IsActive: true
      };

      // Use org-scoped client for Buildium sync
      const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
      buildiumSyncResult = await edgeClient.syncOwnerToBuildium(buildiumOwnerData);

      if (buildiumSyncResult.success && buildiumSyncResult.buildiumId) {
        logger.info({ 
          ownerId: owner.id, 
          buildiumId: buildiumSyncResult.buildiumId,
          userId: user.id 
        }, 'Owner successfully synced to Buildium via Edge Function');

        // Persist Buildium owner id locally
        try {
          await db
            .from('owners')
            .update({ buildium_owner_id: buildiumSyncResult.buildiumId })
            .eq('id', owner.id)
        } catch (persistErr) {
          console.warn('Failed to persist buildium_owner_id on owner create:', persistErr)
        }
      } else if (!buildiumSyncResult.success) {
        logger.warn({ 
          ownerId: owner.id, 
          error: buildiumSyncResult.error,
          userId: user.id 
        }, 'Owner created locally but Buildium sync failed');
      }

    } catch (syncError) {
      logger.error({ 
        ownerId: owner.id,
        orgId,
        error: syncError,
        userId: user.id 
      }, 'Error during Buildium sync via Edge Function');
      
      buildiumSyncResult = { 
        success: false, 
        buildiumId: undefined, 
        error: syncError instanceof Error ? syncError.message : 'Unknown sync error' 
      };
    }

    // Map response back to application format and include contact display fields
    const mappedOwner = mapOwnerFromDB(owner as OwnerDB);
    const ownerResponse: OwnerWithContactFields = {
      ...mappedOwner,
      // Include contact-friendly fields for UI display
      first_name: contactRecord?.first_name ?? null,
      last_name: contactRecord?.last_name ?? null,
      company_name: contactRecord?.company_name ?? null,
      displayName: contactRecord?.is_company
        ? contactRecord?.company_name
        : `${contactRecord?.first_name ?? ''} ${contactRecord?.last_name ?? ''}`.trim() || null,
    }

    console.log('Owner created successfully:', { 
      ownerId: owner.id, 
      userId: user.id,
      buildiumSyncSuccess: buildiumSyncResult.success,
      buildiumId: buildiumSyncResult.buildiumId
    });

    return NextResponse.json(
      { 
        message: 'Owner created successfully',
        owner: ownerResponse,
        buildiumSync: {
          success: buildiumSyncResult.success,
          buildiumId: buildiumSyncResult.buildiumId,
          error: buildiumSyncResult.error
        }
      },
      { status: 201 }
    )

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Organization access denied' }, { status: 403 })
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      }
    }

    console.error('Error creating owner:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to create owner' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Authentication
    const { supabase: db, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(request, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })
    console.log('Fetching owners:', { userId: user.id, orgId, action: 'fetch_owners' });

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = sanitizeAndValidate(queryParams, OwnerQuerySchema);

    // Build query with pagination and filters scoped to the org context
    let queryBuilder = db
      .from('owners')
      .select(`
        id,
        contact_id,
        management_agreement_start_date,
        management_agreement_end_date,
        comment,
        etf_account_type,
        etf_account_number,
        etf_routing_number,
        created_at,
        updated_at,
        contacts!inner(
          id,
          first_name,
          last_name,
          company_name,
          primary_email,
          primary_phone,
          primary_address_line_1,
          primary_address_line_2,
          primary_city,
          primary_state,
          primary_postal_code,
          primary_country,
          is_company
        )
      `)
      .eq('org_id', orgId)
      .range(query.offset, query.offset + query.limit - 1);

    // Apply filters
    if (query.isCompany !== undefined) {
      queryBuilder = queryBuilder.eq('contacts.is_company', query.isCompany);
    }
    if (query.search) {
      queryBuilder = queryBuilder.or(`contacts.first_name.ilike.%${query.search}%,contacts.last_name.ilike.%${query.search}%,contacts.primary_email.ilike.%${query.search}%`);
    }

    const { data: owners, error } = await queryBuilder.returns<OwnerWithContact[]>();

    if (error) {
      console.error('Error fetching owners:', { error, userId: user.id });
      return NextResponse.json(
        { error: 'Failed to fetch owners' },
        { status: 500 }
      )
    }

    // Map database results to application format - combine owner and contact data
    const mappedOwners = (owners || []).map((dbOwner) => {
      const owner = mapOwnerFromDB(dbOwner as OwnerDB)
      const contactRaw = dbOwner.contacts
      const contact = Array.isArray(contactRaw) ? contactRaw[0] : contactRaw

      const displayName = contact?.is_company
        ? (contact?.company_name || contact?.primary_email || `Owner ${owner.id.slice(0, 6)}`)
        : ([contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim())
            || contact?.company_name
            || contact?.primary_email
            || `Owner ${owner.id.slice(0, 6)}`

      // Combine owner and contact data for backward compatibility
      return {
        ...owner,
        // Add contact fields for backward compatibility
        firstName: contact?.first_name || undefined,
        lastName: contact?.last_name || undefined,
        companyName: contact?.company_name || undefined,
        primaryEmail: contact?.primary_email || undefined,
        primaryPhone: contact?.primary_phone || undefined,
        primaryAddressLine1: contact?.primary_address_line_1 || undefined,
        primaryAddressLine2: contact?.primary_address_line_2 || undefined,
        primaryCity: contact?.primary_city || undefined,
        primaryState: contact?.primary_state || undefined,
        primaryPostalCode: contact?.primary_postal_code || undefined,
        primaryCountry: contact?.primary_country || undefined,
        isCompany: contact?.is_company || false,
        // Legacy fields for dropdowns
        displayName,
        name: displayName,
        email: contact?.primary_email || undefined,
        phoneNumber: contact?.primary_phone || undefined,
        addressLine1: contact?.primary_address_line_1 || undefined,
        addressLine2: contact?.primary_address_line_2 || undefined,
        city: contact?.primary_city || undefined,
        state: contact?.primary_state || undefined,
        postalCode: contact?.primary_postal_code || undefined,
        country: contact?.primary_country || undefined
      }
    })

    console.log('Owners fetched successfully:', { count: mappedOwners.length, userId: user.id });
    return NextResponse.json(mappedOwners)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Organization access denied' }, { status: 403 })
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      }
    }

    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching owners');
    return NextResponse.json(
      { error: 'Failed to fetch owners' },
      { status: 500 }
    )
  }
}
