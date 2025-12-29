#!/usr/bin/env npx tsx
/**
 * Backfills transaction_lines so every row has:
 * - lease_id when a Buildium lease or parent transaction exists
 * - buildium_property_id / buildium_unit_id defaulted from the resolved lease/unit
 */

import { config } from 'dotenv';

config({ path: '.env.local' });

type UUID = string;

type TransactionLine = {
  id: UUID;
  transaction_id: UUID | null;
  lease_id: number | null;
  buildium_lease_id: number | null;
  property_id: UUID | null;
  unit_id: UUID | null;
  buildium_property_id: number | null;
  buildium_unit_id: number | null;
  account_entity_type: string | null;
  account_entity_id: number | null;
};

type LeaseRow = {
  id: number;
  property_id: UUID | null;
  unit_id: UUID | null;
  buildium_property_id: number | null;
  buildium_unit_id: number | null;
  buildium_lease_id: number | null;
};

type TransactionRow = {
  id: UUID;
  lease_id: number | null;
  buildium_lease_id: number | null;
};

type PropertyRow = { id: UUID; buildium_property_id: number | null };
type UnitRow = { id: UUID; property_id: UUID | null; buildium_unit_id: number | null };

async function main() {
  const { supabaseAdmin } = await import('../src/lib/db.js');

  const pageSize = 500;
  let lastId: string | null = null;
  let processed = 0;
  let updated = 0;
  let batches = 0;

  const leaseCache = new Map<number, LeaseRow>();
  const leaseByBuildiumCache = new Map<number, LeaseRow>();
  const transactionCache = new Map<UUID, TransactionRow>();
  const propertyCache = new Map<UUID, PropertyRow>();
  const unitCache = new Map<UUID, UnitRow>();

  async function fetchLeaseById(id: number | null) {
    if (!id) return null;
    if (leaseCache.has(id)) return leaseCache.get(id)!;
    const { data, error } = await supabaseAdmin
      .from('lease')
      .select('id, property_id, unit_id, buildium_property_id, buildium_unit_id, buildium_lease_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (data) leaseCache.set(id, data as LeaseRow);
    return (data as LeaseRow) ?? null;
  }

  async function fetchLeaseByBuildiumId(buildiumLeaseId: number | null) {
    if (!buildiumLeaseId) return null;
    if (leaseByBuildiumCache.has(buildiumLeaseId)) return leaseByBuildiumCache.get(buildiumLeaseId)!;
    const { data, error } = await supabaseAdmin
      .from('lease')
      .select('id, property_id, unit_id, buildium_property_id, buildium_unit_id, buildium_lease_id')
      .eq('buildium_lease_id', buildiumLeaseId)
      .maybeSingle();
    if (error) throw error;
    if (data) leaseByBuildiumCache.set(buildiumLeaseId, data as LeaseRow);
    return (data as LeaseRow) ?? null;
  }

  async function fetchTransaction(id: UUID | null) {
    if (!id) return null;
    if (transactionCache.has(id)) return transactionCache.get(id)!;
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, lease_id, buildium_lease_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (data) transactionCache.set(id, data as TransactionRow);
    return (data as TransactionRow) ?? null;
  }

  async function fetchProperty(id: UUID | null) {
    if (!id) return null;
    if (propertyCache.has(id)) return propertyCache.get(id)!;
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('id, buildium_property_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (data) propertyCache.set(id, data as PropertyRow);
    return (data as PropertyRow) ?? null;
  }

  async function fetchUnit(id: UUID | null) {
    if (!id) return null;
    if (unitCache.has(id)) return unitCache.get(id)!;
    const { data, error } = await supabaseAdmin
      .from('units')
      .select('id, property_id, buildium_unit_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (data) unitCache.set(id, data as UnitRow);
    return (data as UnitRow) ?? null;
  }

  // Paginate through rows that are missing any lease/buildium linkage
  while (true) {
    let query = supabaseAdmin
      .from('transaction_lines')
      .select(
        'id, transaction_id, lease_id, buildium_lease_id, property_id, unit_id, buildium_property_id, buildium_unit_id, account_entity_type, account_entity_id',
      )
      .or(
        'lease_id.is.null,buildium_property_id.is.null,buildium_unit_id.is.null,buildium_lease_id.is.null',
      )
      .order('id', { ascending: true })
      .limit(pageSize);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const updates: Partial<TransactionLine>[] = [];
    const nowIso = new Date().toISOString();

    for (const row of rows as TransactionLine[]) {
      processed += 1;

      const tx = await fetchTransaction(row.transaction_id);

      let leaseId = row.lease_id ?? tx?.lease_id ?? null;
      let buildiumLeaseId = row.buildium_lease_id ?? tx?.buildium_lease_id ?? null;

      let lease = await fetchLeaseById(leaseId);
      if (!lease && buildiumLeaseId) {
        lease = await fetchLeaseByBuildiumId(buildiumLeaseId);
        if (lease && !leaseId) leaseId = lease.id;
      }
      if (!buildiumLeaseId && lease?.buildium_lease_id) buildiumLeaseId = lease.buildium_lease_id;

      let propertyId = row.property_id ?? lease?.property_id ?? null;
      const unitId = row.unit_id ?? lease?.unit_id ?? null;

      const unit = await fetchUnit(unitId);
      if (!propertyId && unit?.property_id) {
        propertyId = unit.property_id;
      }

      const property = await fetchProperty(propertyId);

      const buildiumPropertyId =
        row.buildium_property_id ?? lease?.buildium_property_id ?? property?.buildium_property_id ?? null;
      const buildiumUnitId =
        row.buildium_unit_id ?? lease?.buildium_unit_id ?? unit?.buildium_unit_id ?? null;
      const accountEntityType = row.account_entity_type ?? 'Rental';
      const accountEntityId = row.account_entity_id ?? buildiumPropertyId ?? null;

      const update: Partial<TransactionLine> & { id: UUID } = { id: row.id };
      let changed = false;

      if (!row.lease_id && leaseId) {
        update.lease_id = leaseId;
        changed = true;
      }
      if (!row.buildium_lease_id && buildiumLeaseId) {
        update.buildium_lease_id = buildiumLeaseId;
        changed = true;
      }
      if (!row.property_id && propertyId) {
        update.property_id = propertyId;
        changed = true;
      }
      if (!row.unit_id && unitId) {
        update.unit_id = unitId;
        changed = true;
      }
      if (!row.buildium_property_id && buildiumPropertyId) {
        update.buildium_property_id = buildiumPropertyId;
        changed = true;
      }
      if (!row.buildium_unit_id && buildiumUnitId) {
        update.buildium_unit_id = buildiumUnitId;
        changed = true;
      }
      if (!row.account_entity_type && accountEntityType) {
        update.account_entity_type = accountEntityType;
        changed = true;
      }
      if (!row.account_entity_id && accountEntityId) {
        update.account_entity_id = accountEntityId;
        changed = true;
      }

      if (changed) {
        (update as any).updated_at = nowIso;
        updates.push(update);
      }
    }

    if (updates.length > 0) {
      for (const upd of updates) {
        const { id, ...rest } = upd as { id: UUID; [key: string]: any };
        const { error: updateError } = await supabaseAdmin
          .from('transaction_lines')
          .update(rest)
          .eq('id', id);
        if (updateError) throw updateError;
        updated += 1;
      }
    }

    lastId = (rows as TransactionLine[])[rows.length - 1].id;
    batches += 1;
    console.log(
      `Processed batch ${batches} (${processed} rows scanned, ${updated} rows updated so far; last id ${lastId})`,
    );
  }

  console.log('\nBackfill complete');
  console.log(`Rows scanned: ${processed}`);
  console.log(`Rows updated: ${updated}`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
