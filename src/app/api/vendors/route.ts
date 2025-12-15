
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { requireSupabaseAdmin } from '@/lib/supabase-client';

const CreateVendorSchema = z.object({
  name: z
    .string()
    .min(1, 'Vendor name is required')
    .max(255, 'Vendor name must be 255 characters or less'),
  categoryId: z
    .string()
    .uuid('Vendor category must be a valid ID')
    .optional()
    .nullable(),
  contactFirstName: z.string().max(255).optional(),
  contactLastName: z.string().max(255).optional(),
  contactEmail: z.string().email('Invalid email format').max(255).optional(),
  contactPhone: z.string().max(50).optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const normalize = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

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

  const parsed = CreateVendorSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json(
      { error: issue?.message ?? 'Invalid vendor payload' },
      { status: 400 },
    );
  }

  const admin = requireSupabaseAdmin('create vendor');
  const data = parsed.data;
  const nowIso = new Date().toISOString();

  const contactInsert = {
    is_company: true,
    company_name: data.name.trim(),
    display_name: data.name.trim(),
    first_name: normalize(data.contactFirstName),
    last_name: normalize(data.contactLastName),
    primary_email: normalize(data.contactEmail),
    primary_phone: normalize(data.contactPhone),
    primary_address_line_1: normalize(data.addressLine1),
    primary_address_line_2: normalize(data.addressLine2),
    primary_city: normalize(data.city),
    primary_state: normalize(data.state),
    primary_postal_code: normalize(data.postalCode),
    primary_country: normalize(data.country) ?? undefined,
    mailing_preference: 'primary' as const,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const contactRes = await admin
    .from('contacts')
    .insert(contactInsert)
    .select('id, display_name, company_name, first_name, last_name')
    .maybeSingle();

  if (contactRes.error || !contactRes.data) {
    console.error('create vendor: failed to insert contact', contactRes.error);
    return NextResponse.json(
      { error: 'Unable to create vendor contact record' },
      { status: 500 },
    );
  }

  const contactId = contactRes.data.id;

  let buildiumCategoryId: number | null = null;
  if (data.categoryId) {
    const categoryLookup = await admin
      .from('vendor_categories')
      .select('id, buildium_category_id')
      .eq('id', data.categoryId)
      .maybeSingle();

    if (categoryLookup.error) {
      console.error('create vendor: failed to fetch vendor category', categoryLookup.error);
    } else if (categoryLookup.data) {
      const candidate = categoryLookup.data.buildium_category_id;
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        buildiumCategoryId = candidate;
      }
    }
  }

  const vendorInsert = {
    contact_id: contactId,
    vendor_category: data.categoryId ?? null,
    buildium_category_id: buildiumCategoryId,
    notes: normalize(data.notes),
    created_at: nowIso,
    updated_at: nowIso,
  };

  const vendorRes = await admin
    .from('vendors')
    .insert(vendorInsert)
    .select(
      `
        id,
        contact:contact_id(
          display_name,
          company_name,
          first_name,
          last_name
        )
      `,
    )
    .maybeSingle();

  if (vendorRes.error || !vendorRes.data) {
    console.error('create vendor: failed to insert vendor', vendorRes.error);
    await admin.from('contacts').delete().eq('id', contactId);
    return NextResponse.json({ error: 'Unable to create vendor' }, { status: 500 });
  }

  const contact = Array.isArray(vendorRes.data.contact)
    ? vendorRes.data.contact[0]
    : vendorRes.data.contact;

  const label =
    contact?.display_name ||
    contact?.company_name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
    data.name.trim();

  return NextResponse.json(
    {
      data: {
        id: vendorRes.data.id,
        label,
        defaultTermDays: null,
      },
    },
    { status: 201 },
  );
}
