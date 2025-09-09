import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { getAuthorizedUser, supabase } from './auth-utils.tsx'
import { getPropertyManagers, createPropertyManager } from './staff-handlers.tsx'
import { 
  getProperties, 
  createProperty, 
  updateProperty,
  getPropertyUnits,
  createPropertyUnit,
  updatePropertyUnit,
  deletePropertyUnit,
  getPropertyById
} from './properties-handlers.tsx'
import { 
  searchRentalOwners, 
  createRentalOwner, 
  updateRentalOwner, 
  getRentalOwnerById, 
  createPropertyOwnership, 
  getPropertyOwnerships,
  addPropertyOwnership,
  removePropertyOwnership,
  updatePropertyOwnership
} from './rental-owners-handlers.tsx'
import { getSchemaInfo, validateTableSchema, getDataRelationships, enforceRealDataOnly } from './schema-handlers.tsx'
import * as kv from './kv_store.tsx'

const app = new Hono()

app.use('*', logger(console.log))
app.use('*', cors({
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['*'],
}))

// Enhanced global error handler
app.onError((err, c) => {
  console.error('❌ Global error handler caught:', err);
  
  try {
    return c.json({
      error: 'Internal server error',
      details: err?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      stack: err?.stack || 'No stack trace available'
    }, 500);
  } catch (jsonError) {
    console.error('❌ Failed to return JSON error:', jsonError);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});

// Health check
app.get('/make-server-04fa0d09/health', async (c) => {
  try {
    console.log('🔍 Health check called');
    return c.json({ 
      status: 'ok', 
      message: 'Property Management Server is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      buildiumCompatible: true,
      relationshipsSupported: ['RentalOwnerIds', 'Units'],
      flexibleSchema: true,
      environment: {
        hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        hasServiceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      }
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    return c.json({
      status: 'error',
      message: 'Health check failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Database Schema Analysis - Enhanced debug endpoint
app.get('/make-server-04fa0d09/debug/schema-analysis', async (c) => {
  try {
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('=== ENHANCED SCHEMA ANALYSIS ===');
    
    const analysis = {
      timestamp: new Date().toISOString(),
      user_id: user.id,
      tables: {},
      compatibility: {
        buildium: false,
        userFiltering: false,
        relationships: false
      }
    };
    
    const tablesToAnalyze = [
      'properties', 
      'units', 
      'rental_owners', 
      'contacts', 
      'ownership'
    ];
    
    for (const tableName of tablesToAnalyze) {
      try {
        console.log(`🔍 Analyzing ${tableName} table...`);
        
        // Get sample data to detect columns
        const { data: sampleData, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(3);
        
        if (sampleError) {
          analysis.tables[tableName] = {
            exists: false,
            error: sampleError.message,
            code: sampleError.code,
            accessible: false
          };
          console.log(`❌ ${tableName}: ${sampleError.message}`);
        } else {
          const hasData = sampleData && sampleData.length > 0;
          const columns = hasData ? Object.keys(sampleData[0]) : [];
          
          // Specific analysis for each table
          const tableAnalysis = {
            exists: true,
            accessible: true,
            hasData: hasData,
            rowCount: sampleData?.length || 0,
            columns: columns,
            sampleRecord: hasData ? sampleData[0] : null
          };
          
          // Properties table analysis
          if (tableName === 'properties') {
            tableAnalysis.hasUserIdColumn = columns.includes('user_id');
            tableAnalysis.hasUnitsCountColumn = columns.includes('units_count');
            tableAnalysis.hasNameColumn = columns.includes('name');
            tableAnalysis.hasAddressColumn = columns.includes('address');
            tableAnalysis.hasTypeColumn = columns.includes('type');
            tableAnalysis.buildiumCompatible = columns.includes('name');
            
            if (tableAnalysis.hasUserIdColumn) {
              analysis.compatibility.userFiltering = true;
            }
          }
          
          // Units table analysis
          if (tableName === 'units') {
            tableAnalysis.hasPropertyIdColumn = columns.includes('property_id');
            tableAnalysis.hasUserIdColumn = columns.includes('user_id');
            tableAnalysis.hasNameColumn = columns.includes('name');
            tableAnalysis.hasBedroomsColumn = columns.includes('bedrooms');
            tableAnalysis.hasBathroomsColumn = columns.includes('bathrooms');
            tableAnalysis.hasRentColumn = columns.includes('rent');
            tableAnalysis.hasStatusColumn = columns.includes('status');
            tableAnalysis.buildiumCompatible = columns.includes('property_id') && columns.includes('name');
            
            if (tableAnalysis.hasPropertyIdColumn) {
              analysis.compatibility.relationships = true;
            }
          }
          
          // Rental owners analysis
          if (tableName === 'rental_owners') {
            tableAnalysis.hasContactIdColumn = columns.includes('contact_id');
            tableAnalysis.guidelinesCompatible = columns.includes('contact_id');
          }
          
          // Contacts analysis
          if (tableName === 'contacts') {
            tableAnalysis.hasFirstNameColumn = columns.includes('first_name');
            tableAnalysis.hasLastNameColumn = columns.includes('last_name');
            tableAnalysis.hasEmailColumn = columns.includes('email');
            tableAnalysis.hasPhoneColumn = columns.includes('phone');
            tableAnalysis.guidelinesCompatible = columns.includes('first_name') && columns.includes('last_name');
          }
          
          // Ownership analysis
          if (tableName === 'ownership') {
            tableAnalysis.hasPropertyIdColumn = columns.includes('property_id');
            tableAnalysis.hasOwnerIdColumn = columns.includes('owner_id');
            tableAnalysis.hasOwnershipPercentColumn = columns.includes('ownership_percent');
            tableAnalysis.hasIsPrimaryColumn = columns.includes('is_primary');
            tableAnalysis.buildiumRentalOwnerIdsCompatible = columns.includes('property_id') && columns.includes('owner_id');
          }
          
          analysis.tables[tableName] = tableAnalysis;
          console.log(`✅ ${tableName}: ${columns.length} columns, ${hasData ? `${sampleData.length} rows` : 'empty'}`);
        }
      } catch (err) {
        analysis.tables[tableName] = {
          exists: false,
          error: err?.message || 'Unknown error',
          accessible: false
        };
        console.log(`❌ ${tableName}: ${err?.message}`);
      }
    }
    
    // Overall compatibility assessment
    const propertiesTable = analysis.tables['properties'];
    const unitsTable = analysis.tables['units'];
    const ownershipTable = analysis.tables['ownership'];
    
    analysis.compatibility.buildium = !!(
      propertiesTable?.buildiumCompatible &&
      unitsTable?.buildiumCompatible &&
      ownershipTable?.buildiumRentalOwnerIdsCompatible
    );
    
    // Recommendations based on analysis
    const recommendations = [];
    
    if (!propertiesTable?.exists) {
      recommendations.push('Create properties table with id, name columns');
    } else if (!propertiesTable.hasUserIdColumn) {
      recommendations.push('Properties table lacks user_id column - multi-tenant filtering disabled');
    }
    
    if (!unitsTable?.exists) {
      recommendations.push('Create units table with property_id, name columns for Buildium Units support');
    } else if (!unitsTable.hasPropertyIdColumn) {
      recommendations.push('Units table lacks property_id column - cannot link to properties');
    }
    
    if (!ownershipTable?.exists) {
      recommendations.push('Create ownership table for Buildium RentalOwnerIds support');
    }
    
    if (!analysis.tables['rental_owners']?.hasContactIdColumn) {
      recommendations.push('Rental owners table should have contact_id column for Guidelines.md compliance');
    }
    
    const summary = {
      tablesAnalyzed: tablesToAnalyze.length,
      existingTables: Object.values(analysis.tables).filter((t: any) => t.exists).length,
      tablesWithData: Object.values(analysis.tables).filter((t: any) => t.exists && t.hasData).length,
      buildiumCompatible: analysis.compatibility.buildium,
      userFilteringEnabled: analysis.compatibility.userFiltering,
      relationshipsWorking: analysis.compatibility.relationships,
      recommendations: recommendations
    };
    
    return c.json({
      ...analysis,
      summary,
      recommendations,
      note: 'Enhanced schema analysis for debugging database structure issues'
    });
  } catch (error) {
    console.error('❌ Schema analysis error:', error);
    return c.json({ 
      error: 'Schema analysis failed',
      details: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Properties routes - BUILDIUM-COMPATIBLE WITH FLEXIBLE SCHEMA
app.get('/make-server-04fa0d09/properties', async (c) => {
  try {
    console.log('🏢 Properties endpoint called (Buildium-compatible with flexible schema)');
    return await getProperties(c);
  } catch (error) {
    console.error('❌ Properties wrapper error:', error);
    return c.json({ error: 'Failed to get properties', details: error?.message }, 500);
  }
});

app.post('/make-server-04fa0d09/properties', async (c) => {
  try {
    console.log('🏢 Create property endpoint called (Buildium-compatible)');
    return await createProperty(c);
  } catch (error) {
    console.error('❌ Create property wrapper error:', error);
    return c.json({ error: 'Failed to create property', details: error?.message }, 500);
  }
});

app.get('/make-server-04fa0d09/properties/:id', async (c) => {
  try {
    console.log('🏢 Get property by ID endpoint called (Buildium-compatible with relationships)');
    return await getPropertyById(c);
  } catch (error) {
    console.error('❌ Get property by ID wrapper error:', error);
    return c.json({ error: 'Failed to get property', details: error?.message }, 500);
  }
});

app.put('/make-server-04fa0d09/properties/:id', async (c) => {
  try {
    console.log('🏢 Update property endpoint called (Buildium-compatible)');
    return await updateProperty(c);
  } catch (error) {
    console.error('❌ Update property wrapper error:', error);
    return c.json({ error: 'Failed to update property', details: error?.message }, 500);
  }
});

// Property Units routes - BUILDIUM UNITS SUPPORT
app.get('/make-server-04fa0d09/properties/:propertyId/units', async (c) => {
  try {
    console.log('🏠 Property units endpoint called (Buildium Units support)');
    return await getPropertyUnits(c);
  } catch (error) {
    console.error('❌ Property units wrapper error:', error);
    return c.json({ error: 'Failed to get property units', details: error?.message }, 500);
  }
});

app.post('/make-server-04fa0d09/properties/:propertyId/units', async (c) => {
  try {
    console.log('🏠 Create unit endpoint called (Buildium Units support)');
    return await createPropertyUnit(c);
  } catch (error) {
    console.error('❌ Create unit wrapper error:', error);
    return c.json({ error: 'Failed to create unit', details: error?.message }, 500);
  }
});

app.put('/make-server-04fa0d09/properties/:propertyId/units/:unitId', async (c) => {
  try {
    console.log('🏠 Update unit endpoint called (Buildium Units support)');
    return await updatePropertyUnit(c);
  } catch (error) {
    console.error('❌ Update unit wrapper error:', error);
    return c.json({ error: 'Failed to update unit', details: error?.message }, 500);
  }
});

app.delete('/make-server-04fa0d09/properties/:propertyId/units/:unitId', async (c) => {
  try {
    console.log('🏠 Delete unit endpoint called (Buildium Units support)');
    return await deletePropertyUnit(c);
  } catch (error) {
    console.error('❌ Delete unit wrapper error:', error);
    return c.json({ error: 'Failed to delete unit', details: error?.message }, 500);
  }
});

// Property ownerships routes - BUILDIUM RENTAL OWNER IDS SUPPORT
app.get('/make-server-04fa0d09/properties/:propertyId/ownerships', async (c) => {
  try {
    console.log('🏠 Property ownerships endpoint called (Buildium RentalOwnerIds support)');
    return await getPropertyOwnerships(c);
  } catch (error) {
    console.error('❌ Property ownerships error:', error);
    return c.json({ error: 'Failed to get property ownerships', details: error?.message }, 500);
  }
});

// Rental owners routes - NORMALIZED OWNERSHIP MODEL
app.get('/make-server-04fa0d09/rental-owners/search', async (c) => {
  try {
    console.log('🔍 Rental owners search endpoint called (normalized ownership)');
    return await searchRentalOwners(c);
  } catch (error) {
    console.error('❌ Rental owners search wrapper error:', error);
    try {
      return c.json({
        error: 'Failed to search rental owners',
        details: error?.message || 'Unknown error',
        owners: [],
        count: 0,
        source: 'error',
        timestamp: new Date().toISOString()
      }, 500);
    } catch (jsonError) {
      console.error('❌ Failed to return JSON error:', jsonError);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});

app.get('/make-server-04fa0d09/rental-owners/:id', async (c) => {
  try {
    console.log('🔍 Get rental owner by ID endpoint called (with normalized ownership)');
    return await getRentalOwnerById(c);
  } catch (error) {
    console.error('❌ Get rental owner by ID wrapper error:', error);
    try {
      return c.json({
        error: 'Failed to get rental owner',
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});

app.post('/make-server-04fa0d09/rental-owners', async (c) => {
  try {
    console.log('🔍 Create rental owner endpoint called (no property arrays)');
    return await createRentalOwner(c);
  } catch (error) {
    console.error('❌ Create rental owner wrapper error:', error);
    try {
      return c.json({
        error: 'Failed to create rental owner',
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});

app.put('/make-server-04fa0d09/rental-owners/:id', async (c) => {
  try {
    console.log('🔍 Update rental owner endpoint called (contact info only)');
    return await updateRentalOwner(c);
  } catch (error) {
    console.error('❌ Update rental owner wrapper error:', error);
    try {
      return c.json({
        error: 'Failed to update rental owner',
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});

// Property ownership management routes - BUILDIUM RENTAL OWNER IDS NORMALIZED APPROACH
app.post('/make-server-04fa0d09/rental-owners/:id/properties', async (c) => {
  try {
    console.log('🏠 Add property ownership endpoint called (Buildium RentalOwnerIds)');
    return await addPropertyOwnership(c);
  } catch (error) {
    console.error('❌ Add property ownership error:', error);
    try {
      return c.json({
        error: 'Failed to add property ownership',
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});

app.delete('/make-server-04fa0d09/rental-owners/:id/properties/:propertyId', async (c) => {
  try {
    console.log('🏠 Remove property ownership endpoint called (Buildium RentalOwnerIds)');
    return await removePropertyOwnership(c);
  } catch (error) {
    console.error('❌ Remove property ownership error:', error);
    try {
      return c.json({
        error: 'Failed to remove property ownership',
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});

app.put('/make-server-04fa0d09/rental-owners/:id/properties/:propertyId', async (c) => {
  try {
    console.log('🏠 Update property ownership endpoint called (Buildium RentalOwnerIds)');
    return await updatePropertyOwnership(c);
  } catch (error) {
    console.error('❌ Update property ownership error:', error);
    try {
      return c.json({
        error: 'Failed to update property ownership',
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});

// Legacy rental owners route
app.get('/make-server-04fa0d09/rental-owners', async (c) => {
  try {
    console.log('🔍 Legacy rental owners endpoint called (redirecting to normalized)');
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized', owners: [], count: 0 }, 401);
    }
    
    return await searchRentalOwners(c);
  } catch (error) {
    console.error('❌ Legacy rental owners wrapper error:', error);
    try {
      return c.json({ 
        error: 'Failed to fetch rental owners',
        details: error?.message || 'Unknown error',
        owners: [],
        count: 0,
        timestamp: new Date().toISOString()
      }, 500);
    } catch (jsonError) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});

// Schema routes
app.get('/make-server-04fa0d09/schema', async (c) => {
  try {
    return await getSchemaInfo(c);
  } catch (error) {
    console.error('❌ Schema info error:', error);
    return c.json({ error: 'Failed to get schema info', details: error?.message }, 500);
  }
});

app.post('/make-server-04fa0d09/schema/validate', async (c) => {
  try {
    return await validateTableSchema(c);
  } catch (error) {
    console.error('❌ Schema validate error:', error);
    return c.json({ error: 'Failed to validate schema', details: error?.message }, 500);
  }
});

app.get('/make-server-04fa0d09/schema/relationships', async (c) => {
  try {
    return await getDataRelationships(c);
  } catch (error) {
    console.error('❌ Schema relationships error:', error);
    return c.json({ error: 'Failed to get relationships', details: error?.message }, 500);
  }
});

app.get('/make-server-04fa0d09/data-status', async (c) => {
  try {
    return await enforceRealDataOnly(c);
  } catch (error) {
    console.error('❌ Data status error:', error);
    return c.json({ error: 'Failed to get data status', details: error?.message }, 500);
  }
});

// Debug endpoints
app.get('/make-server-04fa0d09/debug/buildium-compatibility', async (c) => {
  try {
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('=== DEBUG BUILDIUM COMPATIBILITY ===');
    
    const debug = {
      timestamp: new Date().toISOString(),
      user_id: user.id,
      buildiumCompatibility: 'active',
      flexibleSchema: true,
      supportedFeatures: ['RentalOwnerIds', 'Units', 'FlexibleSchema'],
      tests: []
    };
    
    // Test property with RentalOwnerIds
    try {
      console.log('🏢 Testing property with RentalOwnerIds...');
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .limit(1);
      
      if (properties && properties.length > 0) {
        const property = properties[0];
        const availableColumns = Object.keys(property);
        
        // Get RentalOwnerIds via ownership table
        const { data: ownerships, error: ownershipError } = await supabase
          .from('ownership')
          .select('owner_id')
          .eq('property_id', property.id);
        
        const rental_owner_ids = (ownerships || []).map(o => o.owner_id);
        
        debug.tests.push({
          name: 'Property with RentalOwnerIds',
          success: !propertiesError && !ownershipError,
          error: propertiesError?.message || ownershipError?.message,
          sampleData: {
            property_id: property.id,
            property_name: property.name,
            available_columns: availableColumns,
            has_user_id_column: availableColumns.includes('user_id'),
            rental_owner_ids: rental_owner_ids,
            total_owners: rental_owner_ids.length
          },
          buildiumFeature: 'RentalOwnerIds'
        });
      } else {
        debug.tests.push({
          name: 'Property with RentalOwnerIds',
          success: false,
          error: propertiesError?.message || 'No properties found',
          buildiumFeature: 'RentalOwnerIds'
        });
      }
    } catch (err) {
      debug.tests.push({
        name: 'Property with RentalOwnerIds',
        success: false,
        error: err?.message || 'Unknown error',
        buildiumFeature: 'RentalOwnerIds'
      });
    }
    
    return c.json(debug);
  } catch (error) {
    console.error('❌ Buildium compatibility debug error:', error);
    return c.json({ 
      error: 'Buildium compatibility debug failed',
      details: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Staff routes
app.get('/make-server-04fa0d09/staff/managers', async (c) => {
  try {
    return await getPropertyManagers(c);
  } catch (error) {
    console.error('❌ Property managers error:', error);
    return c.json({ error: 'Failed to get property managers', details: error?.message }, 500);
  }
});

app.post('/make-server-04fa0d09/staff/managers', async (c) => {
  try {
    return await createPropertyManager(c);
  } catch (error) {
    console.error('❌ Create property manager error:', error);
    return c.json({ error: 'Failed to create property manager', details: error?.message }, 500);
  }
});

// Auth routes
app.post('/make-server-04fa0d09/auth/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json()
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true
    })
    
    if (error) {
      console.log('Signup error:', error)
      return c.json({ error: `Signup failed: ${error.message}` }, 400)
    }
    
    return c.json({ user: data.user })
  } catch (error) {
    console.error('❌ Signup error:', error)
    return c.json({ error: 'Internal server error during signup', details: error?.message }, 500)
  }
})

// Other routes with similar flexible schema support...
// (keeping existing implementations for brevity)

// Bank accounts routes
app.get('/make-server-04fa0d09/bank-accounts', async (c) => {
  try {
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized', bankAccounts: [], count: 0 }, 401);
    }
    
    const { data: bankAccounts, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id);
    
    if (error) {
      return c.json({ 
        error: 'Bank accounts table not accessible',
        details: error.message,
        bankAccounts: [],
        count: 0
      }, 500);
    }
    
    const accountNames = (bankAccounts || []).map(account => 
      account.name || account.account_name || 'Unnamed Account'
    );
    
    return c.json({ 
      bankAccounts: accountNames,
      count: accountNames.length,
      source: 'database'
    });
  } catch (error) {
    console.error('❌ Bank accounts error:', error);
    return c.json({ 
      error: 'Failed to fetch bank accounts',
      details: error?.message,
      bankAccounts: [],
      count: 0
    }, 500);
  }
});

// Tenants routes
app.get('/make-server-04fa0d09/tenants', async (c) => {
  try {
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized', tenants: [] }, 401);
    }
    
    // Try SQL table first
    try {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', user.id);
      
      if (!error) {
        return c.json({ tenants: tenants || [], source: 'database' });
      }
    } catch (dbError) {
      console.log('❌ Tenants table not available, trying KV store');
    }
    
    // Fallback to KV store
    const tenants = await kv.getByPrefix(`tenant:${user.id}:`);
    return c.json({ tenants, source: 'kv_store' });
  } catch (error) {
    console.error('❌ Tenants error:', error);
    return c.json({ 
      error: 'Failed to fetch tenants',
      details: error?.message,
      tenants: []
    }, 500);
  }
});

// Catch-all for undefined routes
app.all('/make-server-04fa0d09/*', (c) => {
  const path = new URL(c.req.url).pathname;
  console.log('❌ Route not found:', path);
  return c.json({ 
    error: 'Route not found',
    path: path,
    method: c.req.method,
    timestamp: new Date().toISOString()
  }, 404);
});

// Root catch-all
app.all('*', (c) => {
  const path = new URL(c.req.url).pathname;
  console.log('❌ Invalid path:', path);
  return c.json({ 
    error: 'Invalid endpoint',
    path: path,
    method: c.req.method,
    note: 'All endpoints must start with /make-server-04fa0d09/',
    timestamp: new Date().toISOString()
  }, 404);
});

console.log('🚀 Starting Property Management Server (Flexible Schema + Buildium-Compatible)...');
console.log('📋 Routes registered:');
console.log('  === PROPERTIES (Flexible Schema + Buildium-Compatible) ===');
console.log('  - GET  /make-server-04fa0d09/properties (with RentalOwnerIds + Units)');
console.log('  - POST /make-server-04fa0d09/properties');
console.log('  - PUT  /make-server-04fa0d09/properties/:id');
console.log('  === UNITS (Buildium Units Support) ===');
console.log('  - GET  /make-server-04fa0d09/properties/:propertyId/units');
console.log('  - POST /make-server-04fa0d09/properties/:propertyId/units');
console.log('  - PUT  /make-server-04fa0d09/properties/:propertyId/units/:unitId');
console.log('  - DELETE /make-server-04fa0d09/properties/:propertyId/units/:unitId');
console.log('  === DEBUG ===');
console.log('  - GET  /make-server-04fa0d09/debug/schema-analysis');
console.log('  - GET  /make-server-04fa0d09/debug/buildium-compatibility');
console.log('✅ Buildium compatibility: ACTIVE');
console.log('✅ Flexible schema support: ACTIVE');
console.log('🏢 RentalOwnerIds: Supported via normalized ownership table');
console.log('🏠 Units: Supported via dedicated units table');
console.log('🔧 Schema flexibility: Auto-detects available columns');

Deno.serve(app.fetch)