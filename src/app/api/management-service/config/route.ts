import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/auth/roles';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import {
  fetchManagementServiceConfig,
  ManagementServiceError,
  upsertManagementServiceConfig,
} from '@/lib/management-service';

function canRead(roles: AppRole[]) {
  return (
    hasPermission(roles, 'settings.read') ||
    hasPermission(roles, 'settings.write') ||
    hasPermission(roles, 'properties.read')
  );
}

function canWrite(roles: AppRole[]) {
  return (
    hasPermission(roles, 'settings.write') || hasPermission(roles, 'properties.write')
  );
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => (typeof v === 'string' ? v : v != null ? String(v) : ''))
    .filter((v) => v.trim().length > 0);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { roles } = auth;

    if (!canRead(roles)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');

    if (!propertyId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'propertyId is required' } },
        { status: 400 },
      );
    }

    const config = await fetchManagementServiceConfig({
      propertyId,
      unitId: unitId || undefined,
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    if (error instanceof ManagementServiceError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.status },
      );
    }

    logger.error({ error }, 'Error in GET /api/management-service/config');
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

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { roles } = auth;

    if (!canWrite(roles)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');

    if (!propertyId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'propertyId is required' } },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const servicePlan =
      toOptionalString(body.service_plan) ?? toOptionalString(body['servicePlan']) ?? '';

    const activeServicesRaw =
      (Array.isArray(body.active_services) && body.active_services.length ? body.active_services : null) ??
      (Array.isArray(body['activeServices']) ? body['activeServices'] : []);

    const activeServices = normalizeStringList(activeServicesRaw);

    const planFeeAmount =
      body.plan_fee_amount === null || body.plan_fee_amount === undefined
        ? null
        : Number(body.plan_fee_amount);
    const planFeePercent =
      body.plan_fee_percent === null || body.plan_fee_percent === undefined
        ? null
        : Number(body.plan_fee_percent);
    const planFeeFrequency =
      typeof body.plan_fee_frequency === 'string' && body.plan_fee_frequency.trim()
        ? body.plan_fee_frequency
        : undefined;

    const billAdministrationCandidate =
      body.bill_administration ?? (body['billAdministration'] as unknown);
    const billAdministration =
      billAdministrationCandidate === null || typeof billAdministrationCandidate === 'string'
        ? billAdministrationCandidate
        : undefined;

    if (!servicePlan.trim()) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'service_plan is required in the body' } },
        { status: 400 },
      );
    }

    const updated = await upsertManagementServiceConfig({
      propertyId,
      unitId: unitId || undefined,
      servicePlan,
      activeServices,
      billAdministration,
      planFeeAmount: Number.isFinite(planFeeAmount) ? planFeeAmount : null,
      planFeePercent: Number.isFinite(planFeePercent) ? planFeePercent : null,
      planFeeFrequency: planFeeFrequency ?? null,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof ManagementServiceError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.status },
      );
    }

    logger.error({ error }, 'Error in PUT /api/management-service/config');
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
