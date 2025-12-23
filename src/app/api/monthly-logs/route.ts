import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/db';

type CreatePayload = {
  propertyId?: string;
  unitId?: string;
  periodStart?: string;
};

function normalizePeriodStart(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const paddedMonth = month.toString().padStart(2, '0');
  return `${year}-${paddedMonth}-01`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreatePayload;
    const propertyId = (payload.propertyId || '').trim();
    const unitId = (payload.unitId || '').trim();
    const normalizedStart = normalizePeriodStart(payload.periodStart);

    if (!propertyId || !unitId || !normalizedStart) {
      return NextResponse.json(
        { success: false, error: 'Property, unit, and start date are required.' },
        { status: 400 },
      );
    }

    const propertyRes = await supabaseAdmin
      .from('properties')
      .select('id, org_id, status, is_active')
      .eq('id', propertyId)
      .maybeSingle();

    if (propertyRes.error) {
      console.error('Failed to load property for monthly log creation', propertyRes.error);
      return NextResponse.json(
        { success: false, error: 'Unable to load property details.' },
        { status: 500 },
      );
    }

    const property = propertyRes.data as
      | { id: string; org_id: string | null; status?: string | null; is_active?: boolean | null }
      | null;

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Property not found.' },
        { status: 404 },
      );
    }

    if (property.status && property.status !== 'Active') {
      return NextResponse.json(
        { success: false, error: 'Only active properties can create monthly logs.' },
        { status: 400 },
      );
    }

    if (property.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'This property is inactive.' },
        { status: 400 },
      );
    }

    const unitRes = await supabaseAdmin
      .from('units')
      .select('id, property_id, status, is_active')
      .eq('id', unitId)
      .maybeSingle();

    if (unitRes.error) {
      console.error('Failed to load unit for monthly log creation', unitRes.error);
      return NextResponse.json(
        { success: false, error: 'Unable to load unit details.' },
        { status: 500 },
      );
    }

    const unit = unitRes.data as
      | {
          id: string;
          property_id: string;
          status?: string | null;
          is_active?: boolean | null;
        }
      | null;

    if (!unit || unit.property_id !== propertyId) {
      return NextResponse.json(
        { success: false, error: 'Unit does not belong to the selected property.' },
        { status: 400 },
      );
    }

    if (unit.status === 'Inactive' || unit.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'Select an active unit to create a monthly log.' },
        { status: 400 },
      );
    }

    const existingRes = await supabaseAdmin
      .from('monthly_logs')
      .select('id')
      .eq('property_id', propertyId)
      .eq('unit_id', unitId)
      .eq('period_start', normalizedStart)
      .maybeSingle();

    if (existingRes.data) {
      return NextResponse.json(
        { success: false, error: 'A monthly log already exists for that month.' },
        { status: 409 },
      );
    }

    if (existingRes.error && existingRes.error.code !== 'PGRST116') {
      console.error('Failed to check for existing monthly log', existingRes.error);
      return NextResponse.json(
        { success: false, error: 'Unable to verify existing logs.' },
        { status: 500 },
      );
    }

    if (!property.org_id) {
      return NextResponse.json(
        { success: false, error: 'Property is missing an organization assignment.' },
        { status: 400 },
      );
    }

    const insertRes = await supabaseAdmin
      .from('monthly_logs')
      .insert({
        org_id: property.org_id,
        property_id: propertyId,
        unit_id: unitId,
        period_start: normalizedStart,
      })
      .select('id')
      .maybeSingle();

    if (insertRes.error) {
      console.error('Failed to create monthly log', insertRes.error);
      return NextResponse.json(
        { success: false, error: 'Failed to create monthly log.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, id: insertRes.data?.id }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating monthly log', error);
    return NextResponse.json({ success: false, error: 'Unexpected error.' }, { status: 500 });
  }
}
