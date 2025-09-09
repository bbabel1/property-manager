import type { Context } from 'npm:hono'
import { getAuthorizedUser, supabase } from './auth-utils.tsx'
import type { PropertyManager, StaffMember } from './types.tsx'

// Enhanced debugging function to check what tables exist and have data
async function debugDatabaseTables(user: any) {
  console.log('=== DATABASE TABLES DEBUG ===');
  const tablesToCheck = ['staff', 'users', 'contacts', 'owners', 'tenants'];
  const results: any = {};
  
  for (const tableName of tablesToCheck) {
    try {
      console.log(`🔍 Checking table: ${tableName}`);
      
      // First, try to get schema info
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(3);
      
      if (sampleError) {
        results[tableName] = {
          exists: false,
          error: sampleError.message,
          code: sampleError.code
        };
        console.log(`❌ ${tableName}: ${sampleError.message} (${sampleError.code})`);
      } else {
        const hasData = sampleData && sampleData.length > 0;
        const columns = hasData ? Object.keys(sampleData[0]) : [];
        
        results[tableName] = {
          exists: true,
          hasData: hasData,
          rowCount: sampleData?.length || 0,
          columns: columns,
          sampleRecord: hasData ? sampleData[0] : null
        };
        
        console.log(`✅ ${tableName}: exists, ${sampleData?.length || 0} rows, columns: [${columns.join(', ')}]`);
        if (hasData) {
          console.log(`📄 Sample ${tableName} record:`, sampleData[0]);
        }
      }
    } catch (err) {
      results[tableName] = {
        exists: false,
        error: err?.message || 'Unknown error',
        exception: true
      };
      console.log(`❌ ${tableName}: Exception - ${err?.message}`);
    }
  }
  
  return results;
}

// More flexible helper function to validate if a record has usable name data
function hasUsableNameData(record: any): boolean {
  console.log(`🔍 Checking name data for record:`, {
    id: record.id,
    first_name: record.first_name,
    last_name: record.last_name,
    name: record.name,
    user_metadata: record.user_metadata,
    email: record.email
  });

  // Check for first_name and last_name (even if they're just single characters)
  const hasFirstLast = record.first_name?.trim() && record.last_name?.trim();
  
  // Check for a name field that can be split
  const hasNameField = record.name?.trim() && record.name.includes(' ');
  
  // Check for user_metadata names
  const hasUserMetadataNames = record.user_metadata?.first_name?.trim() && record.user_metadata?.last_name?.trim();
  const hasUserMetadataFullName = record.user_metadata?.name?.trim() && record.user_metadata.name.includes(' ');
  
  // Check for email as fallback (we can extract a name from email)
  const hasEmail = record.email?.trim();
  
  const result = hasFirstLast || hasNameField || hasUserMetadataNames || hasUserMetadataFullName || hasEmail;
  
  console.log(`📊 Name data validation result for ${record.id}:`, {
    hasFirstLast,
    hasNameField, 
    hasUserMetadataNames,
    hasUserMetadataFullName,
    hasEmail,
    finalResult: result
  });
  
  return result;
}

