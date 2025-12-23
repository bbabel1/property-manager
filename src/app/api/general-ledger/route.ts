import { NextRequest, NextResponse } from 'next/server';
import { endOfMonth, startOfMonth } from 'date-fns';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/auth/guards';
import { buildLedgerGroups, mapTransactionLine, type LedgerLine } from '@/server/financials/ledger-utils';

type SearchParams = Record<string, string | undefined>;

type PropertyRecord = {
  id: string;
  public_id?: string | null;
  name?: string | null;
  org_id?: string | null;
};

type UnitRecord = {
  id: string;
  unit_number?: string | null;
  unit_name?: string | null;
  property_id?: string | null;
};

type AccountRecord = {
  id: string;
  name: string;
  account_number?: string | null;
  type?: string | null;
  org_id?: string | null;
};

const normalizeBasis = (basis: unknown): 'cash' | 'accrual' =>
  String(basis ?? '').toLowerCase() === 'cash' ? 'cash' : 'accrual';

export async function GET(request: NextRequest) {
  try {
    // Ensure the caller is authenticated; reuse their Supabase session for RLS.
    await requireAuth();

    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 });
    }

    const url = new URL(request.url);
    const sp: SearchParams = {};
    url.searchParams.forEach((value, key) => {
      sp[key] = value;
    });

    const today = new Date();
    const hasRangeParam = typeof sp.range === 'string';
    const hasExplicitDates = typeof sp.from === 'string' || typeof sp.to === 'string';

    const defaultTo = endOfMonth(today);
    const defaultFrom = startOfMonth(today);

    const to = sp.to ? new Date(sp.to) : defaultTo;
    const from = sp.from ? new Date(sp.from) : defaultFrom;
    const range = hasRangeParam ? sp.range! : hasExplicitDates ? 'custom' : 'currentMonth';

    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const { data: propertyData } = await db
      .from('properties')
      .select('id, public_id, name, org_id')
      .order('name', { ascending: true });

    const propertyRows = (propertyData || []) as PropertyRecord[];
    const propertyLabelById = new Map(
      propertyRows.map((property) => [String(property.id), property.name || 'Property']),
    );
    const propertyPublicToInternalId = new Map(
      propertyRows.map((property) => [
        property.public_id ? String(property.public_id) : String(property.id),
        String(property.id),
      ]),
    );
    const propertyOrgById = new Map(
      propertyRows.map((property) => [String(property.id), property.org_id ? String(property.org_id) : null]),
    );

    const orgIds = Array.from(
      new Set(
        propertyRows
          .map((property) => (property.org_id ? String(property.org_id) : null))
          .filter((orgId): orgId is string => Boolean(orgId)),
      ),
    );

    const orgBasisById = new Map<string, 'cash' | 'accrual'>();
    if (orgIds.length) {
      const { data: orgRows } = await db.from('organizations').select('id, default_accounting_basis').in('id', orgIds);
      (orgRows || []).forEach((org: any) => {
        if (!org?.id) return;
        orgBasisById.set(String(org.id), normalizeBasis(org.default_accounting_basis));
      });
    }

    const propertyOptionsInternal = propertyRows
      .map((property) => ({
        id: String(property.id),
        label: property.name || 'Property',
        orgId: property.org_id ? String(property.org_id) : null,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const propertyFilterOptions = propertyRows
      .map((property) => ({
        id: property.public_id ? String(property.public_id) : String(property.id),
        label: property.name || 'Property',
        orgId: property.org_id ? String(property.org_id) : null,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const allPropertyIds = propertyOptionsInternal.map((option) => option.id);
    const allPropertyFilterIds = propertyFilterOptions.map((option) => option.id);

    const rawProperties = typeof sp.properties === 'string' ? sp.properties : undefined;
    const propertiesExplicitNone = rawProperties === 'none';
    const selectedPropertyPublicIds = propertiesExplicitNone
      ? []
      : rawProperties
        ? rawProperties
            .split(',')
            .map((value) => value.trim())
            .filter((value) => allPropertyFilterIds.includes(value))
        : [];

    const selectedPropertyInternalIds = selectedPropertyPublicIds
      .map((publicId) => propertyPublicToInternalId.get(publicId))
      .filter((value): value is string => Boolean(value));

    const propertyFilterIds =
      propertiesExplicitNone ||
      selectedPropertyPublicIds.length === 0 ||
      selectedPropertyPublicIds.length === allPropertyFilterIds.length
        ? null
        : selectedPropertyInternalIds;

    let unitsData: UnitRecord[] = [];
    if (allPropertyIds.length) {
      const { data: unitsResponse } = await db.from('units').select('id, unit_number, unit_name, property_id');
      unitsData = (unitsResponse || []) as UnitRecord[];
    }

    const unitsByProperty = unitsData.reduce<Record<string, { id: string; label: string }[]>>((acc, unit) => {
      const propertyId = unit.property_id ? String(unit.property_id) : null;
      if (!propertyId) return acc;
      const bucket = acc[propertyId] ?? [];
      bucket.push({
        id: String(unit.id),
        label: unit.unit_number || unit.unit_name || 'Unit',
      });
      acc[propertyId] = bucket;
      return acc;
    }, {});

    Object.values(unitsByProperty).forEach((list) => {
      list.sort((a, b) => a.label.localeCompare(b.label));
    });

    const unitOptions =
      selectedPropertyInternalIds.length === 0
        ? []
        : selectedPropertyInternalIds
            .flatMap((propertyId) => {
              const propertyLabel = propertyLabelById.get(propertyId) || null;
              return (unitsByProperty[propertyId] ?? []).map((unit) => ({
                id: unit.id,
                label: propertyLabel ? `${propertyLabel} – ${unit.label}` : unit.label,
              }));
            })
            .sort((a, b) => a.label.localeCompare(b.label));

    const allUnitIds = unitOptions.map((option) => option.id);

    const unitsParam = typeof sp.units === 'string' ? sp.units : '';
    const glParamRaw = typeof sp.gl === 'string' ? sp.gl : '';
    const accountsExplicitNone = glParamRaw === 'none';
    const glParam = accountsExplicitNone ? '' : glParamRaw;
    const noUnitsSelected = unitsParam === 'none';

    let selectedUnitIds: string[];
    if (noUnitsSelected) {
      selectedUnitIds = [];
    } else if (unitsParam) {
      selectedUnitIds = unitsParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => allUnitIds.includes(value));
    } else {
      selectedUnitIds = [...allUnitIds];
    }

    const unitFilterIds =
      noUnitsSelected || selectedUnitIds.length === 0 || selectedUnitIds.length === allUnitIds.length
        ? null
        : selectedUnitIds;

    const selectedOrgIds = new Set<string>();
    for (const propertyId of selectedPropertyInternalIds) {
      const orgId = propertyOrgById.get(propertyId);
      if (orgId) selectedOrgIds.add(orgId);
    }

    const basisFromSelection =
      selectedOrgIds.size === 1 ? orgBasisById.get(Array.from(selectedOrgIds)[0]) : undefined;
    const defaultBasis = basisFromSelection ?? orgBasisById.values().next().value ?? 'accrual';

    const accountsQuery = (() => {
      let query = db
        .from('gl_accounts')
        .select('id, name, account_number, type, org_id')
        .order('type', { ascending: true })
        .order('name', { ascending: true });
      const orgList = Array.from(selectedOrgIds);
      if (orgList.length === 1) {
        query = query.eq('org_id', orgList[0]);
      } else if (orgList.length > 1) {
        query = query.in('org_id', orgList);
      }
      return query;
    })();

    const accountsResponse = await accountsQuery;
    const accountsData = (accountsResponse?.data || []) as AccountRecord[];
    const accountOptions = accountsData
      .map((account) => ({
        value: String(account.id),
        label: [account.name, account.account_number ? `(${account.account_number})` : '']
          .filter(Boolean)
          .join(' '),
        group: account.type || 'Other',
        groupLabel: account.type ? `${account.type} accounts` : 'Other accounts',
      }))
      .sort((a, b) => (a.group || 'Other').localeCompare(b.group || 'Other') || a.label.localeCompare(b.label));

    const allAccountIds = accountOptions.map((option) => option.value);
    let selectedAccountIds = accountsExplicitNone
      ? []
      : glParam
        ? glParam
            .split(',')
            .map((value) => value.trim())
            .filter((value) => allAccountIds.includes(value))
        : [...allAccountIds];
    if (!accountsExplicitNone && selectedAccountIds.length === 0 && allAccountIds.length) {
      selectedAccountIds = [...allAccountIds];
    }

    const accountFilterIds =
      accountsExplicitNone || selectedAccountIds.length === allAccountIds.length ? null : selectedAccountIds;

    const basisParam = sp.basis === 'cash' ? 'cash' : defaultBasis;

    const shouldQueryLedger =
      selectedPropertyPublicIds.length > 0 && !noUnitsSelected && !accountsExplicitNone;

    const qBase = () =>
      db
        .from('transaction_lines')
        .select(
          `transaction_id,
           property_id,
           unit_id,
           date,
           amount,
           posting_type,
           memo,
           gl_account_id,
           created_at,
           gl_accounts(name, account_number, type, is_bank_account, exclude_from_cash_balances),
           units(unit_number, unit_name),
           transactions(id, transaction_type, memo, reference_number),
           properties(id, name)`,
        );

    const mapLine = (row: Record<string, unknown>): LedgerLine => {
      const mapped = mapTransactionLine(row);
      const propertyId = mapped.propertyId ?? (row?.property_id ? String(row.property_id) : null);
      return {
        ...mapped,
        propertyId,
        propertyLabel: mapped.propertyLabel ?? (propertyId ? propertyLabelById.get(propertyId) || null : null),
      };
    };

    let periodLines: LedgerLine[] = [];
    let priorLines: LedgerLine[] = [];

    if (shouldQueryLedger) {
      const baseFilter = qBase();
      const commonFilter = propertyFilterIds ? baseFilter.in('property_id', propertyFilterIds) : baseFilter;

      let periodQuery = commonFilter.gte('date', fromStr).lte('date', toStr);
      if (unitFilterIds) periodQuery = periodQuery.in('unit_id', unitFilterIds);
      if (accountFilterIds) periodQuery = periodQuery.in('gl_account_id', accountFilterIds);

      let priorQuery = propertyFilterIds ? qBase().in('property_id', propertyFilterIds) : qBase();
      priorQuery = priorQuery.lt('date', fromStr);
      if (unitFilterIds) priorQuery = priorQuery.in('unit_id', unitFilterIds);
      if (accountFilterIds) priorQuery = priorQuery.in('gl_account_id', accountFilterIds);

      const [{ data: periodData, error: periodError }, { data: priorData, error: priorError }] =
        await Promise.all([periodQuery, priorQuery]);

      periodLines = periodError ? [] : (periodData || []).map(mapLine);
      priorLines = priorError ? [] : (priorData || []).map(mapLine);
    }

    const groups = buildLedgerGroups(priorLines, periodLines, { basis: basisParam });

    return NextResponse.json({
      success: true,
      basis: basisParam,
      range,
      from: fromStr,
      to: toStr,
      filters: {
        properties: selectedPropertyPublicIds,
        units: selectedUnitIds,
        gl: selectedAccountIds,
        unitsExplicitNone: noUnitsSelected,
        accountsExplicitNone,
      },
      counts: {
        properties: selectedPropertyPublicIds.length,
        units: selectedUnitIds.length,
        accounts: selectedAccountIds.length,
      },
      groups,
    });
  } catch (error) {
    console.error('Error building general ledger JSON', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
