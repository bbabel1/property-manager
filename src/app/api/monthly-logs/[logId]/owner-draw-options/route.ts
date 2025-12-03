import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/auth/roles';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';

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
          operating_bank_account_id
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

    let propertyId =
      monthlyLog.property_id ??
      monthlyLog.units?.property_id ??
      monthlyLog.properties?.id ??
      null;
    let orgId = monthlyLog.org_id ?? monthlyLog.properties?.org_id ?? null;
    let buildiumPropertyId =
      monthlyLog.units?.buildium_property_id ??
      monthlyLog.properties?.buildium_property_id ??
      null;
    const buildiumUnitId = monthlyLog.units?.buildium_unit_id ?? null;
    let operatingBankAccountId = monthlyLog.properties?.operating_bank_account_id ?? null;

    if (!operatingBankAccountId && propertyId) {
      const { data: propertyRow, error: propertyError } = await supabaseAdmin
        .from('properties')
        .select('id, org_id, buildium_property_id, operating_bank_account_id')
        .eq('id', propertyId)
        .maybeSingle();

      if (propertyError) throw propertyError;

      if (propertyRow) {
        propertyId = propertyRow.id;
        orgId = orgId ?? propertyRow.org_id ?? null;
        buildiumPropertyId = buildiumPropertyId ?? propertyRow.buildium_property_id ?? null;
        operatingBankAccountId = propertyRow.operating_bank_account_id ?? operatingBankAccountId;
      }
    }

    const unitId = monthlyLog.unit_id ?? monthlyLog.units?.id ?? null;

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
        .eq('property_id', propertyId);

      if (ownershipError) throw ownershipError;

      owners =
        ownershipRows
          ?.map((row: any) => row.owners)
          ?.filter(
            (owner: any) =>
              owner && typeof owner.buildium_owner_id === 'number' && Number.isFinite(owner.buildium_owner_id),
          )
          ?.map((owner: any) => ({
            id: String(owner.id),
            name: nameFromContact(owner.contact),
            buildiumOwnerId: Number(owner.buildium_owner_id),
            disbursementPercentage:
              ownershipRows.find((row: any) => row.owner_id === owner.id)?.disbursement_percentage ??
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

    const bankAccountId = operatingBankAccountId ?? null;
    if (bankAccountId) {
      const { data: bankAccountRow, error: bankAccountError } = await supabaseAdmin
        .from('bank_accounts')
        .select('id, name, buildium_bank_id, gl_account')
        .eq('id', bankAccountId)
        .maybeSingle();

      if (bankAccountError) throw bankAccountError;

      if (bankAccountRow) {
        let glAccountBuildiumId: number | null = null;
        let glAccountId: string | null = bankAccountRow.gl_account ?? null;

        if (bankAccountRow.buildium_bank_id != null) {
          const bankBuildiumIdNum =
            typeof bankAccountRow.buildium_bank_id === 'number'
              ? bankAccountRow.buildium_bank_id
              : typeof bankAccountRow.buildium_bank_id === 'string' &&
                  Number.isFinite(Number(bankAccountRow.buildium_bank_id))
                ? Number(bankAccountRow.buildium_bank_id)
                : null;
          if (bankBuildiumIdNum != null) {
            const { data: bankGlByBuildium, error: bankGlByBuildiumError } = await supabaseAdmin
              .from('gl_accounts')
              .select('id, buildium_gl_account_id')
              .eq('buildium_gl_account_id', bankBuildiumIdNum)
              .maybeSingle();
            if (bankGlByBuildiumError) throw bankGlByBuildiumError;
            if (bankGlByBuildium?.id) {
              glAccountId = bankGlByBuildium.id;
            }
            if (
              bankGlByBuildium &&
              typeof bankGlByBuildium.buildium_gl_account_id === 'number' &&
              Number.isFinite(bankGlByBuildium.buildium_gl_account_id)
            ) {
              glAccountBuildiumId = bankGlByBuildium.buildium_gl_account_id;
            }
          }
        }

        if (!glAccountBuildiumId && bankAccountRow.gl_account) {
          const { data: glAccountRow, error: glAccountError } = await supabaseAdmin
            .from('gl_accounts')
            .select('id, buildium_gl_account_id')
            .eq('id', bankAccountRow.gl_account)
            .maybeSingle();

          if (glAccountError) throw glAccountError;

          const mappedGl =
            glAccountRow?.buildium_gl_account_id ??
            (typeof glAccountRow?.buildium_gl_account_id === 'string'
              ? Number(glAccountRow.buildium_gl_account_id)
              : null);

          glAccountBuildiumId =
            typeof mappedGl === 'number' && Number.isFinite(mappedGl) ? mappedGl : glAccountBuildiumId;

          if (glAccountRow?.id) {
            glAccountId = glAccountRow.id;
          }
        }

        bankAccount = {
          id: bankAccountRow.id,
          name: bankAccountRow.name,
          buildiumBankId: (() => {
            const candidate = bankAccountRow.buildium_bank_id;
            if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
            if (typeof candidate === 'string' && Number.isFinite(Number(candidate))) {
              return Number(candidate);
            }
            return null;
          })(),
          glAccountId,
          glAccountBuildiumId,
        };
      }
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
