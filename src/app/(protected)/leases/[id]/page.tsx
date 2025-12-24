import Link from 'next/link';
import { randomUUID } from 'crypto';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LeaseFilesTable from '@/components/leases/LeaseFilesTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import TenantMoveInEditor from '@/components/leases/TenantMoveInEditor';
import AddTenantButton from '@/components/leases/AddTenantButton';
import RemoveLeaseContactButton from '@/components/leases/RemoveLeaseContactButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LeaseHeaderMeta from '@/components/leases/LeaseHeaderMeta';
import InfoCard from '@/components/layout/InfoCard';
import { supabaseAdmin, supabase as supaClient } from '@/lib/db';
import { signedAmountFromTransaction } from '@/lib/finance/model';
import RentTabInteractive from '@/components/leases/RentTabInteractive';
import RecurringTransactionsPanel, {
  type RecurringRow,
} from '@/components/leases/RecurringTransactionsPanel';
import LeaseLedgerPanel from '@/components/leases/LeaseLedgerPanel';
import { RentCycleEnumDb, RentScheduleStatusEnumDb } from '@/schemas/lease-api';
import { ArrowRight, ExternalLink, Mail, Phone, Trash2 } from 'lucide-react';
import { getFilesByEntity, FILE_ENTITY_TYPES } from '@/lib/files';
import ActionButton from '@/components/ui/ActionButton';
import type { LeaseAccountOption, LeaseTenantOption } from '@/components/leases/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FileRow } from '@/lib/files';
import { resolveLeaseBalances } from '@/lib/lease-balance';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LeaseDetailsPageParams = { id: string };
// Use a loose row type because this page stitches together multiple Supabase queries with partial selects.
type UnknownRow = Record<string, unknown>;
type LeaseFileCategory = {
  id: string;
  category_name: string;
  buildium_category_id: number | null;
  description?: string | null;
  is_active?: boolean | null;
  org_id?: string | null;
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');
const normalizeCurrency = (value?: number | null) => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  const rounded = Math.round(num * 100) / 100;
  if (Object.is(rounded, -0)) return 0;
  if (Math.abs(rounded) < 1e-9) return 0;
  return rounded;
};
const fmtUsd = (n?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    normalizeCurrency(n),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown): number | null => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const toStringSafe = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return null;
  try {
    return String(value);
  } catch {
    return null;
  }
};

const readAmountFromLine = (line: unknown): number => {
  if (!isRecord(line)) return 0;
  const val = line.amount ?? (isRecord(line) ? line.Amount : null);
  return toNumber(val) ?? 0;
};

