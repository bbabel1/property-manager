import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/auth/roles';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';

type OwnerContact = {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type OwnershipRow = {
  owner_id: string | null;
  disbursement_percentage: number | null;
  owners: {
    id: string | number;
    buildium_owner_id: number | null;
    contact?: OwnerContact | null;
  } | null;
};

const nameFromContact = (contact?: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string => {
  if (!contact) return 'Owner';
  return (
    contact.display_name ||
    contact.company_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    'Owner'
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
        properties:properties(
          id,
          org_id,
          buildium_property_id,
          operating_bank_gl_account_id
        ),
        units:units(
          id,
          property_id,
          buildium_property_id,
          buildium_unit_id
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

    const unitRecord = Array.isArray(monthlyLog.units) ? monthlyLog.units[0] : monthlyLog.units;
    const propertyRecord = Array.isArray(monthlyLog.properties)
      ? monthlyLog.properties[0]
      : monthlyLog.properties;

    let propertyId =
      monthlyLog.property_id ?? unitRecord?.property_id ?? propertyRecord?.id ?? null;
    let orgId = monthlyLog.org_id ?? propertyRecord?.org_id ?? null;
    let buildiumPropertyId =
      unitRecord?.buildium_property_id ?? propertyRecord?.buildium_property_id ?? null;
    const buildiumUnitId = unitRecord?.buildium_unit_id ?? null;
    let operatingBankGlAccountId = (propertyRecord as any)?.operating_bank_gl_account_id ?? null;

    if (!operatingBankGlAccountId && propertyId) {
      const { data: propertyRow, error: propertyError } = await supabaseAdmin
        .from('properties')
        .select('id, org_id, buildium_property_id, operating_bank_gl_account_id')
        .eq('id', propertyId)
        .maybeSingle();

      if (propertyError) throw propertyError;

      if (propertyRow) {
        propertyId = propertyRow.id;
        orgId = orgId ?? propertyRow.org_id ?? null;
        buildiumPropertyId = buildiumPropertyId ?? propertyRow.buildium_property_id ?? null;
        operatingBankGlAccountId =
          (propertyRow as any).operating_bank_gl_account_id ?? operatingBankGlAccountId;
      }
    }

    const unitId = monthlyLog.unit_id ?? unitRecord?.id ?? null;

    const propertyContext = {
      propertyId,
      unitId,
      buildiumPropertyId,
      buildiumUnitId,
    };

    let owners: Array<{
      id: string;
      name: string;
      buildiumOwnerId: number;
      disbursementPercentage: number | null;
    }> = [];
    if (propertyId) {
      const { data: ownershipRows, error: ownershipError } = await supabaseAdmin
        .from('ownerships')
        .select(
          `
          owner_id,
          disbursement_percentage,
          owners!inner(
            id,
            buildium_owner_id,
            contact:contacts(display_name, company_name, first_name, last_name)
          )
        `,
        )
        .eq('property_id', propertyId) as { data: OwnershipRow[] | null; error: unknown };

      if (ownershipError) throw ownershipError;

      owners =
        ownershipRows
          ?.map((row) => row.owners)
          ?.filter(
            (owner): owner is NonNullable<OwnershipRow['owners']> &
              Required<Pick<NonNullable<OwnershipRow['owners']>, 'buildium_owner_id'>> =>
              Boolean(
                owner &&
                  typeof owner.buildium_owner_id === 'number' &&
                  Number.isFinite(owner.buildium_owner_id),
              ),
          )
          ?.map((owner) => ({
            id: String(owner.id),
            name: nameFromContact(owner.contact ?? undefined),
            buildiumOwnerId: Number(owner.buildium_owner_id),
            disbursementPercentage:
              ownershipRows.find((row) => row.owner_id === owner.id)?.disbursement_percentage ??
              null,
          })) ?? [];
    }

    let bankAccount: {
      id: string;
      name: string | null;
      buildiumBankId: number | null;
      glAccountId: string | null;
      glAccountBuildiumId: number | null;
    } | null = null;

    const parseBuildiumId = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value);
      return null;
    };

    const bankGlAccountIdCandidate = operatingBankGlAccountId ?? null;
    let bankGlAccountRow:
      | {
          id: string;
          name: string | null;
          buildium_gl_account_id: unknown;
          is_bank_account: unknown;
        }
      | null = null;

    if (bankGlAccountIdCandidate) {
      const { data: glRow, error: glErr } = await supabaseAdmin
        .from('gl_accounts')
        .select('id, name, buildium_gl_account_id, is_bank_account')
        .eq('id', bankGlAccountIdCandidate)
        .maybeSingle();
      if (glErr) throw glErr;
      bankGlAccountRow = (glRow as any) ?? null;
    }

    if (bankGlAccountRow?.id && Boolean((bankGlAccountRow as any).is_bank_account)) {
      bankAccount = {
        id: bankGlAccountRow.id,
        name: bankGlAccountRow.name ?? null,
        buildiumBankId: parseBuildiumId((bankGlAccountRow as any).buildium_gl_account_id),
        glAccountId: bankGlAccountRow.id,
        glAccountBuildiumId: parseBuildiumId((bankGlAccountRow as any).buildium_gl_account_id),
      };
    }

    let ownerDrawAccount: { id: string; name: string; buildiumGlAccountId: number | null } | null =
      null;

    if (orgId) {
      const { data: ownerDrawRow, error: ownerDrawError } = await supabaseAdmin
        .from('gl_accounts')
        .select('id, name, buildium_gl_account_id')
        .eq('org_id', orgId)
        .ilike('name', 'owner draw')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ownerDrawError) throw ownerDrawError;

      if (ownerDrawRow) {
        ownerDrawAccount = {
          id: ownerDrawRow.id,
          name: ownerDrawRow.name || 'Owner Draw',
          buildiumGlAccountId:
            typeof ownerDrawRow.buildium_gl_account_id === 'number'
              ? ownerDrawRow.buildium_gl_account_id
              : typeof ownerDrawRow.buildium_gl_account_id === 'string' &&
                  Number.isFinite(Number(ownerDrawRow.buildium_gl_account_id))
                ? Number(ownerDrawRow.buildium_gl_account_id)
                : null,
        };
      }
    }

    return NextResponse.json({
      owners,
      bankAccount,
      ownerDrawAccount,
      propertyContext,
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/owner-draw-options:', error);
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