// More flexible helper function to extract name data from a record
function extractNameData(record: any): { firstName: string; lastName: string; fullName: string } {
  console.log(`🔍 Extracting name data from record ${record.id}...`);
  
  let firstName = '';
  let lastName = '';
  let fullName = '';
  
  // Strategy 1: Use existing first_name and last_name
  if (record.first_name?.trim() && record.last_name?.trim()) {
    firstName = record.first_name.trim();
    lastName = record.last_name.trim();
    fullName = `${firstName} ${lastName}`;
    console.log(`✅ Using first_name + last_name: ${firstName} ${lastName}`);
    return { firstName, lastName, fullName };
  }
  
  // Strategy 2: Use name field and split it
  if (record.name?.trim() && record.name.includes(' ')) {
    const nameParts = record.name.trim().split(' ');
    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(' ');
    fullName = record.name.trim();
    console.log(`✅ Using name field split: ${firstName} ${lastName}`);
    return { firstName, lastName, fullName };
  }
  
  // Strategy 3: Use user_metadata names
  if (record.user_metadata?.first_name?.trim() && record.user_metadata?.last_name?.trim()) {
    firstName = record.user_metadata.first_name.trim();
    lastName = record.user_metadata.last_name.trim();
    fullName = `${firstName} ${lastName}`;
    console.log(`✅ Using user_metadata first_name + last_name: ${firstName} ${lastName}`);
    return { firstName, lastName, fullName };
  }
  
  // Strategy 4: Use user_metadata full name and split it
  if (record.user_metadata?.name?.trim() && record.user_metadata.name.includes(' ')) {
    const nameParts = record.user_metadata.name.trim().split(' ');
    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(' ');
    fullName = record.user_metadata.name.trim();
    console.log(`✅ Using user_metadata name split: ${firstName} ${lastName}`);
    return { firstName, lastName, fullName };
  }
  
  // Strategy 5: Use email as fallback
  if (record.email?.trim()) {
    const emailPart = record.email.split('@')[0];
    const cleanEmail = emailPart.replace(/[^a-zA-Z]/g, '');
    firstName = cleanEmail || 'Manager';
    lastName = `(${record.email})`;
    fullName = `${firstName} ${lastName}`;
    console.log(`✅ Using email fallback: ${firstName} ${lastName}`);
    return { firstName, lastName, fullName };
  }
  
  // Final fallback
  firstName = 'Unknown';
  lastName = 'Manager';
  fullName = `Unknown Manager (ID: ${record.id})`;
  console.log(`⚠️ Using final fallback: ${firstName} ${lastName}`);
  return { firstName, lastName, fullName };
}

