import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { OwnerCreateSchema, OwnerQuerySchema } from '@/schemas/owner'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCSRFToken } from '@/lib/csrf'
import { mapOwnerFromDB, mapOwnerToDB, type Owner, type OwnerDB } from '@/types/owners'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

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
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error({ error: parseError }, 'Failed to parse request body');
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const data = sanitizeAndValidate(body, OwnerCreateSchema);

    // First create the contact
    const contactData = {
      isCompany: data.isCompany || false,
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName,
      primaryEmail: data.primaryEmail,
      primaryPhone: data.primaryPhone,
      primaryAddressLine1: data.addressLine1,
      primaryAddressLine2: data.addressLine2,
      primaryCity: data.city,
      primaryState: data.state,
      primaryPostalCode: data.postalCode,
      primaryCountry: data.country || 'US'
    };

    const { data: contact, error: contactError } = await supabase
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
    const dbData = mapOwnerToDB({
      contactId: contact.id,
      managementAgreementStartDate: data.managementAgreementStartDate,
      managementAgreementEndDate: data.managementAgreementEndDate,
      comment: data.comment,
      etfAccountType: data.etfAccountType,
      etfAccountNumber: data.etfAccountNumber,
      etfRoutingNumber: data.etfRoutingNumber
    });

    // Add required timestamp fields
    const now = new Date().toISOString();
    const finalDbData = {
      ...dbData,
      updated_at: now
    };

    // Create the owner
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .insert(finalDbData)
      .select()
      .single()

    if (ownerError) {
      console.error('Database error:', ownerError);
      logger.error({ error: ownerError, userId: user.id }, 'Failed to create owner');
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
      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', owner.contact_id)
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
        TaxId: contact.tax_payer_id || undefined,
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
          await supabase
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

    // Map response back to application format
    const mappedOwner = mapOwnerFromDB(owner as OwnerDB);

    console.log('Owner created successfully:', { 
      ownerId: owner.id, 
      userId: user.id,
      buildiumSyncSuccess: buildiumSyncResult.success,
      buildiumId: buildiumSyncResult.buildiumId
    });

    return NextResponse.json(
      { 
        message: 'Owner created successfully',
        owner: mappedOwner,
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

    // Build query with pagination and filters - using new owners/contacts structure
    let queryBuilder = supabase
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
    const mappedOwners = owners?.map((dbOwner) => {
      const owner = mapOwnerFromDB(dbOwner as OwnerDB);
      const contact = dbOwner.contacts?.[0]; // Get first contact since it's an array
      
      // Combine owner and contact data for backward compatibility
      return {
        ...owner,
        // Add contact fields for backward compatibility
        firstName: contact?.first_name,
        lastName: contact?.last_name,
        companyName: contact?.company_name,
        primaryEmail: contact?.primary_email,
        primaryPhone: contact?.primary_phone,
        primaryAddressLine1: contact?.primary_address_line_1,
        primaryAddressLine2: contact?.primary_address_line_2,
        primaryCity: contact?.primary_city,
        primaryState: contact?.primary_state,
        primaryPostalCode: contact?.primary_postal_code,
        primaryCountry: contact?.primary_country,
        isCompany: contact?.is_company,
        // Legacy fields for backward compatibility
        name: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : '',
        email: contact?.primary_email,
        phoneNumber: contact?.primary_phone,
        addressLine1: contact?.primary_address_line_1,
        addressLine2: contact?.primary_address_line_2,
        city: contact?.primary_city,
        state: contact?.primary_state,
        postalCode: contact?.primary_postal_code,
        country: contact?.primary_country
      };
    }) || [];

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
