import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/auth/roles';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';

const nameFromContact = (
  contact?:
    | {
        display_name?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | Array<{
        display_name?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }>,
): string => {
  if (!contact) return 'Vendor';
  const contactRecord = Array.isArray(contact) ? contact[0] : contact;
  if (!contactRecord) return 'Vendor';
  return (
    contactRecord.display_name ||
    contactRecord.company_name ||
    [contactRecord.first_name, contactRecord.last_name].filter(Boolean).join(' ') ||
    'Vendor'
  );
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const roles: AppRole[] =
      process.env.NODE_ENV === 'development'
        ? ['platform_admin']
        : (await requireAuth()).roles;

    if (!hasPermission(roles, 'monthly_logs.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { logId } = await params;
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        `
        id,
        org_id,
        property_id,
        unit_id,
        units:units(
          id,
          property_id,
          buildium_property_id,
          buildium_unit_id
        ),
        properties:properties(
          id,
          org_id,
          buildium_property_id
        )
      `,
      )
      .eq('id', logId)
      .maybeSingle();

    if (logError) throw logError;
    if (!monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    const unitRelation = Array.isArray(monthlyLog.units)
      ? monthlyLog.units[0]
      : monthlyLog.units ?? null;
    const propertyRelation = Array.isArray(monthlyLog.properties)
      ? monthlyLog.properties[0]
      : monthlyLog.properties ?? null;

    const propertyId =
      monthlyLog.property_id ?? unitRelation?.property_id ?? propertyRelation?.id ?? null;

    let orgId = monthlyLog.org_id ?? propertyRelation?.org_id ?? null;

    if (!orgId && propertyId) {
      const { data: propertyRow, error: propertyError } = await supabaseAdmin
        .from('properties')
        .select('org_id')
        .eq('id', propertyId)
        .maybeSingle();
      if (propertyError) {
        console.warn('Failed to resolve property org for monthly log', propertyId, propertyError);
      } else if (propertyRow?.org_id) {
        orgId = propertyRow.org_id;
      }
    }

    if (!orgId) {
      return NextResponse.json({
        vendors: [],
        categories: [],
        accountOptions: [],
        unmappedAccountCount: 0,
      });
    }

    const [accountsResult, vendorsResult, categoriesResult] = await Promise.all([
      supabaseAdmin
        .from('gl_accounts')
        .select('id, name, type, buildium_gl_account_id, org_id')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('vendors')
        .select(
          'id, buildium_vendor_id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
        )
        .order('updated_at', { ascending: false })
        .limit(200),
      supabaseAdmin.from('bill_categories').select('id, name, buildium_category_id').order('name'),
    ]);

    if (accountsResult.error) throw accountsResult.error;
    if (vendorsResult.error) throw vendorsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

    const allAccountOptions =
      accountsResult.data?.map((row) => ({
        id: String(row.id),
        name: row.name || 'Account',
        type: row.type || null,
        buildiumGlAccountId:
          typeof row.buildium_gl_account_id === 'number'
            ? row.buildium_gl_account_id
            : row.buildium_gl_account_id != null && !Number.isNaN(Number(row.buildium_gl_account_id))
              ? Number(row.buildium_gl_account_id)
              : null,
      })) ?? [];

    const accountOptions = allAccountOptions;
    const unmappedAccountCount = allAccountOptions.filter(
      (option) => option.buildiumGlAccountId == null,
    ).length;

    const vendors =
      (vendorsResult.data ?? [])
        .map((vendor) => {
          const buildiumVendorId =
            typeof vendor.buildium_vendor_id === 'number'
              ? vendor.buildium_vendor_id
              : vendor.buildium_vendor_id != null && !Number.isNaN(Number(vendor.buildium_vendor_id))
                ? Number(vendor.buildium_vendor_id)
                : null;

          if (buildiumVendorId == null) return null;

          return {
            id: String(vendor.id),
            name: nameFromContact(vendor.contact ?? undefined),
            buildiumVendorId,
          };
        })
        .filter(
          (vendor): vendor is { id: string; name: string; buildiumVendorId: number } => vendor !== null,
        )
        .sort((a, b) => a.name.localeCompare(b.name)) ?? [];

    const categories =
      categoriesResult.data?.map((category) => ({
        id: String(category.id),
        name: category.name,
        buildiumCategoryId:
          typeof category.buildium_category_id === 'number'
            ? category.buildium_category_id
            : null,
      })) ?? [];

    return NextResponse.json({
      vendors,
      categories,
      accountOptions,
      unmappedAccountCount,
      propertyContext: {
        propertyId,
        unitId: monthlyLog.unit_id,
        buildiumPropertyId: unitRelation?.buildium_property_id ?? propertyRelation?.buildium_property_id ?? null,
        buildiumUnitId: unitRelation?.buildium_unit_id ?? null,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/bill-options:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