// Try to find property managers from available tables
async function findPropertyManagersInDatabase(user: any, debugInfo: any) {
  console.log('🔍 Attempting to find property managers in available tables...');
  console.log('🔍 Current user ID:', user.id);
  
  const managers: PropertyManager[] = [];
  let source = 'none';
  const rejectedRecords: any[] = [];
  
  // Strategy 1: Look for users with property manager role
  if (debugInfo.users?.exists) {
    console.log('📋 Strategy 1: Looking for users with property manager indicators...');
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .limit(50);
      
      if (!error && users && users.length > 0) {
        console.log(`Found ${users.length} users, checking for property manager indicators...`);
        
        users.forEach((userRecord: any) => {
          console.log(`🔍 Checking user ${userRecord.id}:`, userRecord);
          
          // Check if user metadata or other fields indicate property manager role
          const isPropertyManager = 
            userRecord.user_metadata?.role === 'property_manager' ||
            userRecord.role === 'property_manager' ||
            userRecord.title?.toLowerCase().includes('property manager') ||
            userRecord.position?.toLowerCase().includes('property manager');
          
          console.log(`📊 User ${userRecord.id} property manager check:`, {
            user_metadata_role: userRecord.user_metadata?.role,
            role: userRecord.role,
            title: userRecord.title,
            position: userRecord.position,
            isPropertyManager
          });
          
          // Process if they have a property manager role (with flexible name validation)
          if (isPropertyManager && hasUsableNameData(userRecord)) {
            const nameData = extractNameData(userRecord);
            
            const manager: PropertyManager = {
              id: userRecord.id,
              staffId: userRecord.id,
              userId: userRecord.id,
              firstName: nameData.firstName,
              lastName: nameData.lastName,
              email: userRecord.email || '',
              phone: userRecord.phone || userRecord.user_metadata?.phone || '',
              title: userRecord.title || userRecord.user_metadata?.title || 'Property Manager',
              status: userRecord.is_active !== false ? 'active' : 'inactive',
              fullName: nameData.fullName
            };
            managers.push(manager);
            console.log(`✅ Found valid property manager from users:`, manager);
          } else {
            rejectedRecords.push({
              source: 'users',
              id: userRecord.id,
              reason: !isPropertyManager ? 'Not marked as property manager' : 'Missing name data',
              record: userRecord
            });
            console.log(`⚠️ Rejected user ${userRecord.id} - ${!isPropertyManager ? 'Not property manager' : 'Missing name data'}`);
          }
        });
        
        if (managers.length > 0) {
          source = 'users_table';
        }
      }
    } catch (userError) {
      console.log('⚠️ Error checking users table:', userError);
    }
  }
  
  // Strategy 2: Look in staff table if it exists (THIS IS THE MAIN ONE FOR YOUR CASE)
  if (managers.length === 0 && debugInfo.staff?.exists) {
    console.log('📋 Strategy 2: Looking in staff table...');
    try {
      // First, try without user filtering to see all records
      const { data: allStaffMembers, error: allStaffError } = await supabase
        .from('staff')
        .select('*')
        .limit(50);
      
      if (!allStaffError && allStaffMembers) {
        console.log(`🔍 Found ${allStaffMembers.length} total staff members (all users):`);
        allStaffMembers.forEach((staff: any, index: number) => {
          console.log(`📄 Staff ${index + 1}:`, staff);
        });
      }
      
      // Now try with user filtering if the table has a user_id column
      const hasUserIdColumn = debugInfo.staff?.columns?.includes('user_id');
      console.log(`📊 Staff table has user_id column: ${hasUserIdColumn}`);
      
      let staffMembers;
      let error;
      
      if (hasUserIdColumn) {
        console.log(`🔍 Filtering staff by user_id = ${user.id}`);
        const result = await supabase
          .from('staff')
          .select('*')
          .eq('user_id', user.id)
          .limit(50);
        staffMembers = result.data;
        error = result.error;
        
        console.log(`📊 Found ${staffMembers?.length || 0} staff members for current user`);
      } else {
        console.log(`🔍 No user_id column, using all staff members`);
        staffMembers = allStaffMembers;
        error = allStaffError;
      }
      
      if (!error && staffMembers && staffMembers.length > 0) {
        console.log(`Processing ${staffMembers.length} staff members for current user...`);
        
        staffMembers.forEach((staff: any) => {
          console.log(`🔍 Processing staff member ${staff.id}:`, staff);
          
          // Always process staff members (they are already staff, so they're managers by default)
          if (hasUsableNameData(staff)) {
            const nameData = extractNameData(staff);
            
            const manager: PropertyManager = {
              id: staff.id,
              staffId: staff.id,
              userId: staff.user_id || staff.id,
              firstName: nameData.firstName,
              lastName: nameData.lastName,
              email: staff.email || '',
              phone: staff.phone || staff.phone_number || '',
              title: staff.title || 'Property Manager',
              status: staff.status || (staff.is_active !== false ? 'active' : 'inactive'),
              fullName: nameData.fullName
            };
            managers.push(manager);
            console.log(`✅ Found valid property manager from staff:`, manager);
          } else {
            rejectedRecords.push({
              source: 'staff',
              id: staff.id,
              reason: 'Missing name data',
              record: staff
            });
            console.log(`⚠️ Rejected staff ${staff.id} - Missing name data`);
          }
        });
        
        if (managers.length > 0) {
          source = 'staff_table';
        }
      } else if (error) {
        console.log('❌ Error querying staff table:', error);
      }
    } catch (staffError) {
      console.log('⚠️ Error checking staff table:', staffError);
    }
  }
  
  // Strategy 3: Look in contacts table for anyone who might be a property manager
  if (managers.length === 0 && debugInfo.contacts?.exists) {
    console.log('📋 Strategy 3: Looking in contacts table...');
    try {
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .limit(50);
      
      if (!error && contacts && contacts.length > 0) {
        console.log(`Found ${contacts.length} contacts`);
        
        contacts.forEach((contact: any) => {
          console.log(`🔍 Checking contact ${contact.id}:`, contact);
          
          // Only include contacts that seem like they could be property managers
          const mightBeManager = 
            contact.title?.toLowerCase().includes('manager') ||
            contact.role?.toLowerCase().includes('manager') ||
            contact.position?.toLowerCase().includes('manager') ||
            contact.company_role?.toLowerCase().includes('manager');
          
          if (mightBeManager && hasUsableNameData(contact)) {
            const nameData = extractNameData(contact);
            
            const manager: PropertyManager = {
              id: contact.id,
              staffId: contact.id,
              userId: contact.user_id || contact.id,
              firstName: nameData.firstName,
              lastName: nameData.lastName,
              email: contact.email || '',
              phone: contact.phone || contact.phone_number || '',
              title: contact.title || 'Property Manager',
              status: 'active',
              fullName: nameData.fullName
            };
            managers.push(manager);
            console.log(`✅ Found valid potential property manager from contacts:`, manager);
          } else {
            rejectedRecords.push({
              source: 'contacts',
              id: contact.id,
              reason: !mightBeManager ? 'Not marked as manager' : 'Missing name data',
              record: contact
            });
            console.log(`⚠️ Rejected contact ${contact.id} - ${!mightBeManager ? 'Not manager' : 'Missing name data'}`);
          }
        });
        
        if (managers.length > 0) {
          source = 'contacts_table';
        }
      }
    } catch (contactError) {
      console.log('⚠️ Error checking contacts table:', contactError);
    }
  }
  
  console.log(`📊 Final results: Found ${managers.length} managers, rejected ${rejectedRecords.length} records`);
  if (rejectedRecords.length > 0) {
    console.log('📄 Rejected records:', rejectedRecords);
  }
  
  return { managers, source, rejectedRecords };
}

