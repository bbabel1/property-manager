import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { requireSupabaseAdmin } from '@/lib/supabase-client';

const CreateVendorCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(255, 'Category name must be 255 characters or less'),
});

export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unable to verify authentication' }, { status: 500 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = CreateVendorCategorySchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json(
      { error: issue?.message ?? 'Invalid category payload' },
      { status: 400 },
    );
  }

  const name = parsed.data.name.trim();
  const nowIso = new Date().toISOString();
  const admin = requireSupabaseAdmin('create vendor category');

  const { data, error } = await admin
    .from('vendor_categories')
    .insert({ name, is_active: true, created_at: nowIso, updated_at: nowIso })
    .select('id, name, is_active')
    .single();

  if (error || !data) {
    console.error('Failed to insert vendor category', error);
    return NextResponse.json({ error: 'Unable to create vendor category' }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        id: data.id,
        name: data.name,
        isActive: data.is_active ?? true,
      },
    },
    { status: 201 },
  );
}
