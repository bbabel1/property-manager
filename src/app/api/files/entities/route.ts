import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabaseAdminMaybe, supabase } from '@/lib/db';

type EntityType =
  | 'property'
  | 'unit'
  | 'lease'
  | 'tenant'
  | 'owner'
  | 'vendor';

type EntityItem = {
  id: string;
  label: string;
  description?: string | null;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 1;
  return parsed;
}

function mapProperty(record: any): EntityItem {
  const id = record?.id?.toString?.() ?? String(record?.id ?? '');
  const name = typeof record?.name === 'string' && record.name.trim().length
    ? record.name.trim()
    : null;
  const address = typeof record?.address_line1 === 'string' && record.address_line1.trim().length
    ? record.address_line1.trim()
    : null;
  const cityState = [record?.city, record?.state].filter(Boolean).join(', ');

  return {
    id,
    label: name ?? address ?? `Property ${id}`,
    description: address && cityState ? `${address} • ${cityState}` : address ?? cityState ?? null,
  };
}

function mapUnit(record: any): EntityItem {
  const id = record?.id?.toString?.() ?? String(record?.id ?? '');
  const unitNumber =
    typeof record?.unit_number === 'string' && record.unit_number.trim().length
      ? record.unit_number.trim()
      : null;
  const status =
    typeof record?.status === 'string' && record.status.trim().length
      ? record.status.trim()
      : null;

  return {
    id,
    label: unitNumber ? `Unit ${unitNumber}` : `Unit ${id}`,
    description: status ?? null,
  };
}

function mapLease(record: any): EntityItem {
  const id = record?.id?.toString?.() ?? String(record?.id ?? '');
  const leaseName =
    typeof record?.name === 'string' && record.name.trim().length
      ? record.name.trim()
      : null;
  const tenantName =
    typeof record?.tenant_name === 'string' && record.tenant_name.trim().length
      ? record.tenant_name.trim()
      : null;
  const status =
    typeof record?.status === 'string' && record.status.trim().length
      ? record.status.trim()
      : null;

  return {
    id,
    label: leaseName ?? tenantName ?? `Lease ${id}`,
    description: status ?? tenantName ?? null,
  };
}

function mapTenant(record: any): EntityItem {
  const id = record?.id?.toString?.() ?? String(record?.id ?? '');
  const fullName =
    typeof record?.full_name === 'string' && record.full_name.trim().length
      ? record.full_name.trim()
      : null;
  const composedName = [record?.first_name, record?.last_name]
    .filter((part) => typeof part === 'string' && part.trim().length)
    .join(' ')
    .trim();
  const email =
    typeof record?.email === 'string' && record.email.trim().length
      ? record.email.trim()
      : null;

  return {
    id,
    label: fullName ?? composedName ?? email ?? `Tenant ${id}`,
    description: email ?? null,
  };
}

function mapOwner(record: any): EntityItem {
  const id = record?.id?.toString?.() ?? String(record?.id ?? '');
  const contacts = Array.isArray(record?.contacts) ? record.contacts : [record?.contacts];
  const contact = contacts.find(Boolean) ?? {};

  const companyName =
    typeof contact?.company_name === 'string' && contact.company_name.trim().length
      ? contact.company_name.trim()
      : null;
  const personName = [contact?.first_name, contact?.last_name]
    .filter((part) => typeof part === 'string' && part.trim().length)
    .join(' ')
    .trim();
  const email =
    typeof contact?.primary_email === 'string' && contact.primary_email.trim().length
      ? contact.primary_email.trim()
      : null;

  return {
    id,
    label: companyName ?? personName ?? email ?? `Owner ${id}`,
    description: email ?? companyName ?? null,
  };
}

