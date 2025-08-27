import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// List of known tables based on migration files
const knownTables = [
  'properties',
  'units',
  'owners',
  'ownerships',
  'contacts',
  'leases',
  'tenants',
  'bank_accounts',
  'transactions',
  'journal_entries',
  'vendors',
  'work_orders',
  'maintenance_requests',
  'inspections',
  'appliances',
  'rent_schedules',
  'buildium_sync_log',
  'buildium_webhook_events',
  'buildium_api_cache',
  'buildium_gl_accounts',
  'buildium_bills',
  'buildium_bill_payments',
  'buildium_lease_contacts',
  'buildium_lease_transactions',
  'buildium_lease_transaction_lines',
  'buildium_owner_requests',
  'buildium_resident_requests',
  'buildium_todo_requests',
  'buildium_tasks',
  'buildium_task_categories',
  'buildium_user_roles',
  'buildium_users',
  'buildium_vendor_categories',
  'buildium_work_orders',
  'buildium_files',
  'buildium_file_categories',
  'buildium_partial_payment_settings'
];

async function getTableSchema() {
  try {
    console.log('🔍 Querying database schema...\n');

    const schema: Record<string, any[]> = {};

    for (const tableName of knownTables) {
      try {
        // Try to get a single row to understand the structure
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`⚠️  Table ${tableName} not accessible or doesn't exist: ${error.message}`);
          continue;
        }

        // Get column information by examining the data structure
        if (data && data.length > 0) {
          const sampleRow = data[0];
          const columns = Object.keys(sampleRow).map(key => ({
            column_name: key,
            data_type: typeof sampleRow[key],
            sample_value: sampleRow[key]
          }));

          schema[tableName] = columns;

          console.log(`📊 Table: ${tableName}`);
          console.log(`   Columns: ${columns.length}`);
          
          // Display column details
          columns.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} (sample: ${JSON.stringify(col.sample_value)})`);
          });
          console.log('');
        } else {
          console.log(`📊 Table: ${tableName} (empty table)`);
          console.log('');
        }

      } catch (err) {
        console.log(`❌ Error accessing table ${tableName}:`, err);
      }
    }

    // Save schema to file
    const fs = require('fs');
    const schemaFile = 'scripts/database/current-schema.json';
    
    fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2));
    console.log(`💾 Schema saved to ${schemaFile}`);

    // Generate markdown documentation
    generateMarkdownDocs(schema);

  } catch (error) {
    console.error('Error:', error);
  }
}

function generateMarkdownDocs(schema: Record<string, any[]>) {
  const fs = require('fs');
  let markdown = '# Database Schema Documentation\n\n';
  markdown += 'Generated from live database on ' + new Date().toISOString() + '\n\n';

  for (const [tableName, columns] of Object.entries(schema)) {
    markdown += `## Table: \`${tableName}\`\n\n`;
    markdown += '| Column | Type | Sample Value | Description |\n';
    markdown += '|--------|------|--------------|-------------|\n';

    columns.forEach(col => {
      const sampleValue = col.sample_value !== null ? JSON.stringify(col.sample_value) : 'null';
      markdown += `| ${col.column_name} | ${col.data_type} | ${sampleValue} | |\n`;
    });

    markdown += '\n';
  }

  const docsFile = 'docs/database/current-schema.md';
  fs.writeFileSync(docsFile, markdown);
  console.log(`📝 Documentation saved to ${docsFile}`);
}

// Run the script
getTableSchema().then(() => {
  console.log('✅ Schema extraction complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
