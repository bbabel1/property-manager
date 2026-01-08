import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';

export async function GET(
  request: Request,
  context: { params: Promise<{ payerId: string }> },
) {
  const { payerId } = await context.params;
  if (!payerId) {
    return NextResponse.json({ error: 'Missing payerId' }, { status: 400 });
  }

  try {
    const auth = await requireAuth();

    const url = new URL(request.url);
    const orgIdParam = url.searchParams.get('orgId');
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', auth.user.id);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    let orgIds = (memberships ?? []).map((m) => m.org_id).filter(Boolean);
    if (orgIdParam) {
      // Narrow to a specific org if the user is a member; otherwise return empty
      if (!orgIds.includes(orgIdParam)) {
        return NextResponse.json({ data: [] });
      }
      orgIds = [orgIdParam];
    }
    if (!orgIds.length) {
      return NextResponse.json({ data: [] });
    }

    const nowIso = new Date().toISOString();
    const { data: restrictions, error } = await supabaseAdmin
      .from('payer_restrictions')
      .select('id, restriction_type, restricted_until, reason, org_id, payer_id, payer_type')
      .eq('payer_id', payerId)
      .in('org_id', orgIds)
      .or(`restricted_until.is.null,restricted_until.gt.${nowIso}`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const restrictionIds = (restrictions ?? []).map((r) => r.id);
    let methodsByRestriction = new Map<string, string[]>();
    if (restrictionIds.length) {
      const { data: methods, error: methodsError } = await supabaseAdmin
        .from('payer_restriction_methods')
        .select('payer_restriction_id, payment_method')
        .in('payer_restriction_id', restrictionIds);
      if (methodsError) {
        return NextResponse.json({ error: methodsError.message }, { status: 500 });
      }
      methodsByRestriction = new Map<string, string[]>();
      for (const row of methods ?? []) {
        const list = methodsByRestriction.get(row.payer_restriction_id) ?? [];
        list.push(row.payment_method);
        methodsByRestriction.set(row.payer_restriction_id, list);
      }
    }

    const data =
      restrictions?.map((r) => ({
        ...r,
        methods: methodsByRestriction.get(r.id) ?? [],
      })) ?? [];

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching payer restrictions', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
