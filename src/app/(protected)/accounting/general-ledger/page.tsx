import { Fragment } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import DateRangeControls from '@/components/DateRangeControls';
import LedgerFilters from '@/components/financials/LedgerFilters';
import ClearFiltersButton from '@/components/financials/ClearFiltersButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableRowLink } from '@/components/ui/table-row-link';
import { supabaseAdmin } from '@/lib/db';
import RecordGeneralJournalEntryButton from '@/components/financials/RecordGeneralJournalEntryButton';
import {
  buildLedgerGroups,
  mapTransactionLine,
  type LedgerLine,
} from '@/server/financials/ledger-utils';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import AccountingBasisToggle from '@/components/financials/AccountingBasisToggle';

type SearchParams = {
  from?: string;
  to?: string;
  range?: string;
  properties?: string;
  units?: string;
  gl?: string;
  basis?: 'cash' | 'accrual';
};

type PropertyRecord = {
  id: string;
  public_id?: string | number | null;
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
};

type OrganizationRecord = {
  id: string;
  default_accounting_basis?: string | null;
};

const normalizeBasis = (basis: unknown): 'cash' | 'accrual' =>
  String(basis ?? '').toLowerCase() === 'cash' ? 'cash' : 'accrual';

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const db = supabaseAdmin;
  const sp = (await (searchParams || Promise.resolve({}))) as Record<string, string | undefined>;

  const today = new Date();
  const hasRangeParam = typeof sp?.range === 'string';
  const hasExplicitDates = typeof sp?.from === 'string' || typeof sp?.to === 'string';

  const defaultTo = endOfMonth(today);
  const defaultFrom = startOfMonth(today);

  const to = sp?.to ? new Date(sp.to) : defaultTo;
  const from = sp?.from ? new Date(sp.from) : defaultFrom;
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
    propertyRows.map((property) => [
      String(property.id),
      property.org_id ? String(property.org_id) : null,
    ]),
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
    const { data: orgRowsData } = await db
      .from('organizations')
      .select('id, default_accounting_basis')
      .in('id', orgIds);

    const orgRows = (orgRowsData || []) as OrganizationRecord[];
    orgRows.forEach((org) => {
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

  const propertyLabelMap = propertyLabelById;
  const allPropertyIds = propertyOptionsInternal.map((option) => option.id);
  const allPropertyFilterIds = propertyFilterOptions.map((option) => option.id);

  const rawProperties = typeof sp?.properties === 'string' ? sp.properties : undefined;
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

  const unitsParam = typeof sp?.units === 'string' ? sp.units : '';
  const glParamRaw = typeof sp?.gl === 'string' ? sp.gl : '';
  const accountsExplicitNone = glParamRaw === 'none';
  const glParam = accountsExplicitNone ? '' : glParamRaw;
  const noUnitsSelected = unitsParam === 'none';

  let unitsData: UnitRecord[] = [];
  if (allPropertyIds.length) {
    const unitsQuery = db.from('units').select('id, unit_number, unit_name, property_id');
    const { data: unitsResponse } = await unitsQuery;
    unitsData = (unitsResponse || []) as UnitRecord[];
  }

  const unitsByProperty = unitsData.reduce<Record<string, { id: string; label: string }[]>>(
    (acc, unit) => {
      const propertyId = unit.property_id ? String(unit.property_id) : null;
      if (!propertyId) return acc;
      const bucket = acc[propertyId] ?? [];
      bucket.push({
        id: String(unit.id),
        label: unit.unit_number || unit.unit_name || 'Unit',
      });
      acc[propertyId] = bucket;
      return acc;
    },
    {},
  );

  Object.values(unitsByProperty).forEach((list) => {
    list.sort((a, b) => a.label.localeCompare(b.label));
  });

  const unitOptions =
    selectedPropertyInternalIds.length === 0
      ? []
      : selectedPropertyInternalIds
          .flatMap((propertyId) => {
            const propertyLabel = propertyLabelMap.get(propertyId) || null;
            return (unitsByProperty[propertyId] ?? []).map((unit) => ({
              id: unit.id,
              label: propertyLabel ? `${propertyLabel} – ${unit.label}` : unit.label,
            }));
          })
          .sort((a, b) => a.label.localeCompare(b.label));

  const allUnitIds = unitOptions.map((option) => option.id);

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
  const modalDefaultUnitId =
    !noUnitsSelected && selectedUnitIds.length === 1 ? selectedUnitIds[0] : '';

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
      .select('id, name, account_number, type')
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
    .sort(
      (a, b) =>
        (a.group || 'Other').localeCompare(b.group || 'Other') || a.label.localeCompare(b.label),
    );

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
    accountsExplicitNone || selectedAccountIds.length === allAccountIds.length
      ? null
      : selectedAccountIds;

  const basisParam = sp?.basis === 'cash' ? 'cash' : defaultBasis;
  const dateHeading = basisParam === 'cash' ? 'Date (cash basis)' : 'Date (accrual basis)';

  const shouldQueryLedger =
    selectedPropertyPublicIds.length > 0 && !noUnitsSelected && !accountsExplicitNone;

  const qBase = () =>
    db.from('transaction_lines').select(
      `transaction_id,
         property_id,
         unit_id,
         date,
         amount,
         posting_type,
         memo,
         gl_account_id,
         account_entity_type,
         created_at,
         gl_accounts(name, account_number, type, is_bank_account, exclude_from_cash_balances),
         units(unit_number, unit_name),
         transactions(id, transaction_type, memo, reference_number),
         properties(id, name)`,
    );

  const mapLine = (row: Record<string, unknown>): LedgerLine | null => {
    const mapped = mapTransactionLine(row);
    if (!mapped) return null; // Filter out lines with invalid posting_type
    const propertyId = mapped.propertyId ?? (row?.property_id ? String(row.property_id) : null);
    return {
      ...mapped,
      propertyId,
      propertyLabel:
        mapped.propertyLabel ?? (propertyId ? propertyLabelMap.get(propertyId) || null : null),
    };
  };

  let periodLines: LedgerLine[] = [];
  let priorLines: LedgerLine[] = [];

  if (shouldQueryLedger) {
    const baseFilter = qBase();
    const commonFilter = propertyFilterIds
      ? baseFilter.in('property_id', propertyFilterIds).eq('account_entity_type', 'Rental')
      : baseFilter;

    let periodQuery = commonFilter.gte('date', fromStr).lte('date', toStr);
    if (unitFilterIds) periodQuery = periodQuery.in('unit_id', unitFilterIds);
    if (accountFilterIds) periodQuery = periodQuery.in('gl_account_id', accountFilterIds);

    let priorQuery = propertyFilterIds 
      ? qBase().in('property_id', propertyFilterIds).eq('account_entity_type', 'Rental')
      : qBase();
    priorQuery = priorQuery.lt('date', fromStr);
    if (unitFilterIds) priorQuery = priorQuery.in('unit_id', unitFilterIds);
    if (accountFilterIds) priorQuery = priorQuery.in('gl_account_id', accountFilterIds);

    const [{ data: periodData, error: periodError }, { data: priorData, error: priorError }] =
      await Promise.all([periodQuery, priorQuery]);

    periodLines = periodError
      ? []
      : (periodData || []).map(mapLine).filter((line): line is LedgerLine => line !== null);
    priorLines = priorError
      ? []
      : (priorData || []).map(mapLine).filter((line): line is LedgerLine => line !== null);
  }

  const groups = buildLedgerGroups(priorLines, periodLines, { basis: basisParam });

  const fmt = (value: number) =>
    `$${Number(Math.abs(value || 0)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const fmtSigned = (value: number) => (value < 0 ? `(${fmt(value)})` : fmt(value));
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const emptyStateMessage =
    selectedPropertyPublicIds.length === 0
      ? 'Select a property to view ledger activity.'
      : noUnitsSelected
        ? 'Select at least one unit to view ledger activity.'
        : accountsExplicitNone
          ? 'Select at least one account to view ledger activity.'
          : 'No activity for the selected filters.';

  const modalDefaultPropertyId =
    selectedPropertyInternalIds.length === 1 ? selectedPropertyInternalIds[0] : undefined;
  const modalUnitOptions =
    modalDefaultPropertyId && unitsByProperty[modalDefaultPropertyId]
      ? unitsByProperty[modalDefaultPropertyId]
      : [];

  return (
    <PageShell>
      <PageHeader
        title="General ledger"
        description="Track journal entries across every property and GL account."
      />
      <PageBody>
        <div className="space-y-6">
          <div className="flex justify-end">
            <RecordGeneralJournalEntryButton
              autoSelectDefaultProperty={false}
              propertyOptions={propertyOptionsInternal.map(({ id, label }) => ({ id, label }))}
              unitOptions={modalUnitOptions}
              unitsByProperty={unitsByProperty}
              accountOptions={accountOptions}
              defaultPropertyId={modalDefaultPropertyId}
              defaultUnitId={modalDefaultUnitId}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <LedgerFilters
              autoSelectAllProperties={false}
              defaultPropertyIds={selectedPropertyPublicIds}
              defaultUnitIds={selectedUnitIds}
              defaultGlIds={selectedAccountIds}
              unitOptions={unitOptions}
              accountOptions={accountOptions}
              propertyOptions={propertyFilterOptions.map(({ id, label }) => ({ id, label }))}
              noUnitsSelected={noUnitsSelected}
            />
            <DateRangeControls defaultFrom={from} defaultTo={to} defaultRange={range} />
            <AccountingBasisToggle basis={basisParam} />
            <ClearFiltersButton />
          </div>
          <div className="border-border overflow-hidden rounded-lg border shadow-sm">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-border border-b">
                  <TableHead className="text-muted-foreground w-[12rem]">{dateHeading}</TableHead>
                  <TableHead className="text-muted-foreground w-[10rem]">Unit</TableHead>
                  <TableHead className="text-muted-foreground">Transaction</TableHead>
                  <TableHead className="text-muted-foreground">Memo</TableHead>
                  <TableHead className="text-muted-foreground w-[10rem] text-right">
                    Amount
                  </TableHead>
                  <TableHead className="text-muted-foreground w-[10rem] text-right">
                    Balance
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-border divide-y">
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                      {emptyStateMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => {
                    const detailChrono = [...group.lines].sort((a, b) => {
                      const dateCmp = a.line.date.localeCompare(b.line.date);
                      if (dateCmp !== 0) return dateCmp;
                      return (a.line.createdAt || '').localeCompare(b.line.createdAt || '');
                    });

                    let running = group.prior;
                    const detailWithBalance = detailChrono.map(({ line, signed }) => {
                      running += signed;
                      return { line, signed, runningAfter: running };
                    });
                    const detailDisplay = detailWithBalance.slice().reverse();

                    return (
                      <Fragment key={group.id}>
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={6} className="text-primary font-medium">
                            <span className="text-muted-foreground mr-2">—</span>
                            {group.name}
                            {group.number ? (
                              <span className="text-muted-foreground ml-2 text-xs">
                                {group.number}
                              </span>
                            ) : null}
                            {group.type ? (
                              <span className="text-muted-foreground ml-3 text-xs uppercase">
                                {group.type}
                              </span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-background">
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                          >
                            Prior balance
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right font-semibold">
                            {fmtSigned(group.prior)}
                          </TableCell>
                        </TableRow>
                        {detailDisplay.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-muted-foreground py-4 text-center text-sm"
                            >
                              No activity in selected period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detailDisplay.map(({ line, signed, runningAfter }, idx) => {
                            const txnLabel = [
                              line.transactionType || 'Transaction',
                              line.transactionReference ? `#${line.transactionReference}` : '',
                            ]
                              .filter(Boolean)
                              .join(' ');
                            const memo = line.memo || line.transactionMemo || '—';
                            // Route deposits to deposit edit page, others to journal entry page
                            const isDeposit = line.transactionType === 'Deposit';
                            const detailHref =
                              line.transactionId && line.propertyId
                                ? isDeposit
                                  ? `/properties/${line.propertyId}/financials/deposits/${line.transactionId}`
                                  : `/properties/${line.propertyId}/financials/entries/${line.transactionId}`
                                : null;
                            const unitPrimary = line.unitLabel || '—';
                            const propertyLabel =
                              line.propertyLabel && selectedPropertyInternalIds.length !== 1
                                ? line.propertyLabel
                                : null;

                            if (detailHref) {
                              return (
                                <TableRowLink
                                  key={`${group.id}-${line.date}-${idx}`}
                                  href={detailHref}
                                  className="hover:bg-muted/60 cursor-pointer"
                                >
                                  <TableCell>{dateFmt.format(new Date(line.date))}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span>{unitPrimary}</span>
                                      {propertyLabel ? (
                                        <span className="text-muted-foreground text-xs">
                                          {propertyLabel}
                                        </span>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell>{txnLabel || '—'}</TableCell>
                                  <TableCell>{memo}</TableCell>
                                  <TableCell
                                    className={`text-right font-medium ${signed < 0 ? 'text-destructive' : ''}`}
                                  >
                                    {fmtSigned(signed)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {fmtSigned(runningAfter)}
                                  </TableCell>
                                </TableRowLink>
                              );
                            }

                            return (
                              <TableRow key={`${group.id}-${line.date}-${idx}`}>
                                <TableCell>{dateFmt.format(new Date(line.date))}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span>{unitPrimary}</span>
                                    {propertyLabel ? (
                                      <span className="text-muted-foreground text-xs">
                                        {propertyLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell>{txnLabel || '—'}</TableCell>
                                <TableCell>{memo}</TableCell>
                                <TableCell
                                  className={`text-right font-medium ${signed < 0 ? 'text-destructive' : ''}`}
                                >
                                  {fmtSigned(signed)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {fmtSigned(runningAfter)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={4} className="font-semibold">
                            Total {group.name}
                          </TableCell>
                          <TableCell className="text-foreground text-right font-semibold">
                            {fmtSigned(group.net)}
                          </TableCell>
                          <TableCell className="text-foreground text-right font-semibold">
                            {fmtSigned(group.prior + group.net)}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </PageBody>
    </PageShell>
  );
}
