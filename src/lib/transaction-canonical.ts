import {
  derivePaidBy,
  derivePaidTo,
  type PaidByCandidate,
  type PaidToCandidate,
} from './transaction-parties';

type LabelContext = { propertyName?: string | null; unitLabel?: string | null };

export type CanonicalPartiesResult = {
  paidBy: {
    paid_by_accounting_entity_id: number | null;
    paid_by_accounting_entity_type: string | null;
    paid_by_accounting_entity_href: string | null;
    paid_by_accounting_unit_id: number | null;
    paid_by_accounting_unit_href: string | null;
    paid_by_label: string | null;
  } | null;
  paidTo: {
    paid_to_buildium_id: number | null;
    paid_to_type: string | null;
    paid_to_name: string | null;
    paid_to_href: string | null;
    paid_to_vendor_id: string | null;
    paid_to_tenant_id: string | null;
  } | null;
};

export type ComputePartiesParams = {
  paidByCandidates?: PaidByCandidate[];
  paidToCandidates?: PaidToCandidate[];
  labelContext?: LabelContext;
};

export function computeCanonicalParties(params: ComputePartiesParams): CanonicalPartiesResult {
  const paidByInput = params.paidByCandidates ?? [];
  const paidToInput = params.paidToCandidates ?? [];

  const paidByResult = derivePaidBy(paidByInput, params.labelContext);
  const paidToResult = derivePaidTo(paidToInput);

  return {
    paidBy: paidByResult.canonical
      ? { ...paidByResult.canonical, paid_by_label: paidByResult.label }
      : null,
    paidTo: paidToResult ?? null,
  };
}

/**
 * Build a transaction patch (partial row) with canonical PaidBy/PaidTo fields populated.
 * This is intended to be used by central upsert paths (webhook, sync, create flows).
 */
export function buildCanonicalTransactionPatch(params: ComputePartiesParams): Record<string, unknown> {
  const { paidBy, paidTo } = computeCanonicalParties(params);

  return {
    paid_by_accounting_entity_id: paidBy?.paid_by_accounting_entity_id ?? null,
    paid_by_accounting_entity_type: paidBy?.paid_by_accounting_entity_type ?? null,
    paid_by_accounting_entity_href: paidBy?.paid_by_accounting_entity_href ?? null,
    paid_by_accounting_unit_id: paidBy?.paid_by_accounting_unit_id ?? null,
    paid_by_accounting_unit_href: paidBy?.paid_by_accounting_unit_href ?? null,
    paid_by_label: paidBy?.paid_by_label ?? null,

    paid_to_buildium_id: paidTo?.paid_to_buildium_id ?? null,
    paid_to_type: paidTo?.paid_to_type ?? null,
    paid_to_name: paidTo?.paid_to_name ?? null,
    paid_to_href: paidTo?.paid_to_href ?? null,
    paid_to_vendor_id: paidTo?.paid_to_vendor_id ?? null,
    paid_to_tenant_id: paidTo?.paid_to_tenant_id ?? null,
  };
}

