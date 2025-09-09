import type { Context } from 'npm:hono'
import { getAuthorizedUser, supabase } from './auth-utils.tsx'
import type { 
  PropertyWithRelationships,
  PropertyDisplay,
  PropertiesSearchResponse,
  PropertyCreateRequest,
  PropertyUpdateRequest,
  PropertyCreateResponse,
  PropertyUpdateResponse,
  UnitDisplay,
  UnitsSearchResponse,
  UnitCreateRequest,
  UnitUpdateRequest,
  UnitCreateResponse,
  UnitUpdateResponse
} from '../../utils/supabase/types.ts'

// Helper function to construct full address from individual fields
function constructAddress(property: any): string {
  const addressParts = [];
  
  // Add street address - try all possible field variations
  const streetAddress = property.Street || property.street || property.Address || property.address || 
                       property.street_address || property.address_line1 || property.street_name || 
                       property.property_address || property.full_address;
  
  if (streetAddress) {
    addressParts.push(streetAddress);
  }
  
  // Add address line 2 if present
  if (property.address_line2) {
    addressParts.push(property.address_line2);
  }
  
  // Add city, state, zip - try all possible field variations
  const cityStateZip = [];
  const city = property.City || property.city;
  const state = property.State || property.state;
  const zip = property.Zip || property.zip || property.postal_code;
  
  if (city) {
    cityStateZip.push(city);
  }
  if (state) {
    cityStateZip.push(state);
  }
  if (zip) {
    cityStateZip.push(zip);
  }
  
  if (cityStateZip.length > 0) {
    addressParts.push(cityStateZip.join(', '));
  }
  
  const finalAddress = addressParts.join(', ') || '';
  return finalAddress;
}

