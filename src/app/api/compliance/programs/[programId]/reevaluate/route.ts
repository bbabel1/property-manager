import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import { programTargetsAsset, programTargetsProperty } from '@/lib/compliance-programs';
import type { ComplianceProgram } from '@/types/compliance';

const parseUnits = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const dwellingUnitsFromBuilding = (building: any): number | null => {
  if (!building) return null;
  if (typeof building.residential_units === 'number') return building.residential_units;
  return null;
};

const parseDueDateOverride = (value: unknown): { month: number; day: number } | null => {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split('-');
  if (parts.length < 3) return null;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { month, day };
};

const applyOverrideDueDate = (
  period: { period_start: string; period_end: string; due_date: string },
  override: { month: number; day: number } | null,
) => {
  if (!override) return period.due_date;
  const start = new Date(`${period.period_start}T00:00:00Z`);
  const end = new Date(`${period.period_end}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return period.due_date;

  const { month, day } = override;
  let candidate = new Date(Date.UTC(end.getUTCFullYear(), month - 1, day));
  if (candidate < start) {
    candidate = new Date(Date.UTC(end.getUTCFullYear() + 1, month - 1, day));
  }
  if (candidate > end) {
    candidate = end;
  }
  return candidate.toISOString().split('T')[0];
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> },
) {
  try {
    const rate = await checkRateLimit(request);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { programId } = await params;
    const body = (await request.json().catch(() => ({}))) as { apply?: boolean };
    const applyChanges = Boolean(body.apply);

    const admin = supabaseAdmin as any;

    const { data: membership, error: membershipError } = await admin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const orgId = membership.org_id;

    const { data: program, error: programError } = await admin
      .from('compliance_programs')
      .select('*')
      .eq('id', programId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const overrideDueDate =
      parseDueDateOverride((program as any)?.override_fields?.due_date_value) ||
      parseDueDateOverride((program as any)?.override_fields?.due_date);

    // Fetch items for this program
    const { data: items, error: itemsError } = await admin
      .from('compliance_items')
      .select('id, property_id, asset_id, status, notes, due_date, period_start, period_end')
      .eq('program_id', programId)
      .eq('org_id', orgId);

    if (itemsError) {
      logger.error(
        { error: itemsError, programId, orgId },
        'Failed to fetch items for re-evaluate',
      );
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    // Load properties and assets for matching
    const [propertiesRes, assetsRes] = await Promise.all([
      admin.from('properties').select('id, borough, bin, building_id, total_units').eq('org_id', orgId),
      admin
        .from('compliance_assets')
        .select('id, property_id, asset_type, external_source, active, metadata')
        .eq('org_id', orgId),
    ]);

    if (propertiesRes.error) {
      logger.error(
        { error: propertiesRes.error, orgId },
        'Failed to fetch properties for re-evaluate',
      );
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }
    if (assetsRes.error) {
      logger.error({ error: assetsRes.error, orgId }, 'Failed to fetch assets for re-evaluate');
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }

    const propertyRows = Array.isArray(propertiesRes.data) ? (propertiesRes.data as any[]) : [];
    const assetRows = Array.isArray(assetsRes.data) ? (assetsRes.data as any[]) : [];

    const buildingIds = Array.from(
      new Set(
        propertyRows
          .map((p: any) => (p as any).building_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let buildingMap = new Map<string, any>();
    if (buildingIds.length > 0) {
      const { data: buildingRows, error: buildingError } = await admin
        .from('buildings')
        .select('id, residential_units')
        .in('id', buildingIds);
      if (buildingError) {
        logger.warn(
          { error: buildingError, orgId, programId },
          'Failed to fetch building metadata for re-evaluate',
        );
      } else {
        buildingMap = new Map(
          (buildingRows || []).map((b: { id: string; residential_units: number | null }) => [
            b.id as string,
            {
              ...b,
              residential_units: dwellingUnitsFromBuilding(b),
            },
          ]),
        );
      }
    }

    const propertyMap = new Map(
      propertyRows.map((p: any) => {
        const building = (p as any).building_id ? buildingMap.get((p as any).building_id) : null;
        const dwellingUnits =
          dwellingUnitsFromBuilding(building) ?? parseUnits((p as any).total_units) ?? null;
        return [
          p.id,
          {
            ...p,
            residential_units: dwellingUnits,
            property_total_units: (p as any).total_units as number | null,
          },
        ];
      }),
    );
    const assetMap = new Map(assetRows.map((a: any) => [a.id, a]));

    let nonMatching = 0;
    let closed = 0;
    let dueDateUpdates = 0;
    const nonMatchingIds: string[] = [];
    const dueDateUpdatesPayload: Array<{ id: string; due_date: string }> = [];

    const itemList = Array.isArray(items) ? items : [];
    for (const item of itemList as any[]) {
      const property = propertyMap.get(item.property_id) || null;
      const asset = item.asset_id ? assetMap.get(item.asset_id) || null : null;
      const matches = item.asset_id
        ? programTargetsAsset(program as ComplianceProgram, asset as any, property as any)
        : programTargetsProperty(program as ComplianceProgram, property as any);

      if (!matches) {
        nonMatching++;
        nonMatchingIds.push(item.id);
        continue;
      }

      if (applyChanges && overrideDueDate) {
        const nextDue = applyOverrideDueDate(
          {
            period_start: item.period_start,
            period_end: item.period_end,
            due_date: item.due_date,
          },
          overrideDueDate,
        );
        if (nextDue && nextDue !== item.due_date) {
          dueDateUpdatesPayload.push({ id: item.id, due_date: nextDue });
        }
      }
    }

    if (applyChanges && nonMatchingIds.length > 0) {
      const closureNote = 'Auto-closed due to criteria mismatch';
      const { error: updateError } = await admin
        .from('compliance_items')
        .update({ status: 'closed', next_action: closureNote })
        .in('id', nonMatchingIds)
        .eq('org_id', orgId);

      if (updateError) {
        logger.error(
          { error: updateError, programId, orgId },
          'Failed to close non-matching items',
        );
        return NextResponse.json({ error: 'Failed to close non-matching items' }, { status: 500 });
      }

      closed = nonMatchingIds.length;
    }

    if (applyChanges && dueDateUpdatesPayload.length > 0) {
      for (const update of dueDateUpdatesPayload) {
        const { error: updateError } = await supabaseAdmin
          .from('compliance_items')
          .update({ due_date: update.due_date })
          .eq('id', update.id)
          .eq('org_id', orgId);
        if (updateError) {
          logger.error(
            { error: updateError, programId, orgId, itemId: update.id },
            'Failed to update due date during re-evaluate',
          );
          return NextResponse.json({ error: 'Failed to update item due dates' }, { status: 500 });
        }
        dueDateUpdates++;
      }
    }

    return NextResponse.json({
      program_id: programId,
      non_matching: nonMatching,
      closed,
      total_items: items?.length || 0,
      applied: applyChanges,
      due_dates_updated: dueDateUpdates,
    });
  } catch (error) {
    logger.error({ error }, 'Error in program re-evaluate API');
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
