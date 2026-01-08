import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/database';

type PayerRestrictionRow = Database['public']['Tables']['payer_restrictions']['Row'];
type PayerRestrictionInsert = Database['public']['Tables']['payer_restrictions']['Insert'];
type PayerRestrictionMethodRow = Database['public']['Tables']['payer_restriction_methods']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method_enum'];

type ApplyRestrictionParams = {
  orgId: string;
  payerId: string;
  payerType?: string | null;
  restrictionType: string;
  paymentMethods: PaymentMethod[];
  durationDays?: number | null;
  reason?: string | null;
  sourceEventId?: string | null;
};

export class PayerRestrictionsService {
  static async applyRestriction(params: ApplyRestrictionParams): Promise<PayerRestrictionRow | null> {
    const now = new Date();
    const restrictedUntil =
      params.durationDays && params.durationDays > 0
        ? new Date(now.getTime() + params.durationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const insertPayload: PayerRestrictionInsert = {
      org_id: params.orgId,
      payer_id: params.payerId,
      payer_type: params.payerType ?? null,
      restriction_type: params.restrictionType,
      restricted_until: restrictedUntil,
      reason: params.reason ?? null,
      source_event_id: params.sourceEventId ?? null,
      metadata: {},
    };

    const { data: restriction, error } = await supabaseAdmin
      .from('payer_restrictions')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      logger.error({ error, params }, 'Failed to apply payer restriction');
      throw error;
    }

    if (!restriction?.id) return restriction as PayerRestrictionRow | null;

    const methodsPayload = params.paymentMethods.map((method) => ({
      org_id: params.orgId,
      payer_restriction_id: restriction.id,
      payment_method: method,
    }));

    const { error: methodsError } = await supabaseAdmin
      .from('payer_restriction_methods')
      .insert(methodsPayload);

    if (methodsError) {
      logger.error({ error: methodsError, restrictionId: restriction.id }, 'Failed to insert restriction methods');
      throw methodsError;
    }

    return restriction as PayerRestrictionRow;
  }

  static async checkRestriction(
    orgId: string,
    payerId: string,
    paymentMethod: PaymentMethod,
  ): Promise<boolean> {
    const nowIso = new Date().toISOString();
    const { data: restrictions, error } = await supabaseAdmin
      .from('payer_restrictions')
      .select('id, restricted_until')
      .eq('org_id', orgId)
      .eq('payer_id', payerId)
      .or(`restricted_until.is.null,restricted_until.gt.${nowIso}`);

    if (error) {
      logger.error({ error, orgId, payerId, paymentMethod }, 'Failed to check payer restriction');
      throw error;
    }

    const restrictionIds = (restrictions ?? []).map((r) => r.id);
    if (!restrictionIds.length) return false;

    const { data: methods, error: methodsError } = await supabaseAdmin
      .from('payer_restriction_methods')
      .select('id')
      .eq('org_id', orgId)
      .in('payer_restriction_id', restrictionIds)
      .eq('payment_method', paymentMethod);

    if (methodsError) {
      logger.error({ error: methodsError, orgId, payerId, paymentMethod }, 'Failed to check restriction methods');
      throw methodsError;
    }

    return Boolean(methods && methods.length > 0);
  }

  static async clearRestriction(orgId: string, restrictionId: string): Promise<void> {
    const { error: methodsError } = await supabaseAdmin
      .from('payer_restriction_methods')
      .delete()
      .eq('org_id', orgId)
      .eq('payer_restriction_id', restrictionId);

    if (methodsError) {
      logger.error({ methodsError, restrictionId }, 'Failed to delete restriction methods');
      throw methodsError;
    }

    const { error } = await supabaseAdmin
      .from('payer_restrictions')
      .delete()
      .eq('org_id', orgId)
      .eq('id', restrictionId);

    if (error) {
      logger.error({ error, restrictionId }, 'Failed to clear payer restriction');
      throw error;
    }
  }

  static async getActiveRestrictions(
    orgId: string,
    payerId: string,
  ): Promise<Array<PayerRestrictionRow & { methods: PaymentMethod[] }>> {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('payer_restrictions')
      .select('id, restriction_type, restricted_until, reason, org_id, payer_id, payer_type, metadata, source_event_id, created_at, updated_at')
      .eq('org_id', orgId)
      .eq('payer_id', payerId)
      .or('restricted_until.is.null,restricted_until.gt.' + nowIso);

    if (error) {
      logger.error({ error, orgId, payerId }, 'Failed to fetch active restrictions');
      throw error;
    }

    const restrictions = (data as PayerRestrictionRow[]) ?? [];
    const restrictionIds = restrictions.map((r) => r.id);
    if (!restrictionIds.length) return [];

    const { data: methodsData, error: methodsError } = await supabaseAdmin
      .from('payer_restriction_methods')
      .select('payer_restriction_id, payment_method')
      .in('payer_restriction_id', restrictionIds);

    if (methodsError) {
      logger.error({ error: methodsError, orgId, payerId }, 'Failed to fetch restriction methods');
      throw methodsError;
    }

    const methodsByRestriction = new Map<string, PaymentMethod[]>();
    for (const row of methodsData as PayerRestrictionMethodRow[]) {
      const list = methodsByRestriction.get(row.payer_restriction_id) ?? [];
      list.push(row.payment_method);
      methodsByRestriction.set(row.payer_restriction_id, list);
    }

    return restrictions.map((r) => ({
      ...r,
      methods: methodsByRestriction.get(r.id) ?? [],
    }));
  }
}

export default PayerRestrictionsService;
