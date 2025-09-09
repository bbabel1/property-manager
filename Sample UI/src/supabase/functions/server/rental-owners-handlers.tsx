import type { Context } from 'npm:hono'
import { getAuthorizedUser, supabase } from './auth-utils.tsx'
import type { 
  RentalOwnerWithContact, 
  RentalOwnerDisplay, 
  RentalOwnersSearchResponse,
  RentalOwnerCreateRequest,
  RentalOwnerUpdateRequest,
  RentalOwnerCreateResponse,
  RentalOwnerUpdateResponse,
  Contact,
  RentalOwner,
  Ownership
} from '../../utils/supabase/types.ts'

// Enhanced rental owner display interface that includes property relationships via ownership table
interface RentalOwnerWithProperties extends RentalOwnerDisplay {
  properties: Array<{
    id: string;
    name: string;
    address: string | null;
    ownership_percent: number;
    disbursement_percent: number;
    is_primary: boolean;
  }>;
  totalProperties: number;
  primaryProperty: string | null;
}

// Search rental owners with property relationships via ownership table
export async function searchRentalOwners(c: Context): Promise<Response> {
  try {
    console.log('=== RENTAL OWNERS SEARCH (NORMALIZED OWNERSHIP RELATIONSHIPS) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      console.log('❌ User not authenticated');
      const response: RentalOwnersSearchResponse = {
        owners: [],
        count: 0,
        source: 'error',
        queryUsed: 'unauthorized',
        contactsAvailable: false,
        error: 'Unauthorized'
      };
      return c.json(response, 401);
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Get search term from query parameters
    const url = new URL(c.req.url);
    const searchTerm = url.searchParams.get('q') || '';
    console.log('🔍 Search term:', searchTerm || 'none');
    
    // Use Guidelines.md pattern with proper ownership table relationships
    console.log('📋 Executing Guidelines.md JOIN with ownership relationships...');
    
    let query = supabase
      .from('rental_owners')
      .select(`
        id,
        contact_id,
        created_at,
        updated_at,
        contacts:contact_id (
          id,
          first_name,
          last_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          created_at,
          updated_at
        )
      `);
    
    // Apply search filter if provided
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.toLowerCase()}%`;
      query = query.or(
        `contacts.first_name.ilike.${searchPattern},contacts.last_name.ilike.${searchPattern},contacts.email.ilike.${searchPattern}`
      );
    }
    
    console.log('🗄️ Executing database query...');
    const { data: rentalOwners, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.log('❌ Guidelines JOIN query failed:', error.message);
      console.log('🔄 Attempting fallback strategies...');
      return await executeTypedFallback(searchTerm, c);
    }
    
    console.log(`✅ Guidelines JOIN successful: ${rentalOwners?.length || 0} records`);
    
    // Get property relationships via ownership table for each owner
    const ownersWithProperties: RentalOwnerWithProperties[] = [];
    
    for (const owner of rentalOwners || []) {
      console.log(`🏠 Fetching properties for owner ${owner.id} via ownership table...`);
      
      // Get properties through ownership table (normalized approach)
      const { data: ownerships, error: ownershipError } = await supabase
        .from('ownership')
        .select(`
          ownership_percent,
          disbursement_percent,
          is_primary,
          properties!inner (
            id,
            name,
            address,
            type,
            units
          )
        `)
        .eq('owner_id', owner.id);
      
      const contact = owner.contacts as Contact | null;
      const firstName = contact?.first_name || '';
      const lastName = contact?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || `Owner ${owner.id.substring(0, 8)}`;
      
      // Combine address fields into a single address string
      const addressParts = [
        contact?.address_line1,
        contact?.address_line2,
        contact?.city,
        contact?.state,
        contact?.postal_code,
        contact?.country
      ].filter(Boolean);
      const fullAddress = addressParts.join(', ');
      
      // Transform properties from ownership relationships
      const properties = (ownerships || []).map(ownership => ({
        id: ownership.properties.id,
        name: ownership.properties.name,
        address: ownership.properties.address,
        ownership_percent: ownership.ownership_percent,
        disbursement_percent: ownership.disbursement_percent,
        is_primary: ownership.is_primary
      }));
      
      const primaryProperty = properties.find(p => p.is_primary);
      
      const ownerWithProperties: RentalOwnerWithProperties = {
        id: owner.id,
        firstName: firstName,
        lastName: lastName,
        companyName: '',
        isCompany: false,
        fullName: fullName,
        email: contact?.email || '',
        phone: contact?.phone || '',
        address: fullAddress,
        contactId: owner.contact_id,
        createdAt: owner.created_at,
        source: 'database',
        queryUsed: 'guidelines_left_join_with_ownership',
        contactsAvailable: !!contact,
        contactData: contact || null,
        properties: properties,
        totalProperties: properties.length,
        primaryProperty: primaryProperty?.name || null
      };
      
      ownersWithProperties.push(ownerWithProperties);
    }
    
    console.log('📋 Sample owner with properties:', ownersWithProperties[0] ? {
      id: ownersWithProperties[0].id,
      fullName: ownersWithProperties[0].fullName,
      totalProperties: ownersWithProperties[0].totalProperties,
      primaryProperty: ownersWithProperties[0].primaryProperty
    } : 'no data');
    
    const response: RentalOwnersSearchResponse = {
      owners: ownersWithProperties,
      count: ownersWithProperties.length,
      source: 'database',
      queryUsed: 'guidelines_left_join_with_ownership_normalized',
      contactsAvailable: true,
      searchTerm: searchTerm || null,
      message: ownersWithProperties.length === 0 ? 'No rental owners found' : undefined,
      note: 'Using LEFT JOIN for contacts and normalized ownership table for property relationships'
    };
    
    console.log('✅ Returning successful response with ownership relationships');
    return c.json(response);
  } catch (error: any) {
    console.log('❌ Critical error in searchRentalOwners:', error);
    
    try {
      const errorResponse: RentalOwnersSearchResponse = {
        owners: [],
        count: 0,
        source: 'error',
        queryUsed: 'critical_error',
        contactsAvailable: false,
        error: 'Server error while searching rental owners',
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      };
      return c.json(errorResponse, 500);
    } catch (jsonError) {
      console.log('❌ Failed to return JSON error response:', jsonError);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

// Get single rental owner by ID with property relationships via ownership table
export async function getRentalOwnerById(c: Context): Promise<Response> {
  try {
    console.log('=== GET RENTAL OWNER BY ID (NORMALIZED OWNERSHIP RELATIONSHIPS) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const ownerId = c.req.param('id');
    if (!ownerId) {
      return c.json({ error: 'Owner ID is required' }, 400);
    }
    
    console.log(`📋 Fetching rental owner ${ownerId} with property relationships`);
    
    // Get owner with contact info using Guidelines pattern
    const { data: ownerData, error } = await supabase
      .from('rental_owners')
      .select(`
        id,
        contact_id,
        created_at,
        updated_at,
        contacts:contact_id (
          id,
          first_name,
          last_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          created_at,
          updated_at
        )
      `)
      .eq('id', ownerId)
      .single();
    
    if (error || !ownerData) {
      console.log('❌ Rental owner not found:', error?.message);
      return c.json({ 
        error: 'Rental owner not found',
        details: error?.message
      }, 404);
    }
    
    console.log(`🏠 Fetching property relationships via ownership table for owner ${ownerId}...`);
    
    // Get property relationships through ownership table (normalized approach)
    const { data: ownerships, error: ownershipError } = await supabase
      .from('ownership')
      .select(`
        ownership_percent,
        disbursement_percent,
        is_primary,
        created_at,
        properties!inner (
          id,
          name,
          address,
          type,
          units,
          created_at,
          updated_at
        )
      `)
      .eq('owner_id', ownerId);
    
    if (ownershipError) {
      console.log('❌ Error fetching ownership relationships:', ownershipError.message);
    }
    
    // Transform following Guidelines pattern with ownership relationships
    const contact = ownerData.contacts as Contact | null;
    
    // Combine address fields into a single address string
    const addressParts = [
      contact?.address_line1,
      contact?.address_line2,
      contact?.city,
      contact?.state,
      contact?.postal_code,
      contact?.country
    ].filter(Boolean);
    const fullAddress = addressParts.join(', ');
    
    const properties = (ownerships || []).map(ownership => ({
      id: ownership.properties.id,
      name: ownership.properties.name,
      address: ownership.properties.address,
      type: ownership.properties.type,
      units: ownership.properties.units,
      ownership_percent: ownership.ownership_percent,
      disbursement_percent: ownership.disbursement_percent,
      is_primary: ownership.is_primary,
      ownership_created_at: ownership.created_at
    }));
    
    const primaryProperty = properties.find(p => p.is_primary);
    
    const ownerWithProperties: RentalOwnerWithProperties = {
      id: ownerData.id,
      firstName: contact?.first_name || '',
      lastName: contact?.last_name || '',
      companyName: '',
      isCompany: false,
      fullName: contact ? 
        `${contact.first_name || ''} ${contact.last_name || ''}`.trim() :
        `Owner ${ownerData.id.substring(0, 8)}`,
      email: contact?.email || '',
      phone: contact?.phone || '',
      address: fullAddress,
      contactId: ownerData.contact_id,
      createdAt: ownerData.created_at,
      source: 'database',
      queryUsed: 'get_by_id_guidelines_left_join_with_ownership',
      contactsAvailable: !!contact,
      contactData: contact || null,
      properties: properties,
      totalProperties: properties.length,
      primaryProperty: primaryProperty?.name || null
    };
    
    console.log('✅ Rental owner retrieved with property relationships:', {
      ownerId: ownerWithProperties.id,
      fullName: ownerWithProperties.fullName,
      totalProperties: ownerWithProperties.totalProperties,
      primaryProperty: ownerWithProperties.primaryProperty
    });
    
    return c.json({ 
      owner: ownerWithProperties,
      strategy: 'guidelines_left_join_pattern_with_normalized_ownership',
      relationships: {
        properties: properties.length,
        primaryProperty: primaryProperty?.name || null,
        ownershipData: ownerships?.length || 0
      }
    });
  } catch (error: any) {
    console.log('❌ Get rental owner by ID error:', error);
    
    try {
      return c.json({ 
        error: 'Failed to get rental owner',
        details: error?.message || 'Unknown error'
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

// Add property ownership relationship (normalized approach)
export async function addPropertyOwnership(c: Context): Promise<Response> {
  try {
    console.log('=== ADD PROPERTY OWNERSHIP (NORMALIZED APPROACH) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const ownerId = c.req.param('id');
    if (!ownerId) {
      return c.json({ error: 'Owner ID is required' }, 400);
    }
    
    let body;
    try {
      body = await c.req.json();
    } catch (parseError: any) {
      return c.json({ 
        error: 'Invalid request body',
        details: parseError?.message || 'Failed to parse JSON'
      }, 400);
    }
    
    const { propertyId, ownershipPercent, disbursementPercent, isPrimary } = body;
    
    // Validate required fields
    if (!propertyId || ownershipPercent == null || disbursementPercent == null) {
      return c.json({ 
        error: 'Property ID, ownership percent, and disbursement percent are required'
      }, 400);
    }
    
    // Validate percentages
    if (ownershipPercent < 0 || ownershipPercent > 100 || disbursementPercent < 0 || disbursementPercent > 100) {
      return c.json({ 
        error: 'Ownership and disbursement percentages must be between 0 and 100'
      }, 400);
    }
    
    console.log(`🏠 Adding property ownership: Owner ${ownerId} -> Property ${propertyId}`);
    
    // Check if relationship already exists
    const { data: existingOwnership, error: checkError } = await supabase
      .from('ownership')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('property_id', propertyId)
      .single();
    
    if (existingOwnership) {
      return c.json({ 
        error: 'Ownership relationship already exists between this owner and property'
      }, 409);
    }
    
    // If setting as primary, remove primary status from other ownerships for this property
    if (isPrimary) {
      console.log('🎯 Setting as primary owner, updating existing primary ownerships...');
      await supabase
        .from('ownership')
        .update({ is_primary: false })
        .eq('property_id', propertyId)
        .eq('is_primary', true);
    }
    
    // Create ownership relationship
    const ownershipData = {
      owner_id: ownerId,
      property_id: propertyId,
      ownership_percent: ownershipPercent,
      disbursement_percent: disbursementPercent,
      is_primary: isPrimary || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: newOwnership, error: createError } = await supabase
      .from('ownership')
      .insert([ownershipData])
      .select(`
        *,
        properties!inner (
          id,
          name,
          address,
          type,
          units
        )
      `)
      .single();
    
    if (createError) {
      console.log('❌ Failed to create ownership relationship:', createError);
      return c.json({ 
        error: 'Failed to create ownership relationship',
        details: createError.message
      }, 500);
    }
    
    console.log('✅ Property ownership relationship created successfully');
    
    return c.json({ 
      ownership: newOwnership,
      message: 'Property ownership relationship created successfully',
      strategy: 'normalized_ownership_table'
    });
  } catch (error: any) {
    console.log('❌ Add property ownership error:', error);
    
    try {
      return c.json({ 
        error: 'Failed to add property ownership',
        details: error?.message || 'Unknown error'
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

// Remove property ownership relationship (normalized approach)
export async function removePropertyOwnership(c: Context): Promise<Response> {
  try {
    console.log('=== REMOVE PROPERTY OWNERSHIP (NORMALIZED APPROACH) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const ownerId = c.req.param('id');
    const propertyId = c.req.param('propertyId');
    
    if (!ownerId || !propertyId) {
      return c.json({ error: 'Owner ID and Property ID are required' }, 400);
    }
    
    console.log(`🏠 Removing property ownership: Owner ${ownerId} -> Property ${propertyId}`);
    
    // Get ownership relationship
    const { data: ownership, error: getError } = await supabase
      .from('ownership')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('property_id', propertyId)
      .single();
    
    if (getError || !ownership) {
      return c.json({ 
        error: 'Ownership relationship not found',
        details: getError?.message
      }, 404);
    }
    
    // Delete ownership relationship
    const { error: deleteError } = await supabase
      .from('ownership')
      .delete()
      .eq('owner_id', ownerId)
      .eq('property_id', propertyId);
    
    if (deleteError) {
      console.log('❌ Failed to remove ownership relationship:', deleteError);
      return c.json({ 
        error: 'Failed to remove ownership relationship',
        details: deleteError.message
      }, 500);
    }
    
    console.log('✅ Property ownership relationship removed successfully');
    
    return c.json({ 
      message: 'Property ownership relationship removed successfully',
      removedOwnership: ownership,
      strategy: 'normalized_ownership_table'
    });
  } catch (error: any) {
    console.log('❌ Remove property ownership error:', error);
    
    try {
      return c.json({ 
        error: 'Failed to remove property ownership',
        details: error?.message || 'Unknown error'
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

// Update property ownership relationship (normalized approach)
export async function updatePropertyOwnership(c: Context): Promise<Response> {
  try {
    console.log('=== UPDATE PROPERTY OWNERSHIP (NORMALIZED APPROACH) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const ownerId = c.req.param('id');
    const propertyId = c.req.param('propertyId');
    
    if (!ownerId || !propertyId) {
      return c.json({ error: 'Owner ID and Property ID are required' }, 400);
    }
    
    let body;
    try {
      body = await c.req.json();
    } catch (parseError: any) {
      return c.json({ 
        error: 'Invalid request body',
        details: parseError?.message || 'Failed to parse JSON'
      }, 400);
    }
    
    const { ownershipPercent, disbursementPercent, isPrimary } = body;
    
    // Validate percentages if provided
    if (ownershipPercent != null && (ownershipPercent < 0 || ownershipPercent > 100)) {
      return c.json({ 
        error: 'Ownership percentage must be between 0 and 100'
      }, 400);
    }
    
    if (disbursementPercent != null && (disbursementPercent < 0 || disbursementPercent > 100)) {
      return c.json({ 
        error: 'Disbursement percentage must be between 0 and 100'
      }, 400);
    }
    
    console.log(`🏠 Updating property ownership: Owner ${ownerId} -> Property ${propertyId}`);
    
    // If setting as primary, remove primary status from other ownerships for this property
    if (isPrimary === true) {
      console.log('🎯 Setting as primary owner, updating existing primary ownerships...');
      await supabase
        .from('ownership')
        .update({ is_primary: false })
        .eq('property_id', propertyId)
        .eq('is_primary', true)
        .neq('owner_id', ownerId); // Don't update the current ownership yet
    }
    
    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (ownershipPercent != null) updateData.ownership_percent = ownershipPercent;
    if (disbursementPercent != null) updateData.disbursement_percent = disbursementPercent;
    if (isPrimary != null) updateData.is_primary = isPrimary;
    
    // Update ownership relationship
    const { data: updatedOwnership, error: updateError } = await supabase
      .from('ownership')
      .update(updateData)
      .eq('owner_id', ownerId)
      .eq('property_id', propertyId)
      .select(`
        *,
        properties!inner (
          id,
          name,
          address,
          type,
          units
        )
      `)
      .single();
    
    if (updateError) {
      console.log('❌ Failed to update ownership relationship:', updateError);
      return c.json({ 
        error: 'Failed to update ownership relationship',
        details: updateError.message
      }, 500);
    }
    
    console.log('✅ Property ownership relationship updated successfully');
    
    return c.json({ 
      ownership: updatedOwnership,
      message: 'Property ownership relationship updated successfully',
      strategy: 'normalized_ownership_table'
    });
  } catch (error: any) {
    console.log('❌ Update property ownership error:', error);
    
    try {
      return c.json({ 
        error: 'Failed to update property ownership',
        details: error?.message || 'Unknown error'
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

// Typed fallback strategy (keeping existing implementation)
async function executeTypedFallback(searchTerm: string, c: Context): Promise<Response> {
  try {
    console.log('🔄 Executing typed fallback strategy...');
    
    // Try contacts table directly first
    console.log('📋 Trying contacts table directly...');
    let contactQuery = supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, address_line1, address_line2, city, state, postal_code, country, created_at, updated_at');
    
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.toLowerCase()}%`;
      contactQuery = contactQuery.or(
        `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`
      );
    }
    
    const { data: contacts, error: contactsError } = await contactQuery
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!contactsError && contacts && contacts.length > 0) {
      console.log(`✅ Contacts fallback successful: ${contacts.length} records`);
      
      const transformedOwners: RentalOwnerDisplay[] = contacts.map((contact): RentalOwnerDisplay => {
        const firstName = contact.first_name || '';
        const lastName = contact.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || `Contact ${contact.id.substring(0, 8)}`;
        
        // Combine address fields for fallback contacts
        const addressParts = [
          contact.address_line1,
          contact.address_line2,
          contact.city,
          contact.state,
          contact.postal_code,
          contact.country
        ].filter(Boolean);
        const fullAddress = addressParts.join(', ');
        
        return {
          id: contact.id,
          firstName: firstName,
          lastName: lastName,
          companyName: '',
          isCompany: false,
          fullName: fullName,
          email: contact.email || '',
          phone: contact.phone || '',
          address: fullAddress,
          contactId: contact.id,
          createdAt: contact.created_at,
          source: 'database',
          queryUsed: 'contacts_fallback',
          contactsAvailable: true,
          contactData: contact
        };
      });
      
      const response: RentalOwnersSearchResponse = {
        owners: transformedOwners,
        count: transformedOwners.length,
        source: 'database',
        queryUsed: 'contacts_fallback',
        contactsAvailable: true,
        searchTerm: searchTerm || null,
        note: 'Using contacts table as fallback'
      };
      
      return c.json(response);
    }
    
    // Try basic rental owners
    console.log('📋 Trying basic rental_owners...');
    const { data: owners, error: ownersError } = await supabase
      .from('rental_owners')
      .select('id, contact_id, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!ownersError && owners) {
      console.log(`✅ Basic rental owners fallback: ${owners.length} records`);
      
      const transformedOwners: RentalOwnerDisplay[] = owners.map((owner): RentalOwnerDisplay => ({
        id: owner.id,
        firstName: 'Owner',
        lastName: owner.id.substring(0, 8),
        companyName: '',
        isCompany: false,
        fullName: `Owner ${owner.id.substring(0, 8)}`,
        email: '',
        phone: '',
        address: '',
        contactId: owner.contact_id,
        createdAt: owner.created_at,
        source: 'database',
        queryUsed: 'basic_rental_owners',
        contactsAvailable: false,
        contactData: null
      }));
      
      const response: RentalOwnersSearchResponse = {
        owners: transformedOwners,
        count: transformedOwners.length,
        source: 'database',
        queryUsed: 'basic_rental_owners',
        contactsAvailable: false,
        searchTerm: searchTerm || null,
        note: 'Using basic rental owners data only'
      };
      
      return c.json(response);
    }
    
    // All fallbacks failed
    console.log('❌ All fallback strategies failed');
    const response: RentalOwnersSearchResponse = {
      owners: [],
      count: 0,
      source: 'database',
      queryUsed: 'all_fallbacks_failed',
      contactsAvailable: false,
      searchTerm: searchTerm || null,
      error: 'No accessible data found',
      details: `Contacts error: ${contactsError?.message || 'No data'}, Owners error: ${ownersError?.message || 'No data'}`
    };
    
    return c.json(response);
  } catch (fallbackError: any) {
    console.log('❌ Fallback strategies failed:', fallbackError);
    const response: RentalOwnersSearchResponse = {
      owners: [],
      count: 0,
      source: 'error',
      queryUsed: 'fallback_error',
      contactsAvailable: false,
      error: 'Fallback strategies failed',
      details: fallbackError?.message || 'Unknown error'
    };
    return c.json(response);
  }
}

