import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('🔍 Owner Details API: Starting request for owner ID:', resolvedParams.id);
    
    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      console.log('🔍 Owner Details API: Rate limit exceeded');
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    console.log('🔍 Owner Details API: Rate limit check passed');

    // Authentication
    const user = await requireUser(request);
    console.log('🔍 Owner Details API: User authenticated:', user.id);

    // Fetch owner from database with contact information
    console.log('🔍 Owner Details API: About to query Supabase...');
    const { data: owner, error } = await supabaseAdmin
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
        tax_payer_id,
        tax_payer_type,
        tax_payer_name,
        tax_address_line_1,
        tax_address_line_2,
        tax_address_line_3,
        tax_city,
        tax_state,
        tax_postal_code,
        tax_country,
        created_at,
        updated_at,
        contacts (
          id,
          is_company,
          first_name,
          last_name,
          company_name,
          display_name,
          primary_email,
          alt_email,
          primary_phone,
          alt_phone,
          date_of_birth,
          primary_address_line_1,
          primary_address_line_2,
          primary_address_line_3,
          primary_city,
          primary_state,
          primary_postal_code,
          primary_country,
          alt_address_line_1,
          alt_address_line_2,
          alt_address_line_3,
          alt_city,
          alt_state,
          alt_postal_code,
          alt_country,
          mailing_preference
        )
      `)
      .eq('id', resolvedParams.id)
      .single();

    console.log('🔍 Owner Details API: Supabase query completed');
    console.log('🔍 Owner Details API: Error:', error);
    console.log('🔍 Owner Details API: Data found:', !!owner);

    if (error) {
      console.error('🔍 Owner Details API: Database error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Owner not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch owner', details: error.message },
        { status: 500 }
      );
    }

    // Calculate total units for this owner
    console.log('🔍 Owner Details API: Calculating total units for owner:', resolvedParams.id);
            const { data: ownerships, error: ownershipError } = await supabaseAdmin
      .from('ownerships')
      .select(`
        property_id,
                    properties (
              total_units
            )
      `)
      .eq('owner_id', resolvedParams.id);

    if (ownershipError) {
      console.error('🔍 Owner Details API: Error fetching ownerships:', ownershipError);
      // Don't fail the request, just set total_units to 0
    }

    // Sum up total_units from all properties owned by this owner
    const totalUnits = ownerships?.reduce((sum, ownership) => {
      const property = Array.isArray(ownership.properties) ? ownership.properties[0] : ownership.properties;
      return sum + (property?.total_units || 0);
    }, 0) || 0;

    // Transform data to include a display name and flatten contact information
    console.log('🔍 Owner Details API: Transforming data...');
    const contact = Array.isArray(owner.contacts) ? owner.contacts[0] : owner.contacts;
    const transformedOwner = {
      id: owner.id,
      contact_id: owner.contact_id,
      management_agreement_start_date: owner.management_agreement_start_date,
      management_agreement_end_date: owner.management_agreement_end_date,
      comment: owner.comment,
      etf_account_type: owner.etf_account_type,
      etf_account_number: owner.etf_account_number,
      etf_routing_number: owner.etf_routing_number,
      created_at: owner.created_at,
      updated_at: owner.updated_at,
      // Contact information flattened
      is_company: contact?.is_company,
      first_name: contact?.first_name,
      last_name: contact?.last_name,
      company_name: contact?.company_name,
      display_name: contact?.display_name,
      primary_email: contact?.primary_email,
      alt_email: contact?.alt_email,
      primary_phone: contact?.primary_phone,
      alt_phone: contact?.alt_phone,
      date_of_birth: contact?.date_of_birth,
      primary_address_line_1: contact?.primary_address_line_1,
      primary_address_line_2: contact?.primary_address_line_2,
      primary_address_line_3: contact?.primary_address_line_3,
      primary_city: contact?.primary_city,
      primary_state: contact?.primary_state,
      primary_postal_code: contact?.primary_postal_code,
      primary_country: contact?.primary_country,
      alt_address_line_1: contact?.alt_address_line_1,
      alt_address_line_2: contact?.alt_address_line_2,
      alt_address_line_3: contact?.alt_address_line_3,
      alt_city: contact?.alt_city,
      alt_state: contact?.alt_state,
      alt_postal_code: contact?.alt_postal_code,
      alt_country: contact?.alt_country,
      mailing_preference: contact?.mailing_preference,
      // Tax information from owners table
      tax_payer_id: owner.tax_payer_id,
      tax_payer_type: owner.tax_payer_type,
      tax_payer_name: owner.tax_payer_name,
      tax_address_line_1: owner.tax_address_line_1,
      tax_address_line_2: owner.tax_address_line_2,
      tax_address_line_3: owner.tax_address_line_3,
      tax_city: owner.tax_city,
      tax_state: owner.tax_state,
      tax_postal_code: owner.tax_postal_code,
      tax_country: owner.tax_country,
      // Computed fields
      displayName: contact?.display_name || (contact?.is_company 
        ? contact?.company_name 
        : `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()),
      addressLine1: contact?.primary_address_line_1, // Legacy compatibility
      // Total units calculated from properties
      total_units: totalUnits
    };

    console.log('🔍 Owner Details API: Transformation completed');
    return NextResponse.json(transformedOwner);
  } catch (error) {
    console.error('🔍 Owner Details API: Caught error:', error);
    
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      console.log('🔍 Owner Details API: Authentication error');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('🔍 Owner Details API: Unexpected error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch owner', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('🔍 Owner Update API: Starting request for owner ID:', resolvedParams.id);
    
    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      console.log('🔍 Owner Update API: Rate limit exceeded');
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    console.log('🔍 Owner Update API: Rate limit check passed');

    // Authentication
    const user = await requireUser(request);
    console.log('🔍 Owner Update API: User authenticated:', user.id);

    const body = await request.json();
    console.log('🔍 Owner Update API: Received body:', body);

    // Extract fields from the request
    const { 
      // Contact fields
      firstName, 
      lastName, 
      isCompany = false, 
      companyName, 
      primaryEmail,
      altEmail,
      primaryPhone,
      altPhone,
      dateOfBirth,
      // Primary address
      primaryAddressLine1,
      primaryAddressLine2,
      primaryAddressLine3,
      primaryCity,
      primaryState,
      primaryPostalCode,
      primaryCountry,
      // Alternative address
      altAddressLine1,
      altAddressLine2,
      altAddressLine3,
      altCity,
      altState,
      altPostalCode,
      altCountry,
      mailingPreference,
      // Tax information
      taxPayerId,
      taxPayerType,
      taxPayerName,
      taxAddressLine1,
      taxAddressLine2,
      taxAddressLine3,
      taxCity,
      taxState,
      taxPostalCode,
      taxCountry,
      // Owner-specific fields
      managementAgreementStartDate,
      managementAgreementEndDate,
      comment,
      etfAccountType,
      etfAccountNumber,
      etfRoutingNumber,
      // Legacy support
      email,
      phoneHome,
      phoneMobile,
      addressLine1,
      city,
      state,
      postalCode,
      country
    } = body;

    // Handle legacy field mapping
    const finalPrimaryEmail = primaryEmail || email;
    const finalPrimaryPhone = primaryPhone || phoneMobile || phoneHome;
    const finalPrimaryAddressLine1 = primaryAddressLine1 || addressLine1;
    const finalPrimaryCity = primaryCity || city;
    const finalPrimaryState = primaryState || state;
    const finalPrimaryPostalCode = primaryPostalCode || postalCode;
    const finalPrimaryCountry = primaryCountry || country || 'USA';

    // Validation
    if (isCompany && !companyName) {
      return NextResponse.json(
        { error: 'Company name is required for company owners' },
        { status: 400 }
      );
    }

    if (!isCompany && (!firstName || !lastName)) {
      return NextResponse.json(
        { error: 'First name and last name are required for individual owners' },
        { status: 400 }
      );
    }

    if (!finalPrimaryEmail) {
      return NextResponse.json(
        { error: 'Primary email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalPrimaryEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!finalPrimaryAddressLine1 || !finalPrimaryPostalCode) {
      return NextResponse.json(
        { error: 'Primary address line 1 and postal code are required' },
        { status: 400 }
      );
    }

    // Get the owner to find the contact_id
    const { data: existingOwner, error: ownerError } = await supabaseAdmin
      .from('owners')
      .select('contact_id')
      .eq('id', resolvedParams.id)
      .single();

    if (ownerError) {
      console.error('🔍 Owner Update API: Error fetching owner:', ownerError);
      return NextResponse.json(
        { error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Update contact information
    const contactData = {
      is_company: isCompany,
      first_name: isCompany ? null : firstName,
      last_name: isCompany ? null : lastName,
      company_name: isCompany ? companyName : null,
      // display_name will be auto-generated by the trigger
      primary_email: finalPrimaryEmail,
      alt_email: altEmail,
      primary_phone: finalPrimaryPhone,
      alt_phone: altPhone,
      date_of_birth: dateOfBirth,
      primary_address_line_1: finalPrimaryAddressLine1,
      primary_address_line_2: primaryAddressLine2,
      primary_address_line_3: primaryAddressLine3,
      primary_city: finalPrimaryCity,
      primary_state: finalPrimaryState,
      primary_postal_code: finalPrimaryPostalCode,
      primary_country: finalPrimaryCountry,
      alt_address_line_1: altAddressLine1,
      alt_address_line_2: altAddressLine2,
      alt_address_line_3: altAddressLine3,
      alt_city: altCity,
      alt_state: altState,
      alt_postal_code: altPostalCode,
      alt_country: altCountry,
      mailing_preference: mailingPreference,
      updated_at: new Date().toISOString()
    };

          const { error: contactUpdateError } = await supabaseAdmin
      .from('contacts')
      .update(contactData)
      .eq('id', existingOwner.contact_id);

    if (contactUpdateError) {
      console.error('🔍 Owner Update API: Error updating contact:', contactUpdateError);
      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      );
    }

    // Update owner record
    const ownerData = {
      management_agreement_start_date: managementAgreementStartDate,
      management_agreement_end_date: managementAgreementEndDate,
      comment: comment,
      etf_account_type: etfAccountType,
      etf_account_number: etfAccountNumber,
      etf_routing_number: etfRoutingNumber,
      // Tax information
      tax_payer_id: taxPayerId,
      tax_payer_type: taxPayerType,
      tax_payer_name: taxPayerName,
      tax_address_line_1: taxAddressLine1,
      tax_address_line_2: taxAddressLine2,
      tax_address_line_3: taxAddressLine3,
      tax_city: taxCity,
      tax_state: taxState,
      tax_postal_code: taxPostalCode,
      tax_country: taxCountry,
      updated_at: new Date().toISOString()
    };

    const { error: ownerUpdateError } = await supabaseAdmin
      .from('owners')
      .update(ownerData)
      .eq('id', resolvedParams.id);

    if (ownerUpdateError) {
      console.error('🔍 Owner Update API: Error updating owner:', ownerUpdateError);
      return NextResponse.json(
        { error: 'Failed to update owner' },
        { status: 500 }
      );
    }

    // Fetch the updated owner to return
    const { data: updatedOwner, error: fetchError } = await supabaseAdmin
      .from('owners')
      .select(`
        id,
        buildium_owner_id,
        contact_id,
        management_agreement_start_date,
        management_agreement_end_date,
        comment,
        etf_account_type,
        etf_account_number,
        etf_routing_number,
        tax_payer_id,
        tax_payer_type,
        tax_payer_name,
        tax_address_line_1,
        tax_address_line_2,
        tax_address_line_3,
        tax_city,
        tax_state,
        tax_postal_code,
        tax_country,
        created_at,
        updated_at,
        contacts!inner (
          id,
          is_company,
          first_name,
          last_name,
          company_name,
          primary_email,
          primary_phone,
          primary_address_line_1,
          primary_city,
          primary_state,
          primary_postal_code,
          primary_country
        )
      `)
      .eq('id', resolvedParams.id)
      .single();

    if (fetchError) {
      console.error('🔍 Owner Update API: Error fetching updated owner:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch updated owner' },
        { status: 500 }
      );
    }

    // Sync update to Buildium via Edge Function
    try {
      const contact = Array.isArray(updatedOwner.contacts) ? updatedOwner.contacts[0] : updatedOwner.contacts;
      const buildiumOwnerData = {
        id: updatedOwner.id,
        buildium_owner_id: updatedOwner.buildium_owner_id || undefined,
        FirstName: contact?.first_name || '',
        LastName: contact?.last_name || '',
        Email: contact?.primary_email || undefined,
        PhoneNumber: contact?.primary_phone || undefined,
        Address: {
          AddressLine1: contact?.primary_address_line_1 || '',
          AddressLine2: contact?.primary_address_line_2 || undefined,
          City: contact?.primary_city || '',
          State: contact?.primary_state || '',
          PostalCode: contact?.primary_postal_code || '',
          Country: contact?.primary_country || 'US'
        },
        TaxId: updatedOwner.tax_payer_id || undefined,
        IsActive: true
      }
      const syncRes = await buildiumEdgeClient.syncOwnerToBuildium(buildiumOwnerData)
      if (syncRes.success && syncRes.buildiumId && !updatedOwner.buildium_owner_id) {
        await supabaseAdmin
          .from('owners')
          .update({ buildium_owner_id: syncRes.buildiumId })
          .eq('id', updatedOwner.id)
      }
    } catch (syncErr) {
      console.warn('Owner update Buildium sync failed (non-fatal):', syncErr)
    }

    // Transform response to match expected format
    const contact = Array.isArray(updatedOwner.contacts) ? updatedOwner.contacts[0] : updatedOwner.contacts;
    const transformedOwner = {
      id: updatedOwner.id,
      contact_id: updatedOwner.contact_id,
      management_agreement_start_date: updatedOwner.management_agreement_start_date,
      management_agreement_end_date: updatedOwner.management_agreement_end_date,
      comment: updatedOwner.comment,
      etf_account_type: updatedOwner.etf_account_type,
      etf_account_number: updatedOwner.etf_account_number,
      etf_routing_number: updatedOwner.etf_routing_number,
      created_at: updatedOwner.created_at,
      updated_at: updatedOwner.updated_at,
      // Contact information flattened
      is_company: contact?.is_company,
      first_name: contact?.first_name,
      last_name: contact?.last_name,
      company_name: contact?.company_name,
      primary_email: contact?.primary_email,
      primary_phone: contact?.primary_phone,
      primary_address_line_1: contact?.primary_address_line_1,
      primary_city: contact?.primary_city,
      primary_state: contact?.primary_state,
      primary_postal_code: contact?.primary_postal_code,
      primary_country: contact?.primary_country,
      // Tax information from owners table
      tax_payer_id: updatedOwner.tax_payer_id,
      tax_payer_type: updatedOwner.tax_payer_type,
      tax_payer_name: updatedOwner.tax_payer_name,
      tax_address_line_1: updatedOwner.tax_address_line_1,
      tax_address_line_2: updatedOwner.tax_address_line_2,
      tax_address_line_3: updatedOwner.tax_address_line_3,
      tax_city: updatedOwner.tax_city,
      tax_state: updatedOwner.tax_state,
      tax_postal_code: updatedOwner.tax_postal_code,
      tax_country: updatedOwner.tax_country,
      // Computed fields
      displayName: contact?.is_company 
        ? contact?.company_name 
        : `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim(),
      addressLine1: contact?.primary_address_line_1 // Legacy compatibility
    };

    console.log('🔍 Owner Update API: Owner updated successfully:', updatedOwner.id);
    return NextResponse.json(transformedOwner);
  } catch (error) {
    console.error('🔍 Owner Update API: Caught error:', error);
    
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      console.log('🔍 Owner Update API: Authentication error');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('🔍 Owner Update API: Unexpected error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to update owner', details: errorMessage },
      { status: 500 }
    );
  }
}
