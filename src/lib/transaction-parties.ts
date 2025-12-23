/**
 * Canonical PaidBy/PaidTo selection + label derivation.
 * - Single-party selection: largest Amount, tie -> lowest stable ID, tie -> stable sort on (type, entityId, unitId).
 * - Labels are derived from canonical data and should only be recomputed in central upsert/backfill paths, not in UI.
 *
 * Suggested unit tests (happy and edge):
 * 1) PaidBy single candidate with amount -> chosen; label uses property only.
 * 2) PaidBy two candidates, larger amount wins.
 * 3) PaidBy tie on amount -> lowest stable ID wins.
 * 4) PaidBy tie on amount+id -> deterministic stable sort (type/entity/unit).
 * 5) PaidBy with unit -> label is "Property | Unit".
 * 6) PaidTo vendor vs tenant: prefer vendor when both provided in same candidate (vendor_id present).
 * 7) PaidTo multi-candidate tie-break mirrors PaidBy rule.
 * 8) Empty candidates -> nulls.
 */

export type PaidByCandidate = {
  accountingEntityId?: number | null;
  accountingEntityType?: string | null;
  accountingEntityHref?: string | null;
  accountingUnitId?: number | null;
  accountingUnitHref?: string | null;
  amount?: number | null;
};

export type PaidToCandidate = {
  buildiumId?: number | null;
  type?: string | null;
  name?: string | null;
  href?: string | null;
  vendorId?: string | null;
  tenantId?: string | null;
  amount?: number | null;
};

export type PaidByCanonical = {
  paid_by_accounting_entity_id: number | null;
  paid_by_accounting_entity_type: string | null;
  paid_by_accounting_entity_href: string | null;
  paid_by_accounting_unit_id: number | null;
  paid_by_accounting_unit_href: string | null;
};

export type PaidToCanonical = {
  paid_to_buildium_id: number | null;
  paid_to_type: string | null;
  paid_to_name: string | null;
  paid_to_href: string | null;
  paid_to_vendor_id: string | null;
  paid_to_tenant_id: string | null;
};

type WithStableId<T> = T & { _stableId: string; _amount: number };

function normalizeAmount(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function buildStableId(parts: (string | number | null | undefined)[]): string {
  return parts
    .map((p) => (p === null || p === undefined ? '' : String(p)))
    .join(':')
    .toLowerCase();
}

function pickTopCandidate<T extends { amount?: number | null }>(
  candidates: T[],
  buildId: (c: T) => string,
): WithStableId<T> | null {
  if (!candidates.length) return null;
  const enriched: WithStableId<T>[] = candidates.map((c) => ({
    ...c,
    _stableId: buildId(c),
    _amount: normalizeAmount(c.amount),
  }));

  // Sort by amount desc, then stableId asc, then final stable tie-break by the buildId inputs (already in stableId).
  enriched.sort((a, b) => {
    if (b._amount !== a._amount) return b._amount - a._amount;
    if (a._stableId < b._stableId) return -1;
    if (a._stableId > b._stableId) return 1;
    return 0;
  });

  return enriched[0] ?? null;
}

export function derivePaidBy(
  candidates: PaidByCandidate[],
  labelContext?: { propertyName?: string | null; unitLabel?: string | null },
): { canonical: PaidByCanonical | null; label: string | null } {
  const winner = pickTopCandidate(candidates, (c) =>
    buildStableId([
      c.accountingEntityType,
      c.accountingEntityId,
      c.accountingUnitId,
      c.accountingEntityHref,
      c.accountingUnitHref,
    ]),
  );

  if (!winner) {
    return { canonical: null, label: null };
  }

  const canonical: PaidByCanonical = {
    paid_by_accounting_entity_id: winner.accountingEntityId ?? null,
    paid_by_accounting_entity_type: winner.accountingEntityType ?? null,
    paid_by_accounting_entity_href: winner.accountingEntityHref ?? null,
    paid_by_accounting_unit_id: winner.accountingUnitId ?? null,
    paid_by_accounting_unit_href: winner.accountingUnitHref ?? null,
  };

  const propertyName = labelContext?.propertyName?.trim();
  const unitLabel = labelContext?.unitLabel?.trim();
  let label: string | null = null;
  if (propertyName) {
    label = unitLabel ? `${propertyName} | ${unitLabel}` : propertyName;
  }

  return { canonical, label };
}

export function derivePaidTo(candidates: PaidToCandidate[]): PaidToCanonical | null {
  const winner = pickTopCandidate(candidates, (c) =>
    buildStableId([c.type, c.buildiumId, c.vendorId, c.tenantId, c.href]),
  );

  if (!winner) return null;

  return {
    paid_to_buildium_id: winner.buildiumId ?? null,
    paid_to_type: winner.type ?? null,
    paid_to_name: winner.name ?? null,
    paid_to_href: winner.href ?? null,
    // Prefer vendor_id or tenant_id when provided; tie-breaking was already resolved upstream in pickTopCandidate.
    paid_to_vendor_id: winner.vendorId ?? null,
    paid_to_tenant_id: winner.tenantId ?? null,
  };
}

