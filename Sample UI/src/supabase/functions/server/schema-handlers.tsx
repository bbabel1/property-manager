import type { Context } from 'npm:hono'
import { getAuthorizedUser, supabase } from './auth-utils.tsx'

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default?: string;
  table_name: string;
}

interface TableInfo {
  table_name: string;
  columns: ColumnInfo[];
  row_count?: number;
  sample_data?: any[];
}

interface ForeignKeyInfo {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  constraint_name: string;
}

interface SchemaInfo {
  tables: TableInfo[];
  foreign_keys: ForeignKeyInfo[];
  user_id: string;
  timestamp: string;
}

// Get complete database schema information
export async function getSchemaInfo(c: Context) {
  try {
    console.log('=== DATABASE SCHEMA INTROSPECTION ===');
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('🔍 Analyzing database schema for user:', user.id);
    
    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_schema_tables'); // We'll create this function
    
    if (tablesError) {
      console.log('❌ Cannot get schema via RPC, trying direct queries...');
      
      // Fallback: Try to get table information directly
      const knownTables = [
        'properties', 'rental_owners', 'contacts', 'property_owners',
        'staff', 'users', 'bank_accounts', 'tenants', 'leases'
      ];
      
      const schemaInfo: SchemaInfo = {
        tables: [],
        foreign_keys: [],
        user_id: user.id,
        timestamp: new Date().toISOString()
      };
      
      // Test each known table
      for (const tableName of knownTables) {
        try {
          console.log(`🔍 Testing table: ${tableName}`);
          
          // Try to get table structure by querying with limit 0
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);
          
          if (!error) {
            console.log(`✅ Table ${tableName} exists and is accessible`);
            
            // Get sample data and count for this table
            const { data: sampleData, error: sampleError } = await supabase
              .from(tableName)
              .select('*')
              .eq('user_id', user.id) // Filter by user where possible
              .limit(3);
            
            const { count, error: countError } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);
            
            schemaInfo.tables.push({
              table_name: tableName,
              columns: [], // We'll fill this with actual column info if possible
              row_count: count || 0,
              sample_data: sampleData || []
            });
            
            console.log(`📊 Table ${tableName}: ${count || 0} rows for user ${user.id}`);
            if (sampleData && sampleData.length > 0) {
              console.log(`📝 Sample data structure:`, Object.keys(sampleData[0]));
            }
          } else {
            console.log(`❌ Table ${tableName} not accessible:`, error.message);
          }
        } catch (tableError) {
          console.log(`❌ Error testing table ${tableName}:`, tableError);
        }
      }
      
      return c.json({ schema: schemaInfo });
    }
    
    console.log('✅ Schema information retrieved successfully');
    return c.json({ schema: tables });
  } catch (error) {
    console.log('❌ Schema introspection error:', error);
    return c.json({ 
      error: 'Failed to introspect database schema', 
      details: error.message 
    }, 500);
  }
}

// Validate that a table exists and has expected columns
export async function validateTableSchema(c: Context) {
  try {
    const { tableName, expectedColumns } = await c.req.json();
    const user = await getAuthorizedUser(c.req.raw);
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log(`🔍 Validating table schema: ${tableName}`);
    console.log(`📋 Expected columns:`, expectedColumns);
    
    // Test table access with a sample query
    const { data: sampleData, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      return c.json({
        valid: false,
        error: `Table ${tableName} not accessible: ${error.message}`,
        exists: false
      });
    }
    
    // Get actual columns from sample data
    const actualColumns = sampleData && sampleData.length > 0 
      ? Object.keys(sampleData[0]) 
      : [];
    
    // Check if expected columns exist
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    const extraColumns = actualColumns.filter(col => !expectedColumns.includes(col));
    
    const validation = {
      valid: missingColumns.length === 0,
      exists: true,
      actualColumns,
      expectedColumns,
      missingColumns,
      extraColumns,
      tableName
    };
    
    console.log(`📊 Validation result for ${tableName}:`, validation);
    
    return c.json({ validation });
  } catch (error) {
    console.log('❌ Table validation error:', error);
    return c.json({ 
      error: 'Failed to validate table schema', 
      details: error.message 
    }, 500);
  }
}

