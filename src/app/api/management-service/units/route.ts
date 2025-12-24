import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/auth/roles';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import {
  listUnitManagementServiceConfigs,
  ManagementServiceError,
} from '@/lib/management-service';

function canRead(roles: AppRole[]) {
  return (
    hasPermission(roles, 'settings.read') ||
    hasPermission(roles, 'settings.write') ||
    hasPermission(roles, 'properties.read')
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { roles } = auth;

    if (!canRead(roles)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const propertyId =
      typeof body.propertyId === 'string'
        ? body.propertyId
        : typeof body.property_id === 'string'
          ? (body.property_id as string)
          : null;

    if (!propertyId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'propertyId is required' } },
        { status: 400 },
      );
    }

    const data = await listUnitManagementServiceConfigs(propertyId);
    return NextResponse.json({ success: true, data });
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

    logger.error({ error }, 'Error in POST /api/management-service/units');
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