export default async function LeaseDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<LeaseDetailsPageParams>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialTab = sp?.tab === 'financials' ? 'financials' : 'summary';
  // Use admin when available to avoid RLS mismatches between source pages and details page
  const supabase = (supabaseAdmin || supaClient) as SupabaseClient<Database>;

  // Step 1: Load the base lease row first (avoid nested join issues)
  const numericId = Number(id);
  let lease: UnknownRow | null = null;
  try {
    const { data } = await supabase
      .from('lease')
      .select(
        'id, status, lease_from_date, lease_to_date, lease_type, term_type, payment_due_day, rent_amount, lease_charges, security_deposit, buildium_lease_id, buildium_property_id, buildium_unit_id, property_id, unit_id',
      )
      .eq('id', Number.isFinite(numericId) ? numericId : id)
      .maybeSingle();
    lease = data;
    if (!lease && Number.isFinite(numericId)) {
      // Fallback: try string equality just in case of type coercion quirks
      const { data: data2 } = await supabase
        .from('lease')
        .select(
          'id, status, lease_from_date, lease_to_date, lease_type, term_type, payment_due_day, rent_amount, lease_charges, security_deposit, buildium_lease_id, buildium_property_id, buildium_unit_id, property_id, unit_id',
        )
        .eq('id', id)
        .maybeSingle();
      lease = data2;
    }
  } catch {}

  if (!lease) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">Lease not found.</CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Load related property + unit separately to avoid join failures
  let property: UnknownRow | null = null;
  let unit: UnknownRow | null = null;
  try {
    if (lease.property_id) {
      const { data: p } = await supabase
        .from('properties')
        .select('id, name, address_line1, city, state, postal_code, buildium_property_id, org_id')
        .eq('id', lease.property_id)
        .maybeSingle();
      property = p;
    }
  } catch {}
  try {
    if (lease.unit_id) {
      const { data: u } = await supabase
        .from('units')
        .select('id, unit_number, status')
        .eq('id', lease.unit_id)
        .maybeSingle();
      unit = u;
    }
  } catch {}

  // Load files for this lease and category metadata
  // Note: Files are associated by entity_type='Lease' and entity_id=buildium_lease_id
  let leaseFiles: UnknownRow[] = [];
  let fileCategories: UnknownRow[] = [];
  let propertyOrgId: string | null =
    typeof property?.org_id === 'string' && property.org_id ? property.org_id : null;

  if (!propertyOrgId && lease.property_id) {
    const { data: propertyLookupRaw, error: propertyErr } = await supabase
      .from('properties')
      .select('org_id')
      .eq('id', lease.property_id)
      .maybeSingle();
    if (propertyErr) {
      console.error('Failed to fetch property for org_id:', {
        error: propertyErr,
        propertyId: lease.property_id,
      });
    }
    const propertyLookup = propertyLookupRaw as { org_id?: string | null } | null;
    propertyOrgId =
      propertyLookup && typeof propertyLookup.org_id === 'string' && propertyLookup.org_id
        ? propertyLookup.org_id
        : null;
  }

  if (propertyOrgId) {
    try {
      const { data: categoryRows, error: categoryErr } = await supabase
        .from('file_categories')
        .select('id, category_name, buildium_category_id, description, is_active')
        .eq('org_id', propertyOrgId)
        .order('category_name', { ascending: true });
      if (categoryErr) {
        console.error('Failed to load file categories for org', {
          error: categoryErr,
          orgId: propertyOrgId,
        });
      } else if (Array.isArray(categoryRows)) {
        fileCategories = categoryRows.filter((row) => row?.is_active !== false);
      }
    } catch (categoryException) {
      console.error('Unexpected error loading file categories', categoryException);
    }
  }

  if (!fileCategories.length) {
    try {
      const { data: fallbackCategories, error: fallbackErr } = await supabase
        .from('file_categories')
        .select('id, category_name, buildium_category_id, description, is_active, org_id')
        .order('category_name', { ascending: true });
      if (fallbackErr) {
        console.error('Failed to load fallback file categories', fallbackErr);
      } else if (Array.isArray(fallbackCategories)) {
        fileCategories = fallbackCategories.filter((row) => row?.is_active !== false);
      }
    } catch (fallbackException) {
      console.error('Unexpected error loading fallback file categories', fallbackException);
    }
  }

  try {
    if (lease.buildium_lease_id && propertyOrgId) {
      const entityId =
        typeof lease.buildium_lease_id === 'number'
          ? lease.buildium_lease_id
          : Number(lease.buildium_lease_id);

      if (!Number.isFinite(entityId)) {
        console.warn('Invalid buildium_lease_id for files query:', lease.buildium_lease_id);
      } else {
        leaseFiles = await getFilesByEntity(
          supabase,
          propertyOrgId,
          FILE_ENTITY_TYPES.LEASES,
          entityId,
        );
      }
    } else {
      // Silently skip if required data is missing - this is expected for leases without Buildium IDs
      if (!lease.buildium_lease_id) {
        console.debug('Lease has no buildium_lease_id, skipping file load');
      }
      if (!propertyOrgId) {
        console.debug('Property org_id unavailable, skipping file load');
      }
    }
  } catch (fileErr) {
    // Improved error logging with proper serialization
    const fileError = fileErr as {
      message?: string;
      name?: string;
      stack?: string;
      cause?: unknown;
    };
    const errorDetails = {
      message: fileError?.message || 'Unknown error',
      name: fileError?.name || 'Error',
      stack: fileError?.stack || null,
      cause: fileError?.cause || null,
      leaseId: lease?.id,
      buildiumLeaseId: lease?.buildium_lease_id,
      propertyId: lease?.property_id,
    };
    console.error('Failed to load lease files', JSON.stringify(errorDetails, null, 2));
  }

  const categoryNameLookup = new Map<number, string>();
  for (const category of fileCategories) {
    if (
      category &&
      typeof category.buildium_category_id === 'number' &&
      typeof category.category_name === 'string'
    ) {
      const trimmed = category.category_name.trim();
      if (trimmed) {
        categoryNameLookup.set(category.buildium_category_id, trimmed);
      }
    }
  }

  // Format for compatibility with existing component structure
  const initialFileBundle: {
    files: FileRow[];
    links: {
      id: string;
      file_id: string;
      entity_type: string;
      entity_id: number;
      added_at: string;
      added_by: string | null;
      category: string | null;
    }[];
  } = {
    files: (leaseFiles || []) as FileRow[],
    links: (leaseFiles || []).map((f) => ({
      id: String(f.id ?? ''),
      file_id: String(f.id ?? ''),
      entity_type: 'Lease' as const,
      entity_id: Number(lease.buildium_lease_id) || 0,
      added_at: String(f.created_at ?? ''),
      added_by: f.created_by ? String(f.created_by) : null,
      category:
        typeof f.buildium_category_id === 'number'
          ? (categoryNameLookup.get(f.buildium_category_id) ?? null)
          : null,
    })),
  };

  // Step 3: Fetch contacts for header (tenant names)
  let contacts: UnknownRow[] = [];
  try {
    const { data: lc } = await supabase
      .from('lease_contacts')
      .select(
        'id, role, status, move_in_date, move_out_date, notice_given_date, tenant_id, tenants( id, buildium_tenant_id, contact:contacts(display_name, first_name, last_name, company_name, is_company, primary_email, alt_email, primary_phone, alt_phone) )',
      )
      .eq('lease_id', lease.id);
    contacts = Array.isArray(lc) ? lc : [];
  } catch {}

  // Step 4: Fetch rent schedules for rent tab
  let rentSchedules: UnknownRow[] = [];
  try {
    const { data: schedules } = await supabase
      .from('rent_schedules')
      .select('id, status, start_date, end_date, rent_cycle, total_amount, backdate_charges')
      .eq('lease_id', lease.id)
      .order('start_date', { ascending: true });
    rentSchedules = Array.isArray(schedules) ? schedules : [];
  } catch {}

  let recurringTemplates: UnknownRow[] = [];
  try {
    const { data: recurs } = await supabase
      .from('recurring_transactions')
      .select(
        'id, type, memo, amount, frequency, start_date, end_date, posting_day, posting_type, posting_days_in_advance, gl_account_id, gl_accounts ( name ), duration',
      )
      .eq('lease_id', lease.id)
      .order('start_date', { ascending: true });
    recurringTemplates = Array.isArray(recurs) ? recurs : [];
  } catch {}

  let glAccounts: UnknownRow[] = [];
  try {
    const { data: accounts } = await supabase
      .from('gl_accounts')
      .select('id, name, type, buildium_gl_account_id')
      .order('name', { ascending: true });
    glAccounts = Array.isArray(accounts) ? accounts : [];
  } catch {}

  let bankAccounts: UnknownRow[] = [];
  try {
    const { data: banks } = await supabase
      .from('gl_accounts')
      .select('id, name')
      .eq('is_bank_account', true)
      .order('name', { ascending: true });
    bankAccounts = Array.isArray(banks) ? banks : [];
  } catch {}

  // Step 5: Fetch ledger transactions from local store (if available)
  let transactions: UnknownRow[] = [];
  let transactionsError: string | null = null;
  try {
    const { data: txRows, error: txError } = await supabase
      .from('transactions')
      .select(
        `
        id,
        buildium_transaction_id,
        date,
        transaction_type,
        total_amount,
        memo,
        check_number,
        reference_number,
        tenant_id,
        payee_tenant_id,
        transaction_lines (
          amount,
          memo,
          gl_account_id,
          posting_type,
          gl_accounts ( id, name, type, sub_type, is_security_deposit_liability )
        )
      `,
      )
      .eq('lease_id', lease.id)
      .order('date', { ascending: false })
      .limit(50);

    if (txError) throw txError;
    transactions = Array.isArray(txRows) ? txRows : [];
  } catch (e) {
    transactionsError = e instanceof Error ? e.message : 'Failed to load transactions';
  }

  // Build a tenant name map for payment attribution
  const tenantNameById: Record<string, string> = {};
  try {
    const tenantIds = new Set<string>();
    transactions.forEach((tx) => {
      const tid = isRecord(tx) ? tx.tenant_id : undefined;
      if (tid) tenantIds.add(String(tid));
    });
    if (tenantIds.size > 0) {
      const { data: tenantRows, error: tenantErr } = await supabase
        .from('tenants')
        .select(
          `
          id,
          contacts:contacts!tenants_contact_id_fkey (
            display_name,
            first_name,
            last_name,
            company_name
          )
        `,
        )
        .in('id', Array.from(tenantIds));
      if (tenantErr) throw tenantErr;
      (tenantRows || []).forEach((t) => {
        if (!isRecord(t)) return;
        const contactRaw = t.contacts;
        const contact = isRecord(contactRaw) ? contactRaw : {};
        const displayName = toStringSafe(contact.display_name);
        const first = toStringSafe(contact.first_name);
        const last = toStringSafe(contact.last_name);
        const company = toStringSafe(contact.company_name);
        const name =
          displayName ||
          [first, last].filter(Boolean).join(' ').trim() ||
          company ||
          null;
        if (name && t.id != null) tenantNameById[String(t.id)] = name;
      });
    }
  } catch (err) {
    console.error('Failed to build tenant name map for ledger', err);
  }

  // Fetch property owners (primary owner) for header card
  let primaryOwner: { id?: string; name?: string } | null = null;
  try {
    if (lease.property_id) {
      const res = await fetch(`/api/properties/${lease.property_id}/details`, {
        next: { revalidate: 60, tags: [`property-details:${lease.property_id}`] },
      });
      if (res.ok) {
        const data = await res.json();
        const owners = Array.isArray(data?.owners) ? data.owners : [];
        const po =
          owners.find(
            (o: unknown) =>
              typeof o === 'object' &&
              o !== null &&
              'primary' in o &&
              (o as { primary?: boolean }).primary === true,
          ) || owners[0];
        if (po) {
          const name =
            (po as { display_name?: string | null }).display_name ||
            (po as { company_name?: string | null }).company_name ||
            [
              (po as { first_name?: string | null }).first_name,
              (po as { last_name?: string | null }).last_name,
            ]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            'Owner';
          primaryOwner = {
            id: String(
              (po as { owner_id?: string | number; id?: string | number }).owner_id ||
                (po as { id?: string | number }).id ||
                '',
            ),
            name,
          };
        } else if (data?.primary_owner_name) {
          primaryOwner = { name: String(data.primary_owner_name) };
        }
      }
      // Fallback to PropertyService when cache/API lacks owners
      if (!primaryOwner) {
        try {
          const { PropertyService } = await import('@/lib/property-service');
          const svc = await PropertyService.getPropertyById(String(lease.property_id));
          if (svc) {
            const owners2 = Array.isArray((svc as { owners?: unknown }).owners)
              ? (svc as { owners?: unknown[] }).owners || []
              : [];
            const po2 =
              owners2.find(
                (
                  o,
                ): o is {
                  primary?: boolean;
                  display_name?: string | null;
                  company_name?: string | null;
                  first_name?: string | null;
                  last_name?: string | null;
                  owner_id?: string | number;
                  id?: string | number;
                } =>
                  typeof o === 'object' &&
                  o !== null &&
                  (o as { primary?: boolean }).primary === true,
              ) || owners2[0];
            if (po2) {
              const name2 =
                (po2 as { display_name?: string | null }).display_name ||
                (po2 as { company_name?: string | null }).company_name ||
                [
                  (po2 as { first_name?: string | null }).first_name,
                  (po2 as { last_name?: string | null }).last_name,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .trim() ||
                'Owner';
              primaryOwner = {
                id: String(
                  (po2 as { owner_id?: string | number; id?: string | number }).owner_id ||
                    (po2 as { id?: string | number }).id ||
                    '',
                ),
                name: name2,
              };
            } else if ((svc as { primary_owner_name?: string | null }).primary_owner_name) {
              primaryOwner = {
                name: String((svc as { primary_owner_name?: string | null }).primary_owner_name),
              };
            }
          }
        } catch {}
      }
      // Final fallback: query cache table directly (server/admin)
      if (!primaryOwner) {
        try {
          const { data: poc } = await supabase
            .from('property_ownerships_cache')
            .select('owner_id, display_name, primary')
            .eq('property_id', lease.property_id);
          const list = Array.isArray(poc) ? poc : [];
          if (list.length) {
            const po3 =
              list.find(
                (o) =>
                  typeof o === 'object' &&
                  o !== null &&
                  (o as { primary?: boolean }).primary === true,
              ) || list[0];
            const name3 = (po3 as { display_name?: string | null })?.display_name || 'Owner';
            primaryOwner = {
              id: String((po3 as { owner_id?: string | number })?.owner_id || ''),
              name: name3,
            };
          }
        } catch {}
      }
      // Deep fallback: join ownerships → owners → contacts for display name
      if (!primaryOwner) {
        try {
          const { data: own } = await supabase
            .from('ownerships')
            .select(
              'primary, owner_id, owners ( contact_id, contacts ( display_name, first_name, last_name, company_name ) )',
            )
            .eq('property_id', lease.property_id);
          const list = Array.isArray(own) ? own : [];
          if (list.length) {
            const po4 =
              list.find(
                (o) => typeof o === 'object' && o && (o as { primary?: boolean }).primary,
              ) || list[0];
            const contact =
              po4 && typeof po4 === 'object' && po4.owners && typeof po4.owners === 'object'
                ? ((
                    po4.owners as {
                      contacts?: {
                        display_name?: string | null;
                        company_name?: string | null;
                        first_name?: string | null;
                        last_name?: string | null;
                      } | null;
                    }
                  ).contacts ?? null)
                : null;
            const name4 =
              contact?.display_name ||
              contact?.company_name ||
              [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
              'Owner';
            primaryOwner = {
              id: String((po4 as { owner_id?: string | number })?.owner_id || ''),
              name: name4,
            };
          }
        } catch {}
      }
    }
  } catch {}

  // Outstanding balances from Buildium
  let balances: { balance: number; prepayments: number; depositsHeld: number } = {
    balance: 0,
    prepayments: 0,
    depositsHeld: 0,
  };
  try {
    if (lease.buildium_lease_id) {
      const res = await fetch(
        `/api/buildium/leases/${lease.buildium_lease_id}/transactions/outstanding-balances`,
        { cache: 'no-store' },
      );
      const j = await res.json().catch(() => null as unknown);
      const d = (j as { data?: UnknownRow })?.data || j || {};
      const toNum = (v: unknown) => (v == null ? 0 : Number(v));
      balances = {
        balance: toNum(d.Balance ?? d.balance ?? d.TotalBalance ?? d.OutstandingBalance),
        prepayments: toNum(d.Prepayments ?? d.prepayments ?? d.PrepaymentBalance),
        depositsHeld: toNum(d.DepositsHeld ?? d.depositsHeld ?? d.Deposits),
      };
    }
  } catch {}

  const tenantNames: string[] = Array.isArray(contacts)
    ? contacts
        .map((lc) => {
          const tenantContact =
            (lc?.tenants as { contact?: UnknownRow } | undefined)?.contact ?? null;
          return (
            (tenantContact as UnknownRow)?.display_name ||
            (tenantContact as UnknownRow)?.company_name ||
            [(tenantContact as UnknownRow)?.first_name, (tenantContact as UnknownRow)?.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            'Tenant'
          );
        })
        .filter(Boolean)
    : [];

  const toTitleCase = (input?: string | null) =>
    input
      ? input
          .toLowerCase()
          .split(/[_\s]+/)
          .filter(Boolean)
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join(' ')
      : null;

  const formatRentCycleLabel = (value?: string | null) => {
    if (!value) return '—';
    const spaced = String(value)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/(\d+)/g, ' $1 ');
    return toTitleCase(spaced.trim()) || spaced.trim();
  };

  const formatScheduleDate = (value?: string | null) => {
    if (!value) return 'No end date';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const summarizeScheduleRange = (
    schedule?: { start_date?: string | null; end_date?: string | null } | null,
  ) => {
    if (!schedule) return '—';
    const start = schedule.start_date
      ? formatScheduleDate(schedule.start_date)
      : 'Start date not set';
    const end = schedule.end_date ? formatScheduleDate(schedule.end_date) : 'No end date';
    return `${start} – ${end}`;
  };

  const formatOrdinalDay = (value?: number | string | null) => {
    if (value === null || value === undefined) return null;
    const day = Number(value);
    if (!Number.isFinite(day) || day <= 0) return null;
    const remainderTen = day % 10;
    const remainderHundred = day % 100;
    let suffix = 'th';
    if (remainderHundred < 11 || remainderHundred > 13) {
      if (remainderTen === 1) suffix = 'st';
      else if (remainderTen === 2) suffix = 'nd';
      else if (remainderTen === 3) suffix = 'rd';
    }
    return `${day}${suffix}`;
  };

  const normalizePhone = (value?: string | null) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed;
  };

  const computeInitials = (value: string) => {
    const parts = value.split(/\s+/).filter(Boolean);
    if (!parts.length) return '??';
    const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
    return initials.join('') || '??';
  };

  type ContactRow = {
    id: string | number;
    name: string;
    role: string;
    email: string | null;
    moveIn: string;
    moveOut: string;
    moveOutRaw: string | null;
    notice: string;
    noticeRaw: string | null;
    tenantId: string | number | null | undefined;
    buildiumTenantId: number | null;
    initials: string;
    phones: Array<{ number: string }>;
    roleKey: string;
  };

  const contactRows: ContactRow[] = Array.isArray(contacts)
    ? (contacts
        .map((lc) => {
          const contact = lc?.tenants?.contact;
          if (!contact) return null;
          const name =
            contact.display_name ||
            contact.company_name ||
            [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
            'Tenant';
          const email = contact.primary_email || contact.alt_email || null;
          const role = toTitleCase(lc?.role) || 'Tenant';
          const moveIn = fmtDate(lc?.move_in_date || undefined);
          const moveOutRaw = lc?.move_out_date || null;
          const moveOut = fmtDate(moveOutRaw || undefined);
          const noticeRaw = lc?.notice_given_date || null;
          const notice = fmtDate(noticeRaw || undefined);
          const phones = [contact.primary_phone, contact.alt_phone]
            .map((phone) => normalizePhone(phone))
            .filter(Boolean)
            .map((number) => ({ number: number as string }));
          const tenantId = lc?.tenant_id;
          const buildiumTenantIdRaw = lc?.tenants?.buildium_tenant_id ?? null;
          const buildiumTenantId =
            typeof buildiumTenantIdRaw === 'number'
              ? buildiumTenantIdRaw
              : buildiumTenantIdRaw != null && !Number.isNaN(Number(buildiumTenantIdRaw))
                ? Number(buildiumTenantIdRaw)
                : null;

          return {
            id: lc?.id ?? name,
            name,
            role,
            email,
            moveIn,
            moveOut,
            moveOutRaw,
            notice,
            noticeRaw,
            tenantId: tenantId,
            buildiumTenantId,
            initials: computeInitials(name),
            phones,
            roleKey: String(lc?.role || 'Tenant').toLowerCase(),
          };
        })
        .filter(Boolean) as ContactRow[])
    : [];

  const tenantOptionMap = new Map<string, LeaseTenantOption>();
  for (const row of contactRows) {
    if (!row) continue;
    const optionId = row.tenantId ? String(row.tenantId) : row.id ? String(row.id) : null;
    if (!optionId) continue;
    const buildiumTenantId =
      typeof row.buildiumTenantId === 'number'
        ? row.buildiumTenantId
        : row.buildiumTenantId != null && !Number.isNaN(Number(row.buildiumTenantId))
          ? Number(row.buildiumTenantId)
          : null;
    tenantOptionMap.set(optionId, {
      id: optionId,
      name: row.name,
      buildiumTenantId,
    });
  }
  const recurringTenantOptions = Array.from(tenantOptionMap.values());

  // Resolve first tenant id for summary link
  const firstTenantRow = contactRows.find(
    (row) => row && !String(row.roleKey || '').includes('cosigner'),
  );
  const firstTenantId = firstTenantRow?.tenantId ? String(firstTenantRow.tenantId) : null;

  type TenantCardInfo = {
    id: string;
    name: string;
    initials: string;
    moveIn: string | null;
    moveOut: string | null;
    moveOutRaw: string | null;
    notice: string | null;
    noticeRaw: string | null;
    email: string | null;
    phones: { number: string; action?: { label: string; href: string } }[];
    roleLabel: string;
    tenantId: string | null;
    moveOutBadge: string | null;
  };

  const tenantsByRole = contactRows
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .reduce(
      (acc, row) => {
        const moveOutDateObj = row.moveOutRaw ? new Date(row.moveOutRaw) : null;
        const moveOutBadge =
          row.moveOutRaw && moveOutDateObj
            ? moveOutDateObj < new Date()
              ? 'Moved out'
              : 'Moving out'
            : null;
        const info: TenantCardInfo = {
          id: String(row.id),
          name: row.name,
          initials: row.initials,
          moveIn: row.moveIn && row.moveIn !== '—' ? row.moveIn : null,
          moveOut: row.moveOut && row.moveOut !== '—' ? row.moveOut : null,
          moveOutRaw: row.moveOutRaw || null,
          notice: row.notice && row.notice !== '—' ? row.notice : null,
          noticeRaw: row.noticeRaw || null,
          email: row.email,
          phones: row.phones,
          roleLabel: row.role,
          tenantId: row.tenantId ? String(row.tenantId) : null,
          moveOutBadge,
        };
        const bucket = row.roleKey.includes('cosigner') ? 'cosigners' : 'tenants';
        acc[bucket].push(info);
        return acc;
      },
      { tenants: [] as TenantCardInfo[], cosigners: [] as TenantCardInfo[] },
    );

  type RentScheduleEntry = {
    id: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    rent_cycle: string | null;
    total_amount: number;
    backdate_charges: boolean;
    statusLabel: string;
    statusVariant: 'default' | 'secondary' | 'outline';
  };

  const rentScheduleEntries: RentScheduleEntry[] = rentSchedules
    .filter(Boolean)
    .map((schedule) => {
      const status = String(schedule?.status ?? 'Future');
      const statusLower = status.toLowerCase();
      const variant: 'default' | 'secondary' | 'outline' =
        statusLower === 'current' ? 'default' : statusLower === 'future' ? 'secondary' : 'outline';

      return {
        id: String(schedule?.id ?? randomUUID()),
        status,
        start_date: schedule?.start_date ?? null,
        end_date: schedule?.end_date ?? null,
        rent_cycle: schedule?.rent_cycle ?? null,
        total_amount: Number(schedule?.total_amount ?? 0) || 0,
        backdate_charges: Boolean(schedule?.backdate_charges),
        statusLabel: status.toUpperCase(),
        statusVariant: variant,
      };
    })
    .sort((a, b) => {
      const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
      return bDate - aDate;
    });

  const currentSchedule =
    rentScheduleEntries.find((entry) => entry.status.toLowerCase() === 'current') || null;
  const upcomingSchedule =
    rentScheduleEntries
      .filter((entry) => entry.status.toLowerCase() === 'future')
      .sort((a, b) => {
        const aDate = a.start_date ? new Date(a.start_date).getTime() : Number.POSITIVE_INFINITY;
        const bDate = b.start_date ? new Date(b.start_date).getTime() : Number.POSITIVE_INFINITY;
        return aDate - bDate;
      })[0] || null;
  const paymentDueDayLabel = formatOrdinalDay(lease?.payment_due_day);
  const currentCycleLabel = currentSchedule
    ? formatRentCycleLabel(currentSchedule.rent_cycle)
    : null;
  const upcomingCycleLabel = upcomingSchedule
    ? formatRentCycleLabel(upcomingSchedule.rent_cycle)
    : null;
  const rentLogDisplay = rentScheduleEntries.map((row) => ({
    id: row.id,
    statusLabel: row.statusLabel,
    statusVariant: row.statusVariant,
    startLabel: row.start_date ? formatScheduleDate(row.start_date) : '—',
    endLabel: row.end_date ? formatScheduleDate(row.end_date) : 'No end date',
    cycleLabel: formatRentCycleLabel(row.rent_cycle),
    amountLabel: fmtUsd(row.total_amount),
  }));
  const currentCard = currentSchedule
    ? {
        rangeLabel: summarizeScheduleRange(currentSchedule),
        amountLabel: fmtUsd(currentSchedule.total_amount),
        cycleLabel: currentCycleLabel,
        chargeLabel: paymentDueDayLabel
          ? `Charged on the ${paymentDueDayLabel}`
          : 'Charge day not set',
      }
    : null;
  const upcomingCard = upcomingSchedule
    ? {
        rangeLabel: summarizeScheduleRange(upcomingSchedule),
        amountLabel: fmtUsd(upcomingSchedule.total_amount),
        cycleLabel: upcomingCycleLabel,
      }
    : null;
  const rentCycleOptions = RentCycleEnumDb.options;
  const rentStatusOptions = RentScheduleStatusEnumDb.options;
  const rentFormDefaults = {
    start_date: upcomingSchedule?.start_date ?? null,
    end_date: upcomingSchedule?.end_date ?? null,
    rent_cycle: upcomingSchedule?.rent_cycle ?? currentSchedule?.rent_cycle ?? rentCycleOptions[0],
    total_amount: upcomingSchedule?.total_amount ?? currentSchedule?.total_amount ?? null,
    status: 'Future',
  };
  const leaseChargesNote =
    typeof lease?.lease_charges === 'string' && lease.lease_charges.trim().length
      ? lease.lease_charges
      : null;
  const leaseRangeLabel =
    lease?.lease_from_date || lease?.lease_to_date
      ? `${lease?.lease_from_date ? formatScheduleDate(lease.lease_from_date) : 'Start date not set'} – ${lease?.lease_to_date ? formatScheduleDate(lease.lease_to_date) : 'No end date'}`
      : null;
  const propertyUnitLabel = property?.name
    ? unit?.unit_number
      ? `${property.name} • ${unit.unit_number}`
      : property.name
    : unit?.unit_number
      ? `Unit ${unit.unit_number}`
      : null;
  const leaseSummaryInfo = {
    leaseType: toTitleCase(lease?.lease_type) || null,
    leaseRange: leaseRangeLabel,
    tenants: tenantNames.length ? tenantNames.join(', ') : null,
    propertyUnit: propertyUnitLabel,
    currentMarketRent:
      currentCard?.amountLabel ?? (lease?.rent_amount != null ? fmtUsd(lease.rent_amount) : null),
  };

  const recurringAccountOptions: LeaseAccountOption[] = glAccounts
    .filter(
      (account) =>
        account &&
        account.id != null &&
        account.buildium_gl_account_id != null &&
        Number.isFinite(Number(account.buildium_gl_account_id)),
    )
    .map((account) => ({
      id: String(account.id),
      name: account.name || 'Account',
      type: account.type || null,
      buildiumGlAccountId:
        typeof account.buildium_gl_account_id === 'number'
          ? account.buildium_gl_account_id
          : Number(account.buildium_gl_account_id) || null,
    }));

  const recurringTenantLabel = tenantNames.length ? tenantNames.join(', ') : null;
  const bankAccountOptions = bankAccounts
    .filter((account) => account && account.id != null)
    .map((account) => ({ id: String(account.id), name: account.name || 'Bank account' }));

  const recurringRows: RecurringRow[] = recurringTemplates.filter(Boolean).map((row) => {
    const nextDate = row?.start_date ? formatScheduleDate(row.start_date) : '—';
    const frequencyLabel = formatRentCycleLabel(row?.frequency) || '—';
    const durationLabel = row?.duration ? String(toTitleCase(row.duration)) : '—';
    const postingDescription = (() => {
      if (typeof row?.posting_days_in_advance === 'number' && row.posting_days_in_advance !== 0) {
        const days = Math.abs(row.posting_days_in_advance);
        const suffix = days === 1 ? 'day' : 'days';
        const direction = row.posting_days_in_advance > 0 ? 'in advance' : 'after';
        return `Post ${days} ${suffix} ${direction}`;
      }
      if (row?.posting_day) {
        return `Post on day ${row.posting_day}`;
      }
      return 'Post on due date';
    })();
    const accountName = String(row?.gl_accounts?.name || row?.gl_account_name || '—');
    const typeLabel = toTitleCase(row?.type) || 'Transaction';
    return {
      id: String(row?.id ?? randomUUID()),
      nextDate,
      type: typeLabel,
      account: accountName,
      memo: String(row?.memo || '—'),
      frequency: frequencyLabel,
      duration: durationLabel,
      posting: postingDescription,
      amount: fmtUsd(Number(row?.amount ?? 0)),
    };
  });

  const formatLedgerDate = (date?: string | null) => {
    if (!date) return '—';
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const parseDateValue = (date?: string | null) => {
    if (!date) return null;
    const parsed = new Date(date);
    const timestamp = parsed.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  };

  const extractTransactionLines = (tx: unknown) => {
    if (!isRecord(tx)) return [];
    const journalLines = isRecord(tx.Journal) ? tx.Journal.Lines : null;
    const candidates = [
      tx.transaction_lines,
      tx.Lines,
      journalLines,
    ];
    const lines = candidates.find((c) => Array.isArray(c) && c.length) as unknown[] | undefined;
    return Array.isArray(lines) ? lines.filter(Boolean) : [];
  };

  const normalizePostingType = (line: unknown) => {
    if (!isRecord(line)) return '';
    const raw =
      line.posting_type ??
      line.PostingType ??
      line.LineType ??
      line.postingType ??
      line.posting_type_enum ??
      '';
    return typeof raw === 'string' ? raw.toLowerCase() : '';
  };

  const pickString = (obj: UnknownRow | null | undefined, keys: string[]) => {
    if (!obj) return '';
    for (const key of keys) {
      const val = obj[key];
      if (typeof val === 'string') return val;
    }
    return '';
  };

  const extractAccountFromLine = (line: unknown) => {
    if (!isRecord(line)) {
      return {
        account: null,
        displayName: '',
        name: '',
        type: '',
        subType: '',
        isDeposit: false,
      };
    }
    const accountRaw =
      (line.gl_accounts && isRecord(line.gl_accounts) ? line.gl_accounts : null) ||
      (line.GLAccount && isRecord(line.GLAccount) ? line.GLAccount : null) ||
      (line.Account && isRecord(line.Account) ? line.Account : null);
    const rawName = pickString(accountRaw, ['name', 'Name']);
    const rawType = pickString(accountRaw, ['type', 'Type']);
    const rawSubType = pickString(accountRaw, ['sub_type', 'SubType']);

    return {
      account: accountRaw,
      displayName: rawName || '',
      name: rawName.toLowerCase(),
      type: rawType.toLowerCase(),
      subType: rawSubType.toLowerCase(),
      isDeposit: Boolean(
        accountRaw && isRecord(accountRaw) && accountRaw.is_security_deposit_liability,
      ),
    };
  };

  // If Buildium balances are unavailable or zero, fall back to local
  // transactions to compute a current balance so the UI reflects
  // newly entered charges immediately.
  try {
    balances = resolveLeaseBalances(balances, transactions);
  } catch {}

  // If deposits/prepayments are missing from the Buildium response, infer them from transaction lines.
  try {
    const needsDeposits = !balances.depositsHeld;
    const needsPrepayments = !balances.prepayments;
    if ((needsDeposits || needsPrepayments) && Array.isArray(transactions) && transactions.length) {
      let depositBalance = 0;
      let prepaymentBalance = 0;

      const readAmount = (line: unknown) => {
        if (!isRecord(line)) return 0;
        const val = line.amount ?? (isRecord(line) ? line.Amount : null);
        return toNumber(val) ?? 0;
      };

      for (const tx of transactions) {
        const lines = extractTransactionLines(tx);
        if (!lines.length) continue;

        for (const line of lines) {
          const amountRaw = readAmount(line);
          const amount = Math.abs(amountRaw);
          if (!amount) continue;

          const postingType = normalizePostingType(line);
          const isCredit = postingType === 'credit' || postingType === 'cr';
          const signed = postingType ? (isCredit ? amount : -amount) : amountRaw;

          const { name, type, subType, isDeposit } = extractAccountFromLine(line);
          const depositFlag = isDeposit || name.includes('deposit') || subType.includes('deposit');
          if (depositFlag) {
            // For liabilities, credits increase the balance; ignore debits so a "charge" doesn't wipe out the held deposit.
            depositBalance += isCredit ? amount : 0;
            continue;
          }

          const prepayFlag =
            name.includes('prepay') ||
            subType.includes('prepay') ||
            (type === 'liability' && !depositFlag);
          if (prepayFlag) prepaymentBalance += signed;
        }
      }

      if (needsDeposits && depositBalance) {
        balances = { ...balances, depositsHeld: depositBalance };
      }
      if (needsPrepayments && prepaymentBalance) {
        balances = { ...balances, prepayments: prepaymentBalance };
      }
    }
  } catch {}

  const ledgerRows = Array.isArray(transactions)
    ? transactions.filter(Boolean).map((tx, idx) => {
        const lines = extractTransactionLines(tx);
        const primaryLine = lines?.[0] || null;
        const primaryAccount = primaryLine ? extractAccountFromLine(primaryLine) : null;
        const accountName =
          primaryAccount?.displayName ||
          (isRecord(primaryLine) && typeof primaryLine.GLAccountName === 'string'
            ? primaryLine.GLAccountName
            : null) ||
          '—';
        const memo =
          (isRecord(primaryLine) && typeof primaryLine.memo === 'string' ? primaryLine.memo : null) ||
          (isRecord(primaryLine) && typeof primaryLine.Memo === 'string' ? primaryLine.Memo : null) ||
          (isRecord(tx) && typeof tx.memo === 'string' ? tx.memo : null) ||
          (isRecord(tx) && typeof tx.Memo === 'string' ? tx.Memo : null) ||
          (isRecord(tx) && typeof tx.Description === 'string' ? tx.Description : null) ||
          null;
        const buildiumIdRaw = isRecord(tx) ? tx.Id ?? tx.buildium_transaction_id : null;
        const buildiumId = toNumber(buildiumIdRaw);
        const localId = isRecord(tx) && (tx.id || tx.Id) ? tx.id ?? tx.Id : randomUUID();
        const baseType =
          (isRecord(tx) && typeof tx.TransactionTypeEnum === 'string'
            ? tx.TransactionTypeEnum
            : null) ||
          (isRecord(tx) && typeof tx.TransactionType === 'string' ? tx.TransactionType : null) ||
          (isRecord(tx) && typeof tx.transaction_type === 'string' ? tx.transaction_type : null) ||
          'Transaction';
        const tenantId = isRecord(tx) && tx.tenant_id ? String(tx.tenant_id) : null;
        const tenantName = tenantId ? tenantNameById[tenantId] : null;
        const typeLabel =
          typeof baseType === 'string' && baseType.toLowerCase().includes('payment') && tenantName
            ? `${baseType} (made by ${tenantName})`
            : baseType;
        const rawDate =
          (isRecord(tx) && tx.Date) ??
          (isRecord(tx) && tx.date) ??
          (isRecord(tx) && tx.TransactionDate) ??
          (isRecord(tx) && tx.TransactionDateTime) ??
          (isRecord(tx) && tx.entry_date) ??
          null;
        const sequence = Number.isFinite(Number(buildiumIdRaw))
          ? Number(buildiumIdRaw)
          : Number.isFinite(Number(isRecord(tx) ? tx.id : null))
            ? Number((isRecord(tx) ? tx.id : null) as unknown)
            : null;
        return {
          id: String(localId),
          date: formatLedgerDate(rawDate),
          account: accountName,
          type: typeLabel,
          memo,
          amount:
            (isRecord(tx) && toNumber(tx.TotalAmount)) ??
              (isRecord(tx) && toNumber(tx.total_amount)) ??
              0 || 0,
          signedAmount: signedAmountFromTransaction(tx),
          transactionId: buildiumId,
          sortKey: parseDateValue(rawDate) ?? 0,
          originalIndex: idx,
          sequence,
          tenantId,
        };
      })
    : [];

  // Compute running balance in chronological order so historical row balances stay fixed
  const ledgerRowsChrono = ledgerRows.slice().sort((a, b) => {
    const aKey = Number.isFinite(a.sortKey) ? (a.sortKey as number) : 0;
    const bKey = Number.isFinite(b.sortKey) ? (b.sortKey as number) : 0;
    if (aKey !== bKey) return aKey - bKey;
    const aSeq = Number.isFinite(a.sequence) ? (a.sequence as number) : null;
    const bSeq = Number.isFinite(b.sequence) ? (b.sequence as number) : null;
    if (aSeq !== null && bSeq !== null && aSeq !== bSeq) return aSeq - bSeq;
    return (b.originalIndex ?? 0) - (a.originalIndex ?? 0);
  });

  let runningBalance = 0;
  const ledgerRowsWithBalance = ledgerRowsChrono.map((row) => {
    const signed = normalizeCurrency(row.signedAmount);
    const amountAbs = Math.abs(signed);
    const amountFormatted = fmtUsd(amountAbs);
    const updatedBalance = normalizeCurrency(runningBalance + signed);
    const displayAmount = signed < 0 ? `-${amountFormatted}` : amountFormatted;
    runningBalance = updatedBalance;
    return {
      ...row,
      displayAmount,
      balance: fmtUsd(updatedBalance),
      transactionId: row.transactionId ?? row.id,
      amountRaw: row.amount,
    };
  });

  const ledgerRowsForPanel = ledgerRowsWithBalance
    .slice()
    .sort((a, b) => {
      const aKey = Number.isFinite(a.sortKey) ? (a.sortKey as number) : 0;
      const bKey = Number.isFinite(b.sortKey) ? (b.sortKey as number) : 0;
      if (aKey !== bKey) return bKey - aKey;
      const aSeq = Number.isFinite(a.sequence) ? (a.sequence as number) : null;
      const bSeq = Number.isFinite(b.sequence) ? (b.sequence as number) : null;
      if (aSeq !== null && bSeq !== null && aSeq !== bSeq) return bSeq - aSeq;
      return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
    })
    .map(({ sortKey: _sortKey, originalIndex: _originalIndex, ...row }) => ({
      id: row.id,
      date: row.date,
      account: row.account,
      type: row.type,
      memo: row.memo,
      displayAmount: row.displayAmount,
      balance: row.balance,
      transactionId: row.transactionId,
      amountRaw: row.amountRaw,
      signedAmount: row.signedAmount,
    }));

  const depositsHeldTotal = Number(balances.depositsHeld ?? 0) || 0;
  const prepaymentsTotal = Number(balances.prepayments ?? 0) || 0;
  const depositsTableRows: Array<{
    id: string;
    account: string;
    date?: string;
    type?: string;
    memo?: string;
    amount: number;
    balance: number;
  }> = [];

  // Build deposits/prepayments table from actual transaction lines (deposit/prepay accounts)
  try {
    if (Array.isArray(transactions) && transactions.length) {
      let running = 0;
      for (const tx of transactions) {
        const lines = extractTransactionLines(tx);
        if (!lines.length) continue;
        const rawDate =
          (isRecord(tx) && tx.Date) ??
          (isRecord(tx) && tx.date) ??
          (isRecord(tx) && tx.TransactionDate) ??
          (isRecord(tx) && tx.TransactionDateTime) ??
          (isRecord(tx) && tx.entry_date);
        const dateLabel = formatLedgerDate(rawDate);
        const typeLabel =
          (isRecord(tx) && typeof tx.TransactionTypeEnum === 'string'
            ? tx.TransactionTypeEnum
            : null) ||
          (isRecord(tx) && typeof tx.TransactionType === 'string' ? tx.TransactionType : null) ||
          (isRecord(tx) && typeof tx.transaction_type === 'string' ? tx.transaction_type : null) ||
          'Transaction';

        for (const line of lines) {
          const amountRaw = readAmountFromLine(line);
          const amount = Math.abs(amountRaw);
          if (!amount) continue;
          const postingType = normalizePostingType(line);
          const isCredit = postingType === 'credit' || postingType === 'cr';
          const signed = postingType ? (isCredit ? amount : -amount) : amountRaw;

          const { displayName, name, type, subType, isDeposit } = extractAccountFromLine(line);
          const accountLabel = displayName || name || 'Account';
          const depositFlag = isDeposit || name.includes('deposit') || subType.includes('deposit');
          const prepayFlag =
            name.includes('prepay') ||
            subType.includes('prepay') ||
            (type === 'liability' && !depositFlag);

          if (!depositFlag && !prepayFlag) continue;

          // For liabilities, treat credits as increases and debits as decreases.
          running += signed;
          const normalizedType = typeLabel.toLowerCase();
          const baseType = normalizedType.includes('payment')
            ? 'Payment'
            : normalizedType.includes('credit')
              ? 'Payment'
              : typeLabel;
          const payerLabel =
            baseType === 'Payment' && tenantNames.length
              ? `${baseType} made by ${tenantNames.join(', ')}`
              : baseType;
          const amountForDisplay = isCredit ? amount : amount * -1;
          const lineMemo =
            (isRecord(line) && typeof line.memo === 'string' ? line.memo : null) ||
            (isRecord(line) && typeof line.Memo === 'string' ? line.Memo : null) ||
            (isRecord(tx) && typeof tx.memo === 'string' ? tx.memo : null) ||
            (isRecord(tx) && typeof tx.Memo === 'string' ? tx.Memo : null) ||
            (isRecord(tx) && typeof tx.Description === 'string' ? tx.Description : null) ||
            '';
          const txIdForRow =
            (isRecord(tx) && (tx.Id ?? tx.id)) != null
              ? String((isRecord(tx) ? tx.Id ?? tx.id : '') as unknown)
              : randomUUID();

          depositsTableRows.push({
            id: `${txIdForRow}-${depositsTableRows.length}`,
            account: accountLabel,
            date: dateLabel,
            type: payerLabel,
            memo: lineMemo,
            amount: amountForDisplay,
            balance: running,
          });
        }
      }
    }
  } catch {}

  // Fallback to summary rows if no detailed lines were found
  if (depositsTableRows.length === 0) {
    if (depositsHeldTotal > 0) {
      depositsTableRows.push({
        id: 'deposit-summary',
        account: 'Security Deposit Liability',
        date: formatLedgerDate(
          Array.isArray(transactions) && transactions[0]
            ? ((isRecord(transactions[0]) && transactions[0].Date) ??
                (isRecord(transactions[0]) && transactions[0].date) ??
                (isRecord(transactions[0]) && transactions[0].TransactionDate) ??
                (isRecord(transactions[0]) && transactions[0].TransactionDateTime) ??
                (isRecord(transactions[0]) && transactions[0].entry_date))
            : null,
        ),
        type: 'Payment',
        memo: 'Security deposit balance',
        amount: depositsHeldTotal,
        balance: depositsHeldTotal,
      });
    }
    if (prepaymentsTotal > 0) {
      depositsTableRows.push({
        id: 'prepayment-summary',
        account: 'Prepayments',
        date: undefined,
        type: 'Credit',
        memo: 'Prepayment balance',
        amount: prepaymentsTotal,
        balance: prepaymentsTotal,
      });
    }
  }
  const ledgerMatchesLabel = transactionsError
    ? 'Unable to load ledger'
    : ledgerRowsWithBalance.length
      ? `${ledgerRowsWithBalance.length} match${ledgerRowsWithBalance.length === 1 ? '' : 'es'}`
      : 'No ledger entries';

  return (
    <Tabs defaultValue={initialTab} className="space-y-6">
      <div className="space-y-2 p-6 pb-0">
        <LeaseHeaderMeta
          leaseId={lease.id}
          buildiumLeaseId={lease.buildium_lease_id}
          status={lease.status}
          leaseType={lease.lease_type}
          termType={lease.term_type}
          startDate={lease.lease_from_date}
          endDate={lease.lease_to_date}
          unitDisplay={
            property?.name
              ? `${property.name} - ${unit?.unit_number ?? ''}`
              : unit?.unit_number
                ? `Unit ${unit.unit_number}`
                : ''
          }
          titleText={`${property?.name || 'Property'}${unit?.unit_number ? ` - ${unit.unit_number}` : ''}${tenantNames.length ? ` • ${tenantNames.join(', ')}` : ''}`}
          backHref={`/properties/${property?.id ?? ''}/units/${unit?.id ?? ''}`}
        />
        <div className="border-border mt-4 border-b">
          <TabsList className="text-muted-foreground flex h-auto items-center space-x-8 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="summary"
              className="data-[state=active]:border-primary data-[state=active]:text-primary hover:border-muted-foreground hover:text-foreground flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="financials"
              className="data-[state=active]:border-primary data-[state=active]:text-primary hover:border-muted-foreground hover:text-foreground flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Financials
            </TabsTrigger>
            <TabsTrigger
              value="tenants"
              className="data-[state=active]:border-primary data-[state=active]:text-primary hover:border-muted-foreground hover:text-foreground flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Tenants
            </TabsTrigger>
            <TabsTrigger
              value="communications"
              className="data-[state=active]:border-primary data-[state=active]:text-primary hover:border-muted-foreground hover:text-foreground flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Communications
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="data-[state=active]:border-primary data-[state=active]:text-primary hover:border-muted-foreground hover:text-foreground flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="data-[state=active]:border-primary data-[state=active]:text-primary hover:border-muted-foreground hover:text-foreground flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Files
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="summary" className="space-y-6 px-6 pb-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <InfoCard title="Lease details">
              <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium">UNIT</div>
                  <Link
                    href={`/properties/${property?.id ?? ''}/units/${unit?.id ?? ''}`}
                    className="text-primary hover:underline"
                  >
                    {property?.name
                      ? `${property.name} - ${unit?.unit_number ?? ''}`
                      : unit?.unit_number
                        ? `Unit ${unit.unit_number}`
                        : '—'}
                  </Link>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium">RENTAL OWNER</div>
                  {primaryOwner?.name ? (
                    primaryOwner?.id ? (
                      <Link
                        href={`/owners/${primaryOwner.id}`}
                        className="text-primary hover:underline"
                      >
                        {primaryOwner.name}
                      </Link>
                    ) : (
                      <span>{primaryOwner.name}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium">TENANT</div>
                  {tenantNames.length ? (
                    firstTenantId ? (
                      <Link
                        href={`/tenants/${firstTenantId}`}
                        className="text-primary hover:underline"
                      >
                        {tenantNames[0]}
                      </Link>
                    ) : (
                      <span className="text-foreground">{tenantNames[0]}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="sm:col-span-3">
                <div className="text-muted-foreground mb-1 text-xs font-medium">LEASE CHARGES</div>
                {leaseChargesNote ? (
                  <p className="text-foreground whitespace-pre-wrap">{leaseChargesNote}</p>
                ) : (
                  <span className="text-muted-foreground">No additional charges noted.</span>
                )}
              </div>
            </InfoCard>

            <LeaseFilesTable
              leaseId={lease.id}
              isBuildiumLinked={Boolean(lease.buildium_lease_id)}
              initialFiles={initialFileBundle}
              categories={fileCategories as LeaseFileCategory[]}
            />
          </div>
          <div className="surface-card surface-card--muted inline-block h-fit rounded-2xl p-4 text-sm shadow-sm">
            <div className="space-y-2.5">
              <div className="text-foreground flex items-center justify-between font-semibold">
                <span>Balance</span>
                <span>{fmtUsd(balances.balance)}</span>
              </div>
              <div className="text-foreground flex items-center justify-between">
                <span>Prepayments</span>
                <span className="font-medium">{fmtUsd(balances.prepayments)}</span>
              </div>
              <div className="text-foreground flex items-center justify-between">
                <span>Deposits held</span>
                <span className="font-medium">{fmtUsd(balances.depositsHeld)}</span>
              </div>
              <div className="text-foreground flex items-center justify-between">
                <span>Rent</span>
                <span className="font-medium">{fmtUsd(lease.rent_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="financials" className="space-y-6 px-6 pb-6">
        <div className="border-border border-b">
          <Tabs defaultValue="ledger" className="relative space-y-4">
            <TabsList className="text-muted-foreground flex h-auto w-fit items-center gap-8 rounded-none bg-transparent p-0">
              {[
                { value: 'ledger', label: 'Ledger' },
                { value: 'deposits', label: 'Deposits & Prepayments' },
                { value: 'rent', label: 'Rent' },
                { value: 'recurring', label: 'Recurring transactions' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:border-primary data-[state=active]:text-primary flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-sm font-medium transition-colors"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="ledger" className="space-y-6">
              <LeaseLedgerPanel
                leaseId={lease.id}
                rows={ledgerRowsForPanel}
                ledgerMatchesLabel={ledgerMatchesLabel}
                balances={balances}
                tenantOptions={recurringTenantOptions}
                accountOptions={recurringAccountOptions}
                leaseSummary={{
                  propertyUnit: leaseSummaryInfo.propertyUnit,
                  tenants: recurringTenantLabel,
                }}
                errorMessage={transactionsError}
                bankAccountOptions={bankAccountOptions}
              />
            </TabsContent>

            <TabsContent value="deposits" className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="border-border bg-card rounded-lg border px-5 py-4">
                    <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Deposits held
                    </div>
                    <div className="text-foreground mt-1 text-2xl font-semibold">
                      {fmtUsd(depositsHeldTotal)}
                    </div>
                  </div>
                  <div className="border-border bg-card rounded-lg border px-5 py-4">
                    <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Prepayments
                    </div>
                    <div className="text-foreground mt-1 text-2xl font-semibold">
                      {fmtUsd(prepaymentsTotal)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild>
                    <Link href={`/leases/${lease.id}?tab=financials`}>Receive payment</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/leases/${lease.id}?tab=financials`}>Enter charge</Link>
                  </Button>
                </div>
              </div>
              <div className="border-border overflow-hidden rounded-lg border">
                <Table className="divide-border min-w-full divide-y">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-border bg-card divide-y">
                    {depositsTableRows.length ? (
                      <>
                        {depositsTableRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-foreground text-sm">
                              {row.date || '—'}
                            </TableCell>
                            <TableCell className="text-foreground text-sm">
                              {row.account || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="text-foreground flex items-center gap-2 text-sm">
                                <ArrowRight className="text-muted-foreground h-4 w-4" />
                                <div className="flex flex-col">
                                  <span className="font-medium">{row.type || 'Transaction'}</span>
                                  {row.memo ? (
                                    <span className="text-muted-foreground text-xs">
                                      {row.memo}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-foreground text-sm">
                              {fmtUsd(row.amount)}
                            </TableCell>
                            <TableCell className="text-foreground text-sm">
                              {fmtUsd(row.balance)}
                            </TableCell>
                            <TableCell className="text-right">
                              <ActionButton aria-label="Deposit actions" />
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-medium">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell>
                            {fmtUsd(depositsTableRows.reduce((sum, row) => sum + row.amount, 0))}
                          </TableCell>
                          <TableCell>
                            {fmtUsd(depositsTableRows.reduce((sum, row) => sum + row.balance, 0))}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground text-sm">
                          No deposits or prepayments recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="rent" id="rent" className="relative min-h-[600px] space-y-6">
              <RentTabInteractive
                leaseId={lease.id}
                currentCard={currentCard}
                upcomingCard={upcomingCard}
                rentLog={rentLogDisplay}
                rentCycleOptions={rentCycleOptions}
                rentStatusOptions={rentStatusOptions}
                leaseSummary={leaseSummaryInfo}
                defaults={rentFormDefaults}
              />
            </TabsContent>
            <TabsContent value="recurring" className="space-y-6">
              <RecurringTransactionsPanel
                leaseId={lease.id}
                rows={recurringRows}
                accounts={recurringAccountOptions}
                leaseSummary={{
                  propertyUnit: leaseSummaryInfo.propertyUnit,
                  tenants: recurringTenantLabel,
                }}
                tenants={recurringTenantOptions}
              />
            </TabsContent>
          </Tabs>
        </div>
      </TabsContent>

      <TabsContent value="tenants" className="space-y-6 px-6 pb-6">
        <div className="flex w-full max-w-4xl items-center justify-end md:w-[70%]">
          <AddTenantButton />
        </div>

        <div className="w-full max-w-4xl space-y-8 md:w-[70%]">
          {tenantsByRole.tenants.length ? (
            <section className="space-y-3">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide">TENANTS</h3>
              <div className="flex flex-col gap-4">
                {tenantsByRole.tenants.map((tenant) => (
                  <Card key={tenant.id} className="border-border/60 rounded-xl border shadow-sm">
                    <CardContent className="flex flex-col gap-5 px-6 py-5 sm:flex-row sm:items-start">
                      <div className="flex flex-1 items-start gap-5">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                            {tenant.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          {tenant.tenantId ? (
                            <Link
                              href={`/tenants/${tenant.tenantId}`}
                              className="text-foreground hover:text-primary text-base font-medium hover:underline"
                            >
                              {tenant.name}
                            </Link>
                          ) : (
                            <p className="text-foreground text-base font-medium">{tenant.name}</p>
                          )}
                          <div className="flex items-center gap-2">
                            {tenant.moveOutRaw ? (
                              <Badge
                                variant="secondary"
                                className="border-green-200 bg-green-50 text-green-700"
                              >
                                {new Date(tenant.moveOutRaw) < new Date()
                                  ? 'Moved out'
                                  : 'Moving out'}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 space-y-1">
                            <TenantMoveInEditor contactId={tenant.id} value={tenant.moveIn} />
                            {tenant.moveOut ? (
                              <div className="text-muted-foreground text-xs">
                                Move-out: {tenant.moveOut}
                              </div>
                            ) : null}
                            {tenant.notice ? (
                              <div className="text-muted-foreground text-xs">
                                Notice given: {tenant.notice}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground mt-4 flex flex-col gap-2 text-sm">
                            {tenant.phones.map((phone, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Phone className="text-muted-foreground h-3.5 w-3.5" />
                                <span className="text-foreground">{phone.number}</span>
                                {phone.action && (
                                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                                    <Link href={phone.action.href}>{phone.action.label}</Link>
                                  </Button>
                                )}
                              </div>
                            ))}
                            {tenant.email && (
                              <div className="text-foreground flex items-center gap-2">
                                <Mail className="text-muted-foreground h-3.5 w-3.5" />
                                <span>{tenant.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground gap-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {tenant.moveOut ? 'Undo move out' : 'Move out'}
                        </Button>
                        <RemoveLeaseContactButton
                          contactId={tenant.id}
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          confirmationMessage="Remove this tenant from the lease?"
                        >
                          <Trash2 className="h-4 w-4" />
                        </RemoveLeaseContactButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {tenantsByRole.cosigners.length ? (
            <section className="space-y-3">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide">
                COSIGNERS
              </h3>
              <div className="flex flex-col gap-4">
                {tenantsByRole.cosigners.map((tenant) => (
                  <Card key={tenant.id} className="border-border/60 rounded-xl border shadow-sm">
                    <CardContent className="flex flex-col gap-5 px-6 py-5 sm:flex-row sm:items-start">
                      <div className="flex flex-1 items-start gap-5">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                            {tenant.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          {tenant.tenantId ? (
                            <Link
                              href={`/tenants/${tenant.tenantId}`}
                              className="text-foreground hover:text-primary text-base font-medium hover:underline"
                            >
                              {tenant.name}
                            </Link>
                          ) : (
                            <p className="text-foreground text-base font-medium">{tenant.name}</p>
                          )}
                          <p className="text-muted-foreground text-xs">{tenant.roleLabel}</p>
                          <div className="text-muted-foreground mt-2 flex flex-col gap-1 text-sm">
                            {tenant.phones.map((phone, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Phone className="text-muted-foreground h-3.5 w-3.5" />
                                <span className="text-foreground">{phone.number}</span>
                              </div>
                            ))}
                            {tenant.email && (
                              <div className="text-foreground flex items-center gap-2">
                                <Mail className="text-muted-foreground h-3.5 w-3.5" />
                                <span>{tenant.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                        <RemoveLeaseContactButton
                          contactId={tenant.id}
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground gap-1"
                          confirmationMessage="Remove this cosigner from the lease?"
                        >
                          Remove
                          <Trash2 className="h-3.5 w-3.5" />
                        </RemoveLeaseContactButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {!tenantsByRole.tenants.length && !tenantsByRole.cosigners.length ? (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-sm">
                No tenants or cosigners on this lease yet.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="communications" className="space-y-6 px-6 pb-6">
        <Card>
          <CardContent className="text-muted-foreground py-8 text-sm">
            Communications timeline coming soon.
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tasks" className="space-y-6 px-6 pb-6">
        <Card>
          <CardContent className="text-muted-foreground py-8 text-sm">
            Tasks for this lease will appear here.
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="files" className="space-y-6 px-6 pb-6">
        <LeaseFilesTable
          leaseId={lease.id}
          isBuildiumLinked={Boolean(lease.buildium_lease_id)}
          initialFiles={initialFileBundle}
          categories={fileCategories as LeaseFileCategory[]}
        />
      </TabsContent>
    </Tabs>
  );
}

function _PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="border-border/70 bg-muted/10 text-muted-foreground rounded-lg border border-dashed px-6 py-20 text-center text-sm">
      {label} coming soon.
    </div>
  );
}