// Create new property with complete information (type, address, owner, bank accounts, manager)
export async function createProperty(c: Context): Promise<Response> {
  try {
    console.log('=== CREATE PROPERTY (COMPLETE SETUP) ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      console.log('❌ User not authenticated');
      return c.json({ 
        error: 'Unauthorized',
        details: 'Valid authentication token required'
      }, 401);
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Parse request body
    let requestData;
    try {
      requestData = await c.req.json();
      console.log('📝 Request data received:', requestData);
    } catch (parseError: any) {
      console.log('❌ Failed to parse request body:', parseError.message);
      return c.json({
        error: 'Invalid request body',
        details: 'Request body must be valid JSON'
      }, 400);
    }
    
    // Validate required fields
    if (!requestData.type) {
      return c.json({
        error: 'Property type is required',
        details: 'Property type must be selected'
      }, 400);
    }
    
    if (!requestData.address_line_1 || !requestData.address_line_1.trim()) {
      return c.json({
        error: 'Street address is required',
        details: 'Street address cannot be empty'
      }, 400);
    }
    
    if (!requestData.city || !requestData.city.trim()) {
      return c.json({
        error: 'City is required',
        details: 'City cannot be empty'
      }, 400);
    }
    
    if (!requestData.state || !requestData.state.trim()) {
      return c.json({
        error: 'State is required',
        details: 'State cannot be empty'
      }, 400);
    }
    
    // Property name defaults if not provided (auto-generated from address)
    const propertyName = requestData.name?.trim() || `${requestData.address_line_1}${requestData.city ? `, ${requestData.city}` : ''}`;
    
    // Detect table structure for flexible column support
    const { data: sampleProperty } = await supabase
      .from('properties')
      .select('*')
      .limit(1);
    
    const availableColumns = sampleProperty && sampleProperty.length > 0 ? Object.keys(sampleProperty[0]) : [];
    const hasUserIdColumn = availableColumns.includes('user_id');
    
    console.log('📋 Detected properties table columns:', availableColumns);
    console.log('📋 Has user_id column:', hasUserIdColumn);
    
    // Build property data for database insertion based on available columns
    const propertyData: any = {
      name: propertyName,
      type: requestData.type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Add user_id if column exists
    if (hasUserIdColumn) {
      propertyData.user_id = user.id;
    }
    
    // Handle address fields flexibly - try different column variations
    if (requestData.address_line_1?.trim()) {
      if (availableColumns.includes('address_line1')) {
        propertyData.address_line1 = requestData.address_line_1.trim();
      } else if (availableColumns.includes('street_address')) {
        propertyData.street_address = requestData.address_line_1.trim();
      } else if (availableColumns.includes('Street')) {
        propertyData.Street = requestData.address_line_1.trim();
      } else if (availableColumns.includes('street')) {
        propertyData.street = requestData.address_line_1.trim();
      } else if (availableColumns.includes('Address')) {
        propertyData.Address = requestData.address_line_1.trim();
      } else if (availableColumns.includes('address')) {
        propertyData.address = requestData.address_line_1.trim();
      }
    }
    
    if (requestData.address_line_2?.trim() && availableColumns.includes('address_line2')) {
      propertyData.address_line2 = requestData.address_line_2.trim();
    }
    
    if (requestData.city?.trim()) {
      if (availableColumns.includes('city')) {
        propertyData.city = requestData.city.trim();
      } else if (availableColumns.includes('City')) {
        propertyData.City = requestData.city.trim();
      }
    }
    
    if (requestData.state?.trim()) {
      if (availableColumns.includes('state')) {
        propertyData.state = requestData.state.trim();
      } else if (availableColumns.includes('State')) {
        propertyData.State = requestData.state.trim();
      }
    }
    
    if (requestData.postal_code?.trim()) {
      if (availableColumns.includes('postal_code')) {
        propertyData.postal_code = requestData.postal_code.trim();
      } else if (availableColumns.includes('zip')) {
        propertyData.zip = requestData.postal_code.trim();
      } else if (availableColumns.includes('Zip')) {
        propertyData.Zip = requestData.postal_code.trim();
      }
    }
    
    if (requestData.country?.trim() && availableColumns.includes('country')) {
      propertyData.country = requestData.country.trim();
    } else if (requestData.country?.trim() && availableColumns.includes('Country')) {
      propertyData.Country = requestData.country.trim();
    }
    
    // Handle financial fields
    if (availableColumns.includes('operating_bank_account_id') && requestData.operating_bank_account_id) {
      propertyData.operating_bank_account_id = requestData.operating_bank_account_id;
    }
    
    if (availableColumns.includes('deposit_trust_account_id') && requestData.deposit_trust_account_id) {
      propertyData.deposit_trust_account_id = requestData.deposit_trust_account_id;
    }
    
    if (availableColumns.includes('property_reserve') && requestData.property_reserve !== undefined) {
      propertyData.property_reserve = requestData.property_reserve;
    }
    
    if (availableColumns.includes('property_manager_id') && requestData.property_manager_id) {
      propertyData.property_manager_id = requestData.property_manager_id;
    }
    
    console.log('🏢 Creating property with data:', Object.keys(propertyData));
    console.log('🏢 Property data values:', propertyData);
    
    // Insert the property into the database
    const { data: createdProperty, error: createError } = await supabase
      .from('properties')
      .insert([propertyData])
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Failed to create property:', createError.message);
      console.log('❌ Create error details:', createError);
      
      return c.json({
        error: 'Failed to create property',
        details: createError.message,
        code: createError.code
      }, 500);
    }
    
    if (!createdProperty) {
      return c.json({
        error: 'Property creation failed',
        details: 'No property data returned from database'
      }, 500);
    }
    
    console.log('✅ Property created successfully:', createdProperty.id);
    
    // If an owner was selected, create the ownership relationship
    if (requestData.owner_id) {
      console.log('🤝 Creating ownership relationship for owner:', requestData.owner_id);
      
      try {
        const { error: ownershipError } = await supabase
          .from('ownership')
          .insert([{
            property_id: createdProperty.id,
            owner_id: requestData.owner_id,
            ownership_percent: 100, // Default to 100% ownership
            disbursement_percent: 100, // Default to 100% disbursement
            is_primary: true, // First owner is primary
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        
        if (ownershipError) {
          console.log('⚠️ Failed to create ownership relationship:', ownershipError.message);
          // Don't fail the whole operation, just log the warning
        } else {
          console.log('✅ Ownership relationship created');
        }
      } catch (ownershipErr) {
        console.log('⚠️ Exception creating ownership relationship:', ownershipErr);
        // Don't fail the whole operation
      }
    }
    
    // Construct the full address for response
    const fullAddress = constructAddress(createdProperty);
    
    // Extract address components for response
    const addressComponents = {
      street_address: createdProperty.Street || createdProperty.street || createdProperty.Address || createdProperty.address || 
                     createdProperty.street_address || createdProperty.address_line1 || null,
      address_line1: createdProperty.address_line1 || null,
      address_line2: createdProperty.address_line2 || null,
      city: createdProperty.City || createdProperty.city || null,
      state: createdProperty.State || createdProperty.state || null,
      zip: createdProperty.Zip || createdProperty.zip || createdProperty.postal_code || null,
      postal_code: createdProperty.postal_code || createdProperty.Zip || createdProperty.zip || null,
      country: createdProperty.Country || createdProperty.country || null
    };
    
    // Build the response property object
    const responseProperty: PropertyDisplay = {
      id: createdProperty.id,
      name: createdProperty.name,
      address: fullAddress,
      type: createdProperty.type || 'Property',
      units_count: 0,
      createdAt: createdProperty.created_at,
      source: 'database',
      queryUsed: 'create_property_complete_setup',
      property_manager_id: createdProperty.property_manager_id || null,
      property_manager_name: null, // Will be populated later if needed
      property_manager_data: null,
      addressComponents: addressComponents,
      rental_owner_ids: requestData.owner_id ? [requestData.owner_id] : [],
      units: [],
      ownerships: [],
      totalOwners: requestData.owner_id ? 1 : 0,
      primaryOwner: null, // Will be populated later if needed
      totalUnits: 0,
      occupiedUnits: 0,
      availableUnits: 0
    };
    
    const response = {
      property: responseProperty,
      success: true,
      message: 'Property created successfully',
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Returning created property response');
    return c.json(response, 201);
    
  } catch (error: any) {
    console.log('❌ Critical error in createProperty:', error);
    console.log('❌ Error stack:', error.stack);
    
    return c.json({
      error: 'Internal server error',
      details: error?.message || 'Unknown server error occurred',
      timestamp: new Date().toISOString(),
      function: 'createProperty'
    }, 500);
  }
}

// Get property by ID with all relationships
export async function getPropertyById(c: Context): Promise<Response> {
  try {
    console.log('=== GET PROPERTY BY ID ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      console.log('❌ User not authenticated');
      return c.json({ 
        error: 'Unauthorized',
        details: 'Valid authentication token required'
      }, 401);
    }
    
    const propertyId = c.req.param('id');
    if (!propertyId) {
      console.log('❌ No property ID provided');
      return c.json({ 
        error: 'Property ID is required',
        details: 'Property ID parameter is missing from the request'
      }, 400);
    }
    
    console.log(`🏢 Fetching property ${propertyId} for user ${user.id}...`);
    
    // Get base property
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();
    
    if (propertyError || !property) {
      return c.json({
        error: 'Property not found',
        details: propertyError?.message || 'Property not found',
        propertyId: propertyId
      }, 404);
    }
    
    // Construct full address and extract individual components
    const fullAddress = constructAddress(property);
    
    // Extract individual address components for display
    const addressComponents = {
      street_address: property.Street || property.street || property.Address || property.address || 
                     property.street_address || property.address_line1 || property.street_name || 
                     property.property_address || property.full_address || null,
      address_line1: property.address_line1 || null,
      address_line2: property.address_line2 || null,
      city: property.City || property.city || null,
      state: property.State || property.state || null,
      zip: property.Zip || property.zip || property.postal_code || null,
      postal_code: property.postal_code || property.Zip || property.zip || null,
      country: property.Country || property.country || null
    };
    
    // Get Units for this property
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .eq('property_id', propertyId);
    
    if (unitsError) {
      console.log(`⚠️ Units query failed for property ${propertyId}:`, unitsError.message);
    }
    
    // Transform units data
    const unitsData = (units || []).map((unit: any) => ({
      id: unit.id,
      name: unit.name || unit.unit_name || unit.number || unit.unit_number || `Unit ${unit.id?.substring(0, 8)}`,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      square_feet: unit.square_feet,
      rent: unit.rent,
      status: unit.status
    }));
    
    // Calculate unit statistics
    const totalUnits = unitsData.length;
    const occupiedUnits = unitsData.filter(u => u.status === 'occupied').length;
    const availableUnits = unitsData.filter(u => u.status === 'available').length;
    
    // Get ownership information
    const { data: ownerships, error: ownershipError } = await supabase
      .from('ownership')
      .select(`
        owner_id,
        ownership_percent,
        disbursement_percent,
        is_primary
      `)
      .eq('property_id', propertyId);
    
    const ownershipDetails = [];
    const rental_owner_ids = [];
    
    for (const ownership of ownerships || []) {
      rental_owner_ids.push(ownership.owner_id);
      
      // Get rental owner info
      const { data: rentalOwner } = await supabase
        .from('rental_owners')
        .select('*')
        .eq('id', ownership.owner_id)
        .single();
      
      let ownerContactData = null;
      if (rentalOwner?.contact_id) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', rentalOwner.contact_id)
          .single();
        
        ownerContactData = contactData;
      }
      
      // Determine owner name
      let ownerName;
      if (rentalOwner?.is_company && rentalOwner?.company_name) {
        ownerName = rentalOwner.company_name;
      } else if (ownerContactData) {
        ownerName = `${ownerContactData.first_name || ''} ${ownerContactData.last_name || ''}`.trim();
      } else if (rentalOwner?.first_name || rentalOwner?.last_name) {
        ownerName = `${rentalOwner.first_name || ''} ${rentalOwner.last_name || ''}`.trim();
      } else {
        ownerName = `Owner ${rentalOwner?.id?.substring(0, 8) || 'Unknown'}`;
      }
      
      ownershipDetails.push({
        owner_id: ownership.owner_id,
        ownership_percent: ownership.ownership_percent || 0,
        disbursement_percent: ownership.disbursement_percent || 0,
        is_primary: ownership.is_primary || false,
        owner_name: ownerName,
        is_company: rentalOwner?.is_company || false,
        company_name: rentalOwner?.company_name || null,
        contact_info: ownerContactData ? {
          email: ownerContactData.email,
          phone: ownerContactData.phone,
          address: ownerContactData.address_line1 ? 
            [ownerContactData.address_line1, ownerContactData.city, ownerContactData.state].filter(Boolean).join(', ') :
            null
        } : null,
        contact_data: ownerContactData
      });
    }
    
    const primaryOwner = ownershipDetails.find(o => o.is_primary);
    
    // Build enhanced property with all relationships
    const enhancedProperty: PropertyDisplay = {
      id: property.id,
      name: property.name || 'Unnamed Property',
      address: fullAddress,
      type: property.type || 'Property',
      units_count: property.units_count || totalUnits,
      createdAt: property.created_at || new Date().toISOString(),
      source: 'database',
      queryUsed: 'complete_property_query',
      property_manager_id: property.property_manager_id || null,
      property_manager_name: null,
      property_manager_data: null,
      addressComponents: addressComponents,
      rental_owner_ids: rental_owner_ids,
      units: unitsData,
      ownerships: ownershipDetails,
      totalOwners: rental_owner_ids.length,
      primaryOwner: primaryOwner?.owner_name || null,
      totalUnits: totalUnits,
      occupiedUnits: occupiedUnits,
      availableUnits: availableUnits
    };
    
    const response = {
      property: enhancedProperty,
      success: true,
      source: 'database',
      pattern: 'complete property query',
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Returning property response');
    return c.json(response);
    
  } catch (error: any) {
    console.log('❌ Critical error in getPropertyById:', error);
    
    return c.json({
      error: 'Internal server error',
      details: error?.message || 'Unknown server error occurred',
      timestamp: new Date().toISOString(),
      function: 'getPropertyById'
    }, 500);
  }
}

// Get properties with relationships
export async function getProperties(c: Context): Promise<Response> {
  try {
    console.log('=== GET PROPERTIES ===');
    
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      console.log('❌ User not authenticated');
      const response: PropertiesSearchResponse = {
        properties: [],
        count: 0,
        source: 'error',
        queryUsed: 'unauthorized',
        relationshipsIncluded: false,
        error: 'Unauthorized'
      };
      return c.json(response, 401);
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Get search term from query parameters
    const url = new URL(c.req.url);
    const searchTerm = url.searchParams.get('q') || '';
    console.log('🔍 Search term:', searchTerm || 'none');
    
    // Detect the properties table structure
    const { data: sampleProperty, error: detectError } = await supabase
      .from('properties')
      .select('*')
      .limit(1);
    
    if (detectError) {
      console.log('❌ Properties table detection failed:', detectError.message);
      const response: PropertiesSearchResponse = {
        properties: [],
        count: 0,
        source: 'error',
        queryUsed: 'table_detection_failed',
        relationshipsIncluded: false,
        error: 'Properties table not accessible',
        details: detectError.message
      };
      return c.json(response, 500);
    }
    
    // Check what columns are available
    const availableColumns = sampleProperty && sampleProperty.length > 0 ? Object.keys(sampleProperty[0]) : [];
    const hasUserIdColumn = availableColumns.includes('user_id');
    
    console.log('📋 Available columns in properties table:', availableColumns);
    console.log('📋 Has user_id column:', hasUserIdColumn);
    
    // Build query based on available columns
    let query = supabase.from('properties').select('*');
    
    // Only filter by user_id if the column exists
    if (hasUserIdColumn) {
      console.log('🔒 Filtering by user_id:', user.id);
      query = query.eq('user_id', user.id);
    } else {
      console.log('⚠️ No user_id column found - returning all properties');
    }
    
    // Apply search filter if provided
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.toLowerCase()}%`;
      console.log('🔍 Applying search filter:', searchPattern);
      
      const searchConditions = [];
      if (availableColumns.includes('name')) searchConditions.push(`name.ilike.${searchPattern}`);
      if (availableColumns.includes('type')) searchConditions.push(`type.ilike.${searchPattern}`);
      
      if (searchConditions.length > 0) {
        query = query.or(searchConditions.join(','));
      }
    }
    
    const { data: properties, error: propertiesError } = await query
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (propertiesError) {
      console.log('❌ Properties query failed:', propertiesError.message);
      const response: PropertiesSearchResponse = {
        properties: [],
        count: 0,
        source: 'error',
        queryUsed: 'properties_query_failed',
        relationshipsIncluded: false,
        error: 'Failed to fetch properties',
        details: propertiesError.message
      };
      return c.json(response, 500);
    }
    
    console.log(`✅ Base properties fetched: ${properties?.length || 0} records`);
    
    if (!properties || properties.length === 0) {
      const response: PropertiesSearchResponse = {
        properties: [],
        count: 0,
        source: 'database',
        queryUsed: 'no_properties_found',
        relationshipsIncluded: false,
        searchTerm: searchTerm || null,
        message: 'No properties found in database'
      };
      return c.json(response);
    }
    
    // Enhance each property with relationships
    const enhancedProperties: PropertyDisplay[] = [];
    
    for (const property of properties) {
      // Construct full address
      const fullAddress = constructAddress(property);
      
      // Get ownership info
      const { data: ownerships } = await supabase
        .from('ownership')
        .select(`
          owner_id,
          ownership_percent,
          disbursement_percent,
          is_primary,
          rental_owners!inner (
            id,
            contact_id,
            contacts (
              first_name,
              last_name
            )
          )
        `)
        .eq('property_id', property.id);
      
      // Get units
      const { data: units } = await supabase
        .from('units')
        .select('*')
        .eq('property_id', property.id);
      
      // Transform ownership data
      const rental_owner_ids: string[] = (ownerships || []).map(o => o.owner_id);
      const ownershipDetails = (ownerships || []).map(ownership => {
        const owner = ownership.rental_owners;
        const contact = owner?.contacts;
        const ownerName = contact ? 
          `${contact.first_name || ''} ${contact.last_name || ''}`.trim() :
          `Owner ${owner?.id?.substring(0, 8) || 'Unknown'}`;
        
        return {
          owner_id: ownership.owner_id,
          ownership_percent: ownership.ownership_percent,
          disbursement_percent: ownership.disbursement_percent,
          is_primary: ownership.is_primary,
          owner_name: ownerName
        };
      });
      
      const primaryOwner = ownershipDetails.find(o => o.is_primary);
      
      // Transform units data
      const unitsData = (units || []).map(unit => ({
        id: unit.id,
        name: unit.name,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        square_feet: unit.square_feet,
        rent: unit.rent,
        status: unit.status
      }));
      
      // Calculate unit statistics
      const totalUnits = unitsData.length;
      const occupiedUnits = unitsData.filter(u => u.status === 'occupied').length;
      const availableUnits = unitsData.filter(u => u.status === 'available').length;
      
      // Build enhanced property
      const enhancedProperty: PropertyDisplay = {
        id: property.id,
        name: property.name || 'New Property',
        address: fullAddress || 'Address not set',
        type: property.type || 'Property',
        units_count: property.units_count || totalUnits,
        createdAt: property.created_at || new Date().toISOString(),
        source: 'database',
        queryUsed: hasUserIdColumn ? 'complete_with_user_filter' : 'complete_all_properties',
        addressComponents: {
          street_address: property.Street || property.street || property.Address || property.address || 
                         property.street_address || property.address_line1 || null,
          address_line1: property.address_line1 || null,
          address_line2: property.address_line2 || null,
          city: property.City || property.city || null,
          state: property.State || property.state || null,
          zip: property.Zip || property.zip || property.postal_code || null,
          postal_code: property.postal_code || property.Zip || property.zip || null,
          country: property.Country || property.country || null
        },
        rental_owner_ids: rental_owner_ids,
        units: unitsData,
        ownerships: ownershipDetails,
        totalOwners: rental_owner_ids.length,
        primaryOwner: primaryOwner?.owner_name || null,
        totalUnits: totalUnits,
        occupiedUnits: occupiedUnits,
        availableUnits: availableUnits
      };
      
      enhancedProperties.push(enhancedProperty);
    }
    
    const response: PropertiesSearchResponse = {
      properties: enhancedProperties,
      count: enhancedProperties.length,
      source: 'database',
      queryUsed: hasUserIdColumn ? 'complete_with_user_filter' : 'complete_all_properties',
      relationshipsIncluded: true,
      searchTerm: searchTerm || null,
      message: enhancedProperties.length === 0 ? 'No properties found' : undefined
    };
    
    console.log('✅ Returning properties response');
    return c.json(response);
  } catch (error: any) {
    console.log('❌ Critical error in getProperties:', error);
    
    try {
      const errorResponse: PropertiesSearchResponse = {
        properties: [],
        count: 0,
        source: 'error',
        queryUsed: 'critical_error',
        relationshipsIncluded: false,
        error: 'Server error while fetching properties',
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

// Stub implementations for other endpoints
export async function updateProperty(c: Context): Promise<Response> {
  return c.json({ message: 'Update property endpoint - implementation needed' });
}

export async function getPropertyUnits(c: Context): Promise<Response> {
  return c.json({ message: 'Get property units endpoint - implementation needed' });
}

export async function createPropertyUnit(c: Context): Promise<Response> {
  return c.json({ message: 'Create unit endpoint - implementation needed' });
}

export async function updatePropertyUnit(c: Context): Promise<Response> {
  return c.json({ message: 'Update unit endpoint - implementation needed' });
}

export async function deletePropertyUnit(c: Context): Promise<Response> {
  return c.json({ message: 'Delete unit endpoint - implementation needed' });
}