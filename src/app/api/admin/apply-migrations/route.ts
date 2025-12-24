import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

export async function POST(request: NextRequest) {
  try {
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    
    if (!dbUrl) {
      return NextResponse.json(
        { error: 'DATABASE_URL or SUPABASE_DB_URL not found' },
        { status: 500 }
      );
    }

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    const results = [];

    for (let i = 0; i < migrations.length; i++) {
      const migrationFile = migrations[i];
      const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
      
      try {
        const sql = readFileSync(migrationPath, 'utf-8');
        await client.query(sql);
        results.push({ migration: migrationFile, status: 'success' });
      } catch (err: any) {
        const errMsg = err.message.split('\n')[0];
        if (
          errMsg.includes('already exists') ||
          errMsg.includes('duplicate') ||
          (errMsg.includes('constraint') && errMsg.includes('already'))
        ) {
          results.push({ migration: migrationFile, status: 'skipped', reason: errMsg });
        } else {
          await client.end();
          return NextResponse.json(
            { error: `Migration ${migrationFile} failed: ${errMsg}`, results },
            { status: 500 }
          );
        }
      }
    }

    // Verify
    const verifyResult = await client.query(
      'SELECT COUNT(*)::int as count FROM transaction_lines WHERE account_entity_type IS NULL'
    );
    const nullCount = verifyResult.rows[0]?.count || 0;

    await client.end();

    return NextResponse.json({
      success: true,
      results,
      verification: {
        nullEntityTypeCount: nullCount,
        allSet: nullCount === 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
