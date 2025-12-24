import Link from 'next/link';

import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { supabase, supabaseAdmin } from '@/lib/db';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ManageVendorCategories } from '../_components/manage-vendor-categories';

export const dynamic = 'force-dynamic';

export default async function ManageVendorCategoriesPage() {
  const db = (supabaseAdmin || supabase) as SupabaseClient<Database>;

  const { data: categoryRows, error: categoryError } = await db
    .from('vendor_categories')
    .select('id, name, is_active')
    .order('name', { ascending: true });

  if (categoryError?.message) {
    console.error('Failed to load vendor categories', categoryError);
  }

  const { data: vendorRows, error: vendorError } = await db
    .from('vendors')
    .select('vendor_category');

  if (vendorError?.message) {
    console.error('Failed to load vendors for category counts', vendorError);
  }

  const vendorCounts = new Map<string, number>();
  (vendorRows || []).forEach((vendor) => {
    if (vendor.vendor_category) {
      const next = (vendorCounts.get(vendor.vendor_category) || 0) + 1;
      vendorCounts.set(vendor.vendor_category, next);
    }
  });

  const categories =
    categoryRows?.map((cat) => ({
      id: cat.id,
      name: cat.name,
      isActive: cat.is_active,
      vendorCount: vendorCounts.get(cat.id) || 0,
    })) || [];

  return (
    <PageShell>
      <PageHeader
        title="Manage vendor categories"
        description="Organize vendors by category and add new categories as needed."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/vendors">Back to vendors</Link>
          </Button>
        }
      />
      <PageBody>
        <ManageVendorCategories categories={categories} />
      </PageBody>
    </PageShell>
  );
}