// Get property managers with comprehensive database analysis
export async function getPropertyManagers(c: Context) {
  try {
    console.log('=== PROPERTY MANAGERS ENDPOINT (FLEXIBLE NAME VALIDATION) ===');
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('✅ User authenticated for staff search:', user.id);
    
    // First, debug what tables exist and have data
    const debugInfo = await debugDatabaseTables(user);
    
    // Try to find property managers from available tables
    const { managers, source, rejectedRecords } = await findPropertyManagersInDatabase(user, debugInfo);
    
    if (managers.length > 0) {
      console.log(`✅ Found ${managers.length} property managers from ${source}`);
      return c.json({ 
        managers,
        source: source,
        count: managers.length,
        debugInfo: debugInfo,
        rejectedRecords: rejectedRecords,
        message: `Found ${managers.length} property managers from ${source.replace('_', ' ')}`,
        dataValidation: 'Flexible name validation - accepts any record with usable name data'
      });
    }
    
    // If no real managers found, provide helpful information
    console.log('❌ No property managers found in any table');
    
    return c.json({ 
      managers: [],
      source: 'no_data',
      count: 0,
      debugInfo: debugInfo,
      rejectedRecords: rejectedRecords,
      message: 'No property managers found in database',
      dataValidation: 'Flexible name validation applied but no valid records found',
      suggestions: [
        'Check if staff records belong to your user_id',
        'Verify staff records have name fields (first_name, last_name, name, or email)',
        'Create users with proper name data and user_metadata.role = "property_manager"',
        'Add records to the staff table with name fields',
        'Add contacts with manager-related titles and name fields'
      ],
      availableTables: Object.keys(debugInfo).filter(table => debugInfo[table].exists)
    });
    
  } catch (error) {
    console.log('❌ Get property managers error:', error);
    
    return c.json({ 
      managers: [],
      source: 'error',
      count: 0,
      error: 'Failed to fetch property managers',
      details: error?.message || 'Unknown error',
      message: 'Database error occurred while fetching property managers'
    });
  }
}

