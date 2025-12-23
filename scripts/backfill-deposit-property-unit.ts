import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: false });

async function backfillDepositPropertyUnit() {
  const dbModule = await import('../src/lib/db');
  const supabaseAdmin =
    (dbModule as any).supabaseAdmin ||
    (dbModule as any).default?.supabaseAdmin ||
    (dbModule as any).default?.default;

  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin client not available');
  }

  console.log('Starting backfill of deposit property/unit fields...');

  // Find all deposit transactions
  const { data: deposits, error: depositsErr } = await supabaseAdmin
    .from('transactions')
    .select('id, date, org_id')
    .eq('transaction_type', 'Deposit')
    .order('date', { ascending: false });

  if (depositsErr) {
    throw depositsErr;
  }

  if (!deposits || deposits.length === 0) {
    console.log('No deposits found');
    return;
  }

  console.log(`Found ${deposits.length} deposits to process`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const deposit of deposits) {
    const depositId = deposit.id;

    // Find payment splits for this deposit that need backfilling
    const { data: splits, error: splitsErr } = await supabaseAdmin
      .from('transaction_payment_transactions')
      .select('id, buildium_payment_transaction_id, accounting_entity_id, accounting_unit_id')
      .eq('transaction_id', depositId)
      .or('accounting_entity_id.is.null,accounting_unit_id.is.null');

    if (splitsErr) {
      console.error(`Error fetching splits for deposit ${depositId}:`, splitsErr);
      errorCount++;
      continue;
    }

    if (!splits || splits.length === 0) {
      skippedCount++;
      continue;
    }

    // Collect Buildium payment transaction IDs
    const buildiumPaymentIds = splits
      .map((s: any) => s.buildium_payment_transaction_id)
      .filter((id: any): id is number => typeof id === 'number');

    if (buildiumPaymentIds.length === 0) {
      skippedCount++;
      continue;
    }

    // Look up source payment transactions
    const { data: paymentTxs, error: paymentTxsErr } = await supabaseAdmin
      .from('transactions')
      .select('id, buildium_transaction_id, transaction_lines(property_id, unit_id)')
      .in('buildium_transaction_id', buildiumPaymentIds);

    if (paymentTxsErr) {
      console.error(`Error fetching payment transactions for deposit ${depositId}:`, paymentTxsErr);
      errorCount++;
      continue;
    }

    // Build map from Buildium payment ID to property/unit IDs
    const paymentBuildiumToEntity = new Map<
      number,
      { propertyId: string | null; unitId: string | null }
    >();

    (paymentTxs || []).forEach((tx: any) => {
      const buildiumId = tx.buildium_transaction_id;
      if (typeof buildiumId !== 'number') return;

      const lines = tx.transaction_lines || [];
      const lineWithEntity = lines.find((l: any) => l?.property_id || l?.unit_id) as
        | { property_id?: string | null; unit_id?: string | null }
        | undefined;

      if (lineWithEntity) {
        paymentBuildiumToEntity.set(buildiumId, {
          propertyId: lineWithEntity.property_id || null,
          unitId: lineWithEntity.unit_id || null,
        });
      }
    });

    // Collect all property and unit IDs
    const propertyIds = new Set<string>();
    const unitIds = new Set<string>();
    paymentBuildiumToEntity.forEach((entity) => {
      if (entity.propertyId) propertyIds.add(entity.propertyId);
      if (entity.unitId) unitIds.add(entity.unitId);
    });

    // Look up Buildium IDs for properties
    const propertyBuildiumById = new Map<string, number>();
    if (propertyIds.size > 0) {
      const { data: props } = await supabaseAdmin
        .from('properties')
        .select('id, buildium_property_id')
        .in('id', Array.from(propertyIds))
        .limit(1000);

      (props || []).forEach((p: any) => {
        if (p?.id && typeof p?.buildium_property_id === 'number') {
          propertyBuildiumById.set(String(p.id), p.buildium_property_id);
        }
      });
    }

    // Look up Buildium IDs for units
    const unitBuildiumById = new Map<string, number>();
    if (unitIds.size > 0) {
      const { data: units } = await supabaseAdmin
        .from('units')
        .select('id, buildium_unit_id')
        .in('id', Array.from(unitIds))
        .limit(2000);

      (units || []).forEach((u: any) => {
        if (u?.id && typeof u?.buildium_unit_id === 'number') {
          unitBuildiumById.set(String(u.id), u.buildium_unit_id);
        }
      });
    }

    // Update each split that needs backfilling
    for (const split of splits) {
      const buildiumPaymentId = split.buildium_payment_transaction_id;
      if (typeof buildiumPaymentId !== 'number') continue;

      const entity = paymentBuildiumToEntity.get(buildiumPaymentId);
      if (!entity) continue;

      const buildiumPropertyId =
        entity.propertyId != null ? propertyBuildiumById.get(String(entity.propertyId)) : null;
      const buildiumUnitId =
        entity.unitId != null ? unitBuildiumById.get(String(entity.unitId)) : null;

      // Only update if we have at least one Buildium ID to set
      if (buildiumPropertyId == null && buildiumUnitId == null) continue;

      const updateData: {
        accounting_entity_id?: number | null;
        accounting_entity_type?: string | null;
        accounting_unit_id?: number | null;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      if (buildiumPropertyId != null) {
        updateData.accounting_entity_id = buildiumPropertyId;
        updateData.accounting_entity_type = 'Rental';
      } else {
        updateData.accounting_entity_id = null;
        updateData.accounting_entity_type = null;
      }

      if (buildiumUnitId != null) {
        updateData.accounting_unit_id = buildiumUnitId;
      } else {
        updateData.accounting_unit_id = null;
      }

      const { error: updateErr } = await supabaseAdmin
        .from('transaction_payment_transactions')
        .update(updateData)
        .eq('id', split.id);

      if (updateErr) {
        console.error(`Error updating split ${split.id}:`, updateErr);
        errorCount++;
      } else {
        updatedCount++;
        console.log(
          `Updated split ${split.id} for deposit ${depositId}: property=${buildiumPropertyId ?? 'null'}, unit=${buildiumUnitId ?? 'null'}`,
        );
      }
    }
  }

  console.log('\nBackfill complete:');
  console.log(`  Updated: ${updatedCount} splits`);
  console.log(`  Skipped: ${skippedCount} deposits (no splits or already populated)`);
  console.log(`  Errors: ${errorCount}`);
}

backfillDepositPropertyUnit()
  .then(() => {
    console.log('Backfill script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backfill script failed:', err);
    process.exit(1);
  });