// Create and update functions (keeping existing implementations)
export async function createRentalOwner(c: Context): Promise<Response> {
  try {
    console.log('=== CREATE RENTAL OWNER (NO PROPERTY ARRAYS) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    let body: RentalOwnerCreateRequest;
    try {
      body = await c.req.json();
    } catch (parseError: any) {
      console.log('❌ Failed to parse request body:', parseError);
      return c.json({ 
        error: 'Invalid request body',
        details: parseError?.message || 'Failed to parse JSON'
      }, 400);
    }
    
    console.log('📝 Request body received:', body);
    
    const { firstName, lastName, email, phone, address } = body;
    
    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim()) {
      return c.json({ 
        error: 'First name and last name are required'
      }, 400);
    }
    
    console.log('💾 Step 1: Creating contact record...');
    
    // Create contact first (following Guidelines pattern)
    const contactData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert([contactData])
      .select('id, first_name, last_name, email, phone, address, created_at, updated_at')
      .single();
    
    if (contactError) {
      console.log('❌ Contact creation failed:', contactError);
      return c.json({ 
        error: 'Failed to create contact record',
        details: contactError.message
      }, 500);
    }
    
    console.log('✅ Contact created:', contact.id);
    
    console.log('💾 Step 2: Creating rental_owner record (no property arrays)...');
    
    // Create rental_owner record - NO property_ids array
    const rentalOwnerData = {
      contact_id: contact.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
      // NO property_ids field - relationships managed via ownership table
    };
    
    const { data: rentalOwner, error: rentalOwnerError } = await supabase
      .from('rental_owners')
      .insert([rentalOwnerData])
      .select('id, contact_id, created_at, updated_at')
      .single();
    
    if (rentalOwnerError) {
      console.log('❌ Rental owner creation failed:', rentalOwnerError);
      
      // Clean up contact
      try {
        await supabase.from('contacts').delete().eq('id', contact.id);
        console.log('🧹 Cleaned up orphaned contact');
      } catch (cleanupError) {
        console.log('⚠️ Could not clean up contact:', cleanupError);
      }
      
      return c.json({ 
        error: 'Failed to create rental owner record',
        details: rentalOwnerError.message
      }, 500);
    }
    
    console.log('✅ Rental owner created (normalized - no property arrays):', rentalOwner.id);
    
    // Transform response following Guidelines pattern
    const transformedOwner: RentalOwnerDisplay = {
      id: rentalOwner.id, // rental_owner_id
      firstName: contact.first_name || '',
      lastName: contact.last_name || '',
      companyName: '',
      isCompany: false,
      fullName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      email: contact.email || '',
      phone: contact.phone || '',
      address: contact.address || '',
      contactId: contact.id,
      createdAt: rentalOwner.created_at,
      source: 'database',
      queryUsed: 'create_normalized_no_arrays',
      contactsAvailable: true,
      contactData: contact
    };
    
    const response: RentalOwnerCreateResponse = {
      owner: transformedOwner,
      contactCreated: true,
      rentalOwnerCreated: true,
      strategy: 'normalized_ownership_table'
    };
    
    console.log('📋 Note: Property relationships will be managed via ownership table');
    return c.json(response);
  } catch (error: any) {
    console.log('❌ Create rental owner error:', error);
    
    try {
      return c.json({ 
        error: 'Failed to create rental owner',
        details: error?.message || 'Unknown error'
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

export async function updateRentalOwner(c: Context): Promise<Response> {
  try {
    console.log('=== UPDATE RENTAL OWNER (CONTACT INFO ONLY) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const ownerId = c.req.param('id');
    if (!ownerId) {
      return c.json({ error: 'Owner ID is required' }, 400);
    }
    
    let body: RentalOwnerUpdateRequest;
    try {
      body = await c.req.json();
    } catch (parseError: any) {
      return c.json({ 
        error: 'Invalid request body',
        details: parseError?.message || 'Failed to parse JSON'
      }, 400);
    }
    
    const { firstName, lastName, email, phone, address } = body;
    
    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim()) {
      return c.json({ 
        error: 'First name and last name are required'
      }, 400);
    }
    
    console.log(`📝 Updating rental owner ${ownerId} (contact info only)`);
    
    // Get rental owner with contact info using Guidelines pattern
    const { data: ownerData, error: ownerError } = await supabase
      .from('rental_owners')
      .select(`
        id,
        contact_id,
        created_at,
        updated_at,
        contacts!inner (
          id,
          first_name,
          last_name,
          email,
          phone,
          address,
          created_at,
          updated_at
        )
      `)
      .eq('id', ownerId)
      .single();
    
    if (ownerError || !ownerData) {
      console.log('❌ Rental owner not found:', ownerError?.message);
      return c.json({ 
        error: 'Rental owner not found',
        details: ownerError?.message
      }, 404);
    }
    
    if (!ownerData.contact_id) {
      return c.json({ 
        error: 'No contact associated with this rental owner'
      }, 400);
    }
    
    console.log('💾 Updating contact record (property relationships unchanged)...');
    
    // Update contact information only - property relationships managed separately via ownership table
    const contactUpdateData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      updated_at: new Date().toISOString()
    };
    
    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update(contactUpdateData)
      .eq('id', ownerData.contact_id)
      .select('id, first_name, last_name, email, phone, address, created_at, updated_at')
      .single();
    
    if (updateError) {
      console.log('❌ Contact update failed:', updateError);
      return c.json({ 
        error: 'Failed to update contact information',
        details: updateError.message
      }, 500);
    }
    
    console.log('✅ Contact updated successfully (property relationships preserved)');
    
    // Transform response following Guidelines pattern
    const transformedOwner: RentalOwnerDisplay = {
      id: ownerData.id, // rental_owner_id
      firstName: updatedContact.first_name || '',
      lastName: updatedContact.last_name || '',
      companyName: '',
      isCompany: false,
      fullName: `${updatedContact.first_name || ''} ${updatedContact.last_name || ''}`.trim(),
      email: updatedContact.email || '',
      phone: updatedContact.phone || '',
      address: updatedContact.address || '',
      contactId: updatedContact.id,
      createdAt: ownerData.created_at,
      source: 'database',
      queryUsed: 'update_normalized_contact_only',
      contactsAvailable: true,
      contactData: updatedContact
    };
    
    const response: RentalOwnerUpdateResponse = {
      owner: transformedOwner,
      contactUpdated: true,
      strategy: 'normalized_ownership_table'
    };
    
    return c.json(response);
  } catch (error: any) {
    console.log('❌ Update rental owner error:', error);
    
    try {
      return c.json({ 
        error: 'Failed to update rental owner',
        details: error?.message || 'Unknown error'
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

// Legacy functions for backward compatibility - updated to use ownership table
export async function createPropertyOwnership(
  propertyId: string, 
  ownerships: Array<{
    property_id: string;
    owner_id: string;
    ownership_percent: number;
    disbursement_percent: number;
    is_primary: boolean;
  }>, 
  accessToken: string
) {
  try {
    console.log('=== CREATE PROPERTY OWNERSHIP (NORMALIZED TABLE) ===');
    
    // Validate business rules
    const totalOwnership = ownerships.reduce((sum, o) => sum + o.ownership_percent, 0);
    const totalDisbursement = ownerships.reduce((sum, o) => sum + o.disbursement_percent, 0);
    const primaryCount = ownerships.filter(o => o.is_primary).length;
    
    if (Math.abs(totalOwnership - 100) > 0.01) {
      throw new Error(`Total ownership must equal 100%, got ${totalOwnership}%`);
    }
    
    if (Math.abs(totalDisbursement - 100) > 0.01) {
      throw new Error(`Total disbursement must equal 100%, got ${totalDisbursement}%`);
    }
    
    if (primaryCount !== 1) {
      throw new Error(`Exactly one primary owner required, got ${primaryCount}`);
    }
    
    const ownershipData = ownerships.map(ownership => ({
      ...ownership,
      property_id: propertyId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    const { data: createdOwnerships, error } = await supabase
      .from('ownership')
      .insert(ownershipData)
      .select('*');
    
    if (error) {
      throw new Error(`Failed to create ownership records: ${error.message}`);
    }
    
    console.log('✅ Normalized ownership relationships created successfully');
    
    return {
      success: true,
      ownerships: createdOwnerships,
      businessRulesValidated: true,
      strategy: 'normalized_ownership_table'
    };
  } catch (error: any) {
    console.log('❌ Create ownership error:', error);
    throw error;
  }
}

export async function getPropertyOwnerships(c: Context): Promise<Response> {
  try {
    console.log('=== GET PROPERTY OWNERSHIPS (NORMALIZED TABLE) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const propertyId = c.req.param('propertyId');
    if (!propertyId) {
      return c.json({ error: 'Property ID is required' }, 400);
    }
    
    console.log(`🏠 Fetching property ownerships for property ${propertyId} from normalized table`);
    
    const { data: ownerships, error } = await supabase
      .from('ownership')
      .select(`
        *,
        rental_owners!inner (
          id,
          contact_id,
          contacts (
            first_name,
            last_name,
            email,
            phone
          )
        )
      `)
      .eq('property_id', propertyId)
      .order('is_primary', { ascending: false });
    
    if (error) {
      return c.json({ 
        error: 'Failed to fetch property ownerships',
        details: error.message,
        ownerships: []
      }, 500);
    }
    
    console.log(`✅ Retrieved ${ownerships?.length || 0} ownership relationships from normalized table`);
    
    return c.json({ 
      ownerships: ownerships || [],
      propertyId,
      count: (ownerships || []).length,
      strategy: 'normalized_ownership_table',
      note: 'Using ownership table for all property-owner relationships'
    });
  } catch (error: any) {
    console.log('❌ Get ownerships error:', error);
    
    try {
      return c.json({ 
        error: 'Failed to get property ownerships',
        details: error?.message || 'Unknown error',
        ownerships: []
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}