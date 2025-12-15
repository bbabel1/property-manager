import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { OwnerCreateSchema, OwnerQuerySchema } from '@/schemas/owner'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCSRFToken } from '@/lib/csrf'
import { mapOwnerFromDB, type Owner, type OwnerDB } from '@/types/owners'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import type { Database } from '@/types/database'
import { normalizeCountry, normalizeCountryWithDefault, normalizeEtfAccountType } from '@/lib/normalizers'

type ContactsInsert = Database['public']['Tables']['contacts']['Insert']
type OwnersInsert = Database['public']['Tables']['owners']['Insert']

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
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'create_owner' }, 'Creating owner');

    // Parse and validate request body
    let bodyRaw: any;
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
    const body = {
      addressLine1: 'N/A',
      postalCode: '00000',
      country: 'United States',
      ...bodyRaw
    }

    let data;
    try {
      data = sanitizeAndValidate(body, OwnerCreateSchema);
    } catch (zerr: any) {
      // Surface validation errors to the client clearly
      const details = zerr?.errors?.map((e: any) => e.message).join('; ')
      return NextResponse.json(
        { error: 'Invalid owner input', details: details || zerr?.message || String(zerr) },
        { status: 400 }
      )
    }

    // Use admin client for writes (bypass RLS)
    const db = supabaseAdmin || supabase

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
        .single();

      if (!contact) {
        throw new Error('Contact not found for owner');
      }

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

      // Sync to Buildium via Edge Function
      buildiumSyncResult = await buildiumEdgeClient.syncOwnerToBuildium(buildiumOwnerData);

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
    const ownerResponse = {
      ...mappedOwner,
      // Include contact-friendly fields for UI display
      first_name: (contact as any)?.first_name ?? null,
      last_name: (contact as any)?.last_name ?? null,
      company_name: (contact as any)?.company_name ?? null,
      displayName: (contact as any)?.is_company
        ? (contact as any)?.company_name
        : `${(contact as any)?.first_name ?? ''} ${(contact as any)?.last_name ?? ''}`.trim() || null
    } as any

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
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    const user = await requireUser(request);
    console.log('Fetching owners:', { userId: user.id, action: 'fetch_owners' });

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = sanitizeAndValidate(queryParams, OwnerQuerySchema);

    // Build query with pagination and filters - using admin client to bypass RLS
    const db = supabaseAdmin || supabase
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
      .range(query.offset, query.offset + query.limit - 1);

    // Apply filters
    if (query.isCompany !== undefined) {
      queryBuilder = queryBuilder.eq('contacts.is_company', query.isCompany);
    }
    if (query.search) {
      queryBuilder = queryBuilder.or(`contacts.first_name.ilike.%${query.search}%,contacts.last_name.ilike.%${query.search}%,contacts.primary_email.ilike.%${query.search}%`);
    }

    const { data: owners, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching owners:', { error, userId: user.id });
      return NextResponse.json(
        { error: 'Failed to fetch owners' },
        { status: 500 }
      )
    }

    // Map database results to application format - combine owner and contact data
    const mappedOwners = (owners || []).map((dbOwner: any) => {
      const owner = mapOwnerFromDB(dbOwner as OwnerDB)
      const contactRaw = (dbOwner as any).contacts
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
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching owners');
    return NextResponse.json(
      { error: 'Failed to fetch owners' },
      { status: 500 }
    )
  }
}