// Create new property manager - enhanced to work with available tables
export async function createPropertyManager(c: Context) {
  try {
    console.log('=== CREATE PROPERTY MANAGER (ENHANCED) ===');
    const user = await getAuthorizedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    console.log('Manager creation data received:', body);
    
    const { firstName, lastName, email, phone, title, password, sendInvite } = body;
    
    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return c.json({ error: 'First name, last name, and email are required' }, 400);
    }
    
    // First, debug what tables exist
    const debugInfo = await debugDatabaseTables(user);
    console.log('Available tables for manager creation:', Object.keys(debugInfo).filter(table => debugInfo[table].exists));
    
    try {
      // Step 1: Create auth user
      console.log('Creating auth user...');
      const authUserData = {
        email: email.trim(),
        password: sendInvite ? undefined : password?.trim(),
        user_metadata: { 
          name: `${firstName.trim()} ${lastName.trim()}`,
          role: 'property_manager',
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          title: title?.trim() || 'Property Manager'
        },
        email_confirm: !sendInvite // Auto-confirm if not sending invite
      };
      
      let authUser;
      if (sendInvite) {
        // Send invitation
        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email.trim(), {
          data: authUserData.user_metadata
        });
        if (error) throw error;
        authUser = data.user;
      } else {
        // Create user directly
        const { data, error } = await supabase.auth.admin.createUser(authUserData);
        if (error) throw error;
        authUser = data.user;
      }
      
      console.log('✅ Auth user created:', authUser.id);
      
      // Step 2: Try to create records in available tables
      let finalManager: PropertyManager;
      
      // Try staff table first
      if (debugInfo.staff?.exists) {
        console.log('Creating staff record...');
        try {
          const { data: staffMember, error: staffError } = await supabase
            .from('staff')
            .insert([{
              user_id: authUser.id,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              phone: phone?.trim() || null,
              title: title?.trim() || 'Property Manager',
              status: 'active',
              created_at: new Date().toISOString()
            }])
            .select()
            .single();
          
          if (!staffError && staffMember) {
            console.log('✅ Staff record created:', staffMember.id);
            finalManager = {
              id: staffMember.id,
              staffId: staffMember.id,
              userId: authUser.id,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
              phone: phone?.trim() || '',
              title: title?.trim() || 'Property Manager',
              status: 'active',
              fullName: `${firstName.trim()} ${lastName.trim()}`
            };
          } else {
            throw staffError;
          }
        } catch (staffError) {
          console.log('❌ Staff creation failed:', staffError);
          throw staffError;
        }
      } else if (debugInfo.contacts?.exists) {
        // Try contacts table as fallback
        console.log('Creating contact record...');
        try {
          const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .insert([{
              user_id: authUser.id,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              phone: phone?.trim() || null,
              title: title?.trim() || 'Property Manager',
              created_at: new Date().toISOString()
            }])
            .select()
            .single();
          
          if (!contactError && contact) {
            console.log('✅ Contact record created:', contact.id);
            finalManager = {
              id: contact.id,
              staffId: contact.id,
              userId: authUser.id,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
              phone: phone?.trim() || '',
              title: title?.trim() || 'Property Manager',
              status: 'active',
              fullName: `${firstName.trim()} ${lastName.trim()}`
            };
          } else {
            throw contactError;
          }
        } catch (contactError) {
          console.log('❌ Contact creation failed:', contactError);
          throw contactError;
        }
      } else {
        // No suitable table found, return just the auth user info
        console.log('⚠️ No suitable table found for manager record, using auth user only');
        finalManager = {
          id: authUser.id,
          staffId: authUser.id,
          userId: authUser.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone?.trim() || '',
          title: title?.trim() || 'Property Manager',
          status: 'active',
          fullName: `${firstName.trim()} ${lastName.trim()}`
        };
      }
      
      return c.json({ 
        manager: finalManager,
        source: debugInfo.staff?.exists ? 'staff_table' : debugInfo.contacts?.exists ? 'contacts_table' : 'auth_only',
        message: 'Property manager created successfully'
      });
      
    } catch (authError) {
      console.log('❌ Auth/Database operation failed:', authError);
      return c.json({ 
        error: 'Failed to create property manager', 
        details: authError.message,
        debugInfo: debugInfo
      }, 500);
    }
  } catch (error) {
    console.log('❌ Create property manager error:', error);
    return c.json({ 
      error: 'Failed to create property manager', 
      details: error.message 
    }, 500);
  }
}