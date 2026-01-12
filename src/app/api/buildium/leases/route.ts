import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client';
import { requireRole } from '@/lib/auth/guards';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest) {
  try {
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    // Use org-scoped client
    const client = await getOrgScopedBuildiumEdgeClient(orgId);

    const { searchParams } = new URL(request.url);
    const params: {
      propertyids?: number[];
      unitids?: number[];
      lastupdatedfrom?: string;
      lastupdatedto?: string;
      orderby?: string;
      offset?: number;
      limit?: number;
    } = {};
    // Map common Buildium list params
    if (searchParams.get('propertyids'))
      params.propertyids = searchParams
        .get('propertyids')!
        .split(',')
        .map((n) => Number(n.trim()))
        .filter(Boolean);
    if (searchParams.get('unitids'))
      params.unitids = searchParams
        .get('unitids')!
        .split(',')
        .map((n) => Number(n.trim()))
        .filter(Boolean);
    if (searchParams.get('lastupdatedfrom')) params.lastupdatedfrom = searchParams.get('lastupdatedfrom')!;
    if (searchParams.get('lastupdatedto')) params.lastupdatedto = searchParams.get('lastupdatedto')!;
    if (searchParams.get('orderby')) params.orderby = searchParams.get('orderby')!;
    if (searchParams.get('offset')) params.offset = Number(searchParams.get('offset'));
    if (searchParams.get('limit')) params.limit = Number(searchParams.get('limit'));

    const res = await client.listLeasesFromBuildium(params);
    if (!res.success)
      return NextResponse.json({ error: res.error || 'Failed to list leases' }, { status: 500 });
    return NextResponse.json(res.data ?? []);
  } catch (e) {
    logger.error({ error: e }, 'Error listing Buildium leases');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    // Use org-scoped client
    const client = await getOrgScopedBuildiumEdgeClient(orgId);

    const body: unknown = await request.json().catch(() => ({}));
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const res = await client.createLeaseInBuildium(payload);
    if (!res.success)
      return NextResponse.json({ error: res.error || 'Failed to create lease in Buildium' }, { status: 400 });
    return NextResponse.json(res.data, { status: 201 });
  } catch (e) {
    logger.error({ error: e }, 'Error creating Buildium lease');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