function mapVendor(record: any): EntityItem {
  const id = record?.id?.toString?.() ?? String(record?.id ?? '');
  const companyName =
    typeof record?.company_name === 'string' && record.company_name.trim().length
      ? record.company_name.trim()
      : null;
  const vendorName =
    typeof record?.name === 'string' && record.name.trim().length
      ? record.name.trim()
      : null;
  const email =
    typeof record?.email === 'string' && record.email.trim().length
      ? record.email.trim()
      : null;

  return {
    id,
    label: companyName ?? vendorName ?? `Vendor ${id}`,
    description: email ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get('type') as EntityType | null;
  if (!typeParam) {
    return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
  }

  const limit = parseLimit(url.searchParams.get('limit'));
  const page = parsePage(url.searchParams.get('page'));
  const search = url.searchParams.get('search')?.trim() ?? '';
  const propertyId = url.searchParams.get('propertyId')?.trim() ?? null;

  if (typeParam === 'unit' && !propertyId) {
    return NextResponse.json({ error: 'propertyId is required for unit lookups' }, { status: 400 });
  }

  const db = supabaseAdminMaybe ?? supabase;
  const from = (page - 1) * limit;
  const to = from + limit; // inclusive; fetch one extra record to detect hasMore

  let query = null;

  switch (typeParam) {
    case 'property': {
      query = db
        .from('properties')
        .select('id, name, address_line1, city, state, status', { count: 'none' })
        .order('created_at', { ascending: false });
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,address_line1.ilike.%${search}%,city.ilike.%${search}%`,
        );
      }
      break;
    }
    case 'unit': {
      query = db
        .from('units')
        .select('id, unit_number, status', { count: 'none' })
        .eq('property_id', propertyId)
        .order('unit_number', { ascending: true, nullsFirst: false });
      if (search) {
        query = query.ilike('unit_number', `%${search}%`);
      }
      break;
    }
    case 'lease': {
      query = db
        .from('lease')
        .select('id, name, tenant_name, status', { count: 'none' })
        .order('created_at', { ascending: false });
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,tenant_name.ilike.%${search}%`,
        );
      }
      break;
    }
    case 'tenant': {
      query = db
        .from('tenants')
        .select('id, full_name, first_name, last_name, email', { count: 'none' })
        .order('full_name', { ascending: true });
      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
        );
      }
      break;
    }
    case 'owner': {
      query = db
        .from('owners')
        .select(
          `
          id,
          contacts(
            first_name,
            last_name,
            company_name,
            primary_email
          )
        `,
          { count: 'none' },
        )
        .order('created_at', { ascending: false });
      if (search) {
        query = query.or(
          `contacts.first_name.ilike.%${search}%,contacts.last_name.ilike.%${search}%,contacts.company_name.ilike.%${search}%,contacts.primary_email.ilike.%${search}%`,
        );
      }
      break;
    }
    case 'vendor': {
      query = db
        .from('vendors')
        .select('id, name, company_name, email', { count: 'none' })
        .order('created_at', { ascending: false });
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`,
        );
      }
      break;
    }
    default: {
      return NextResponse.json({ error: `Unsupported type: ${typeParam}` }, { status: 400 });
    }
  }

  try {
    const { data, error } = await query!.range(from, to);
    if (error) {
      console.error('Entity picker query failed:', {
        type: typeParam,
        error,
      });
      return NextResponse.json(
        { error: 'Failed to load entities', details: error.message },
        { status: 500 },
      );
    }

    const records = Array.isArray(data) ? data : [];
    const hasMore = records.length > limit;
    const trimmed = hasMore ? records.slice(0, limit) : records;

    const items: EntityItem[] = trimmed.map((record) => {
      switch (typeParam) {
        case 'property':
          return mapProperty(record);
        case 'unit':
          return mapUnit(record);
        case 'lease':
          return mapLease(record);
        case 'tenant':
          return mapTenant(record);
        case 'owner':
          return mapOwner(record);
        case 'vendor':
          return mapVendor(record);
        default:
          return { id: String(record?.id ?? ''), label: String(record?.id ?? '') };
      }
    });

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Unexpected entity picker error:', error);
    return NextResponse.json({ error: 'Failed to load entities' }, { status: 500 });
  }
}
