import { NextResponse } from 'next/server';

import { supabase, supabaseAdmin } from '@/lib/db';

const db = supabaseAdmin || supabase;

export async function GET() {
  try {
    const { data, error } = await db
      .from('gl_accounts')
      .select('id, name, account_number, type, is_active')
      .eq('type', 'Expense')
      .is('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load expense accounts', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load expense accounts.' },
        { status: 500 },
      );
    }

    const accounts = Array.isArray(data)
      ? data.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          accountNumber: (row.account_number as string | null) ?? null,
        }))
      : [];

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Unexpected error loading expense accounts', error);
    return NextResponse.json(
      { success: false, error: 'Unexpected error loading expense accounts.' },
      { status: 500 },
    );
  }
}
