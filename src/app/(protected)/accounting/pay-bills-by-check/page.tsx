import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { listUnpaidBillsForCheckPayment, type BillStatusLabel } from '@/server/bills/pay-bills-by-check';
import { supabase, supabaseAdmin } from '@/lib/db';
import PayBillsByCheckTable, {
  type PayBillsByCheckBill,
  type PayBillsByCheckVendorGroup,
} from '@/components/bills/PayBillsByCheckTable';
import PayBillsByCheckFilters from '@/components/bills/PayBillsByCheckFilters';

type SearchParams = {
  properties?: string;
  units?: string;
  vendors?: string;
  bstatus?: string;
  include?: string;
  allocation?: string;
  consolidation?: string;
};

export default async function PayBillsByCheckPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const db = supabaseAdmin || supabase;
  const sp = (await (searchParams || Promise.resolve({}))) as Record<string, string | undefined>;

  const propertiesResponse = await db
    .from('properties')
    .select('id, public_id, name')
    .order('name', { ascending: true });

  const propertyOptions: { id: string; label: string; internalId?: string }[] = (
    (propertiesResponse?.data ?? []) as Array<{
      id: string;
      public_id?: string | number | null;
      name?: string | null;
    }>
  )
    .map((property) => ({
      id: property.public_id ? String(property.public_id) : String(property.id),
      label: property.name || 'Property',
      internalId: String(property.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const filterIdToInternal = new Map(propertyOptions.map((opt) => [opt.id, opt.internalId]));
  const allPropertyFilterIds = propertyOptions.map((opt) => opt.id);
  const allPropertyIds = propertyOptions
    .map((opt) => opt.internalId)
    .filter((id): id is string => Boolean(id));

  const spProperties = typeof sp?.properties === 'string' ? sp.properties : '';
  let selectedPropertyFilterIds = spProperties
    ? spProperties
        .split(',')
        .map((value) => value.trim())
        .filter((value) => allPropertyFilterIds.includes(value) || allPropertyIds.includes(value))
    : [...allPropertyFilterIds];
  if (!selectedPropertyFilterIds.length && allPropertyFilterIds.length) {
    selectedPropertyFilterIds = [...allPropertyFilterIds];
  }
  let selectedPropertyIds = selectedPropertyFilterIds
    .map((value) => filterIdToInternal.get(value) || (allPropertyIds.includes(value) ? value : null))
    .filter((value): value is string => Boolean(value));
  if (!selectedPropertyIds.length && allPropertyIds.length) {
    selectedPropertyIds = [...allPropertyIds];
  }

  let unitsData: Array<{
    id: string;
    unit_number?: string | null;
    unit_name?: string | null;
    property_id?: string | null;
  }> = [];
  if (allPropertyIds.length) {
    let unitsQuery = db.from('units').select('id, unit_number, unit_name, property_id');
    if (selectedPropertyIds.length && selectedPropertyIds.length !== allPropertyIds.length) {
      unitsQuery = unitsQuery.in('property_id', selectedPropertyIds);
    }
    const { data: unitsResponse } = await unitsQuery;
    unitsData = (unitsResponse || []) as typeof unitsData;
  }

  const unitOptions: { id: string; label: string }[] = unitsData
    .map((unit) => ({
      id: String(unit.id),
      label: unit.unit_number || unit.unit_name || 'Unit',
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const allUnitIds = unitOptions.map((opt) => opt.id);

  const unitsParamRaw = typeof sp?.units === 'string' ? sp.units : '';
  const noUnitsSelected = unitsParamRaw === 'none';
  let selectedUnitIds: string[];
  if (noUnitsSelected) {
    selectedUnitIds = [];
  } else if (unitsParamRaw) {
    selectedUnitIds = unitsParamRaw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => allUnitIds.includes(value));
  } else {
    selectedUnitIds = [...allUnitIds];
  }

  const propertyFilterIds =
    !selectedPropertyIds.length || selectedPropertyIds.length === allPropertyIds.length
      ? null
      : selectedPropertyIds;
  const unitFilterIds =
    noUnitsSelected || !selectedUnitIds.length || selectedUnitIds.length === allUnitIds.length
      ? null
      : selectedUnitIds;

  const vendorsQuery = db
    .from('vendors')
    .select(
      'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
    )
    .order('updated_at', { ascending: false })
    .limit(200);

  const { data: vendorsData } = await vendorsQuery;
  interface VendorRecord {
    id: string;
    contact?: {
      display_name?: string;
      company_name?: string;
      first_name?: string;
      last_name?: string;
    };
  }
  const nameOfVendor = (v: VendorRecord) =>
    v?.contact?.display_name ||
    v?.contact?.company_name ||
    [v?.contact?.first_name, v?.contact?.last_name].filter(Boolean).join(' ') ||
    'Vendor';
  const vendorOptions: { id: string; label: string }[] = ((vendorsData || []) as VendorRecord[])
    .map((v) => ({ id: String(v.id), label: nameOfVendor(v) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const allVendorIds = vendorOptions.map((v) => v.id);

  const spVendors = typeof sp?.vendors === 'string' ? sp.vendors : '';
  let selectedVendorIds = spVendors
    ? spVendors
        .split(',')
        .map((value) => value.trim())
        .filter((value) => allVendorIds.includes(value))
    : [...allVendorIds];
  if (!selectedVendorIds.length) selectedVendorIds = [...allVendorIds];
  const spStatusRaw = typeof sp?.bstatus === 'string' ? sp.bstatus : '';

  const BILL_STATUS_OPTIONS: { slug: string; label: BillStatusLabel }[] = [
    { slug: 'overdue', label: 'Overdue' },
    { slug: 'due', label: 'Due' },
    { slug: 'partially-paid', label: 'Partially paid' },
    { slug: 'paid', label: 'Paid' },
    { slug: 'cancelled', label: 'Cancelled' },
  ];
  const STATUS_SLUG_TO_LABEL = new Map(BILL_STATUS_OPTIONS.map((opt) => [opt.slug, opt.label]));

  const statusParamSlugs = spStatusRaw
    ? spStatusRaw
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((slug) => STATUS_SLUG_TO_LABEL.has(slug))
    : [];

  const defaultStatusSlugs =
    statusParamSlugs.length > 0
      ? statusParamSlugs
      : ['overdue', 'due', 'partially-paid'];

  const statusFilterLabels: BillStatusLabel[] =
    defaultStatusSlugs
      .map((slug) => STATUS_SLUG_TO_LABEL.get(slug))
      .filter((label): label is BillStatusLabel => Boolean(label));

  const unpaidBills = await listUnpaidBillsForCheckPayment({
    propertyIds: propertyFilterIds,
    unitIds: unitFilterIds,
    vendorIds: selectedVendorIds.length === allVendorIds.length ? null : selectedVendorIds,
    statuses: statusFilterLabels,
  });

  const vendorLabelById = new Map(vendorOptions.map((v) => [v.id, v.label]));

  const groups: PayBillsByCheckVendorGroup[] = Array.from(
    unpaidBills.reduce((map, bill) => {
      const vendorId = bill.vendor_id || null;
      const key = vendorId ?? '_unknown';
      const group = map.get(key) ?? {
        vendorId,
        vendorLabel:
          vendorId && vendorLabelById.get(vendorId)
            ? vendorLabelById.get(vendorId)
            : bill.vendor_name || 'Vendor',
        hasInsuranceWarning: bill.vendor_insurance_missing_or_expired,
        bills: [] as PayBillsByCheckBill[],
      };
      if (bill.vendor_insurance_missing_or_expired) {
        (group as any).hasInsuranceWarning = true;
      }
      group.bills.push({
        id: bill.id,
        memo: bill.memo,
        reference_number: bill.reference_number,
        vendor_id: bill.vendor_id,
        vendor_name: bill.vendor_name,
        property_name: bill.property_name,
        unit_label: bill.unit_label,
        due_date: bill.due_date,
        total_amount: bill.total_amount,
        remaining_amount: bill.remaining_amount,
        status: bill.status,
        isSelectable:
          !!bill.buildium_bill_id &&
          !!bill.operating_bank_gl_account_id &&
          bill.bank_has_buildium_id,
        disabledReason: !bill.buildium_bill_id
          ? 'This bill is not linked to Buildium, so payments cannot be created yet.'
          : !bill.operating_bank_gl_account_id
            ? "The bill's primary property does not have an operating bank account assigned."
            : !bill.bank_has_buildium_id
              ? 'The operating bank account is missing a Buildium bank mapping.'
              : undefined,
      });
      map.set(key, group);
      return map;
    }, new Map<string, PayBillsByCheckVendorGroup>()).values(),
  );
  const hasVendorInsuranceWarning = groups.some((g) => g.hasInsuranceWarning);

  return (
    <PageShell>
      <PageHeader
        title="Pay bills by check"
        description="Choose unpaid bills to pay by check and review their details before confirming payment."
      />
      <PageBody>
        <div className="space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-4 p-6">
              {hasVendorInsuranceWarning ? (
                <Alert className="border-amber-300 bg-amber-50">
                  <AlertTitle>Vendor insurance warning</AlertTitle>
                  <AlertDescription>
                    At least one vendor in this list has missing or expired vendor insurance
                    information. We recommend updating their policy information before sending
                    them payment.
                  </AlertDescription>
                </Alert>
              ) : null}

              <PayBillsByCheckFilters
                defaultPropertyIds={selectedPropertyFilterIds}
                defaultUnitIds={selectedUnitIds}
                defaultVendorIds={selectedVendorIds}
                defaultStatuses={defaultStatusSlugs}
                propertyOptions={propertyOptions}
                unitOptions={unitOptions}
                vendorOptions={vendorOptions}
                defaultInclude={sp.include || 'all'}
                defaultAllocation={
                  sp.allocation === 'manual' || sp.allocation === 'automatic'
                    ? (sp.allocation as 'automatic' | 'manual')
                    : 'automatic'
                }
                defaultConsolidation={
                  sp.consolidation === 'no' || sp.consolidation === 'yes'
                    ? (sp.consolidation as 'yes' | 'no')
                    : 'yes'
                }
              />

              <div className="border-border/70 border-t pt-4">
                <PayBillsByCheckTable groups={groups} />
              </div>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </PageShell>
  );
}
