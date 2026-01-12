import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-client';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';

type ResidentOption = {
  value: string;
  label: string;
};

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { supabase: db, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });
    const dbScoped = getServerSupabaseClient('list active tenants');

    const { data, error } = await dbScoped
      .from('lease_contacts')
      .select(
        `
          tenant_id,
          tenants (
            id,
            contact:contacts (
              display_name,
              first_name,
              last_name,
              company_name
            )
          )
        `,
      )
      .is('move_out_date', null)
      .not('tenant_id', 'is', null)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Failed to load active tenants', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load active tenants.' },
        { status: 500 },
      );
    }

    const optionsMap = new Map<string, ResidentOption>();
    for (const row of data ?? []) {
      const tenantId = row?.tenant_id;
      if (!tenantId || optionsMap.has(tenantId)) continue;
      const contact = (row as any)?.tenants?.contact;
      const name: string =
        (contact?.display_name as string | undefined) ||
        [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
        (contact?.company_name as string | undefined) ||
        'Resident';
      optionsMap.set(tenantId, {
        value: tenantId,
        label: name,
      });
    }

    const options = Array.from(optionsMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );

    return NextResponse.json({ success: true, data: options });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ success: false, error: 'Organization context required.' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
      }
    }
    console.error('Unexpected error loading active tenants', error);
    return NextResponse.json(
      { success: false, error: 'Unexpected error loading active tenants.' },
      { status: 500 },
    );
  }
}
