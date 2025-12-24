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

const toId = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? value.toString() : '';

const stringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
};

function mapProperty(record: Record<string, unknown>): EntityItem {
  const id = toId(record.id);
  const name = stringOrNull(record.name);
  const address = stringOrNull(record.address_line1);
  const city = stringOrNull(record.city);
  const state = stringOrNull(record.state);
  const cityState = [city, state].filter(Boolean).join(', ');

  return {
    id,
    label: name ?? address ?? `Property ${id}`,
    description: address && cityState ? `${address} • ${cityState}` : address ?? cityState ?? null,
  };
}

function mapUnit(record: Record<string, unknown>): EntityItem {
  const id = toId(record.id);
  const unitNumber = stringOrNull(record.unit_number);
  const status = stringOrNull(record.status);

  return {
    id,
    label: unitNumber ? `Unit ${unitNumber}` : `Unit ${id}`,
    description: status ?? null,
  };
}

function mapLease(record: Record<string, unknown>): EntityItem {
  const id = toId(record.id);
  const unitNumber = stringOrNull(record.unit_number);
  const status = stringOrNull(record.status);

  return {
    id,
    label: unitNumber ? `Lease ${unitNumber}` : `Lease ${id}`,
    description: status ?? null,
  };
}

function mapTenant(record: Record<string, unknown>): EntityItem {
  const id = toId(record.id);
  const fullName = stringOrNull(record.full_name);
  const composedName = [stringOrNull(record.first_name), stringOrNull(record.last_name)]
    .filter(Boolean)
    .join(' ')
    .trim();
  const email = stringOrNull(record.email);

  return {
    id,
    label: fullName ?? composedName ?? email ?? `Tenant ${id}`,
    description: email ?? null,
  };
}

function mapOwner(record: Record<string, unknown>): EntityItem {
  const id = toId(record.id);
  const contactsRaw = Array.isArray(record.contacts)
    ? record.contacts
    : record.contacts
      ? [record.contacts]
      : [];
  const contact = contactsRaw.find(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === 'object',
  );

  const companyName = stringOrNull(contact?.company_name);
  const personName = [stringOrNull(contact?.first_name), stringOrNull(contact?.last_name)]
    .filter(Boolean)
    .join(' ')
    .trim();
  const email = stringOrNull(contact?.primary_email);

  return {
    id,
    label: companyName ?? personName ?? email ?? `Owner ${id}`,
    description: email ?? companyName ?? null,
  };
}

function mapVendor(record: Record<string, unknown>): EntityItem {
  const id = toId(record.id);
  const companyName = stringOrNull(record.company_name);
  const vendorName = stringOrNull(record.name);
  const email = stringOrNull(record.email);

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
  const propertyId = url.searchParams.get('propertyId')?.trim() || null;

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
        .select('id, name, address_line1, city, state, status')
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
        .select('id, unit_number, status')
        .eq('property_id', propertyId as string)
        .order('unit_number', { ascending: true, nullsFirst: false });
      if (search) {
        query = query.ilike('unit_number', `%${search}%`);
      }
      break;
    }
    case 'lease': {
      query = db
        .from('lease')
        .select('id, unit_number, status')
        .order('created_at', { ascending: false });
      if (search) {
        query = query.or(
          `status.ilike.%${search}%,unit_number.ilike.%${search}%`,
        );
      }
      break;
    }
    case 'tenant': {
      query = db
        .from('tenants')
        .select('id, full_name, first_name, last_name, email')
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
        `)
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
        .select('id, name, company_name, email')
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

    const records = (Array.isArray(data) ? data : []).map(
      (record) => record as Record<string, unknown>,
    );
    const hasMore = records.length > limit;
    const trimmed = hasMore ? records.slice(0, limit) : records;

    const items: EntityItem[] = trimmed.map((record) => {
      const fallbackId =
        typeof record.id === 'string' || typeof record.id === 'number'
          ? record.id.toString()
          : '';
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
          return { id: fallbackId, label: fallbackId || 'Unknown record' };
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