// Get data relationships and foreign keys
export async function getDataRelationships(c: Context) {
  try {
    console.log('=== ANALYZING DATA RELATIONSHIPS ===');
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const relationships = {
      properties_to_owners: [],
      properties_to_managers: [],
      owners_to_contacts: [],
      staff_to_users: [],
      user_id: user.id,
      timestamp: new Date().toISOString()
    };
    
    // Check properties → rental owners relationship via property_owners table
    try {
      const { data: propertyOwnerships, error: poError } = await supabase
        .from('property_owners')
        .select(`
          property_id,
          rental_owner_id,
          ownership_percent,
          is_primary,
          properties:property_id (id, name),
          rental_owners:rental_owner_id (id, is_company)
        `)
        .limit(5);
      
      if (!poError && propertyOwnerships) {
        relationships.properties_to_owners = propertyOwnerships;
        console.log('✅ Property-Owner relationships found:', propertyOwnerships.length);
      }
    } catch (error) {
      console.log('❌ Property-Owner relationship query failed:', error);
    }
    
    // Check rental owners → contacts relationship
    try {
      const { data: ownerContacts, error: ocError } = await supabase
        .from('rental_owners')
        .select(`
          id,
          is_company,
          contact_id,
          contacts:contact_id (
            id,
            first_name,
            last_name,
            email,
            company_name
          )
        `)
        .eq('user_id', user.id)
        .limit(5);
      
      if (!ocError && ownerContacts) {
        relationships.owners_to_contacts = ownerContacts;
        console.log('✅ Owner-Contact relationships found:', ownerContacts.length);
      }
    } catch (error) {
      console.log('❌ Owner-Contact relationship query failed:', error);
    }
    
    // Check staff → users relationship
    try {
      const { data: staffUsers, error: suError } = await supabase
        .from('staff')
        .select(`
          id,
          user_id,
          title,
          status,
          users:user_id (
            id,
            email,
            user_metadata
          )
        `)
        .limit(5);
      
      if (!suError && staffUsers) {
        relationships.staff_to_users = staffUsers;
        console.log('✅ Staff-User relationships found:', staffUsers.length);
      }
    } catch (error) {
      console.log('❌ Staff-User relationship query failed:', error);
    }
    
    return c.json({ relationships });
  } catch (error) {
    console.log('❌ Relationships analysis error:', error);
    return c.json({ 
      error: 'Failed to analyze data relationships', 
      details: error.message 
    }, 500);
  }
}

// Enforce real-data-only mode (no mocks/fallbacks)
export async function enforceRealDataOnly(c: Context) {
  try {
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('🚫 ENFORCING REAL DATA ONLY MODE');
    console.log('Checking all tables for actual user data...');
    
    const dataStatus = {
      user_id: user.id,
      timestamp: new Date().toISOString(),
      tables: {
        properties: { exists: false, count: 0, hasUserData: false },
        rental_owners: { exists: false, count: 0, hasUserData: false },
        contacts: { exists: false, count: 0, hasUserData: false },
        property_owners: { exists: false, count: 0, hasUserData: false },
        staff: { exists: false, count: 0, hasUserData: false },
        bank_accounts: { exists: false, count: 0, hasUserData: false }
      },
      realDataAvailable: false,
      mockDataDisabled: true
    };
    
    // Check each table for real user data
    const tablesToCheck = Object.keys(dataStatus.tables);
    
    for (const tableName of tablesToCheck) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        if (!error) {
          dataStatus.tables[tableName] = {
            exists: true,
            count: count || 0,
            hasUserData: (count || 0) > 0
          };
          
          console.log(`📊 ${tableName}: ${count || 0} records for user ${user.id}`);
        } else {
          console.log(`❌ ${tableName}: Not accessible - ${error.message}`);
        }
      } catch (error) {
        console.log(`❌ ${tableName}: Query failed - ${error}`);
      }
    }
    
    // Determine if real data is available
    dataStatus.realDataAvailable = Object.values(dataStatus.tables)
      .some(table => table.hasUserData);
    
    console.log('🔍 Real data availability:', dataStatus.realDataAvailable);
    
    return c.json({ dataStatus });
  } catch (error) {
    console.log('❌ Real data enforcement error:', error);
    return c.json({ 
      error: 'Failed to enforce real data only mode', 
      details: error.message 
    }, 500);
  }
}