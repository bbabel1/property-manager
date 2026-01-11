import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import {
  hasSupabaseAdmin,
  requireSupabaseAdmin,
  SupabaseAdminUnavailableError,
} from '@/lib/supabase-client';
import { buildiumFetch } from '@/lib/buildium-http';
import { requireOrgMember } from '@/lib/auth/org-guards';

/**
 * GET /api/bills/[id]/files/[fileId]/presign
 *
 * Get a presigned URL for a file associated with a bill.
 * In the new schema, files are directly associated via entity_type/entity_id.
 * Since bills map to transactions and may not have direct Buildium entity type,
 * we look up files by buildium_bill_id or check if file references the transaction.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  const { supabase, user } = await requireAuth();
  const { id: billId, fileId } = await context.params;

  if (!billId || !fileId) {
    return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
  }

  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 });
  }

  let admin;
  try {
    admin = requireSupabaseAdmin('bill file presign');
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }

  // Get the transaction/bill to find its Buildium ID and resolve org_id
  const { data: transaction } = await admin
    .from('transactions')
    .select('buildium_bill_id, org_id, lease_id, vendor_id')
    .eq('id', billId)
    .maybeSingle();

  if (!transaction) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }
  await requireOrgMember({
    client: supabase,
    userId: user.id,
    orgId: String(transaction.org_id),
  });

  // Resolve org_id from transaction or related entities (same pattern as file upload)
  let resolvedOrgId = transaction.org_id;

  if (!resolvedOrgId && transaction.lease_id) {
    const { data: lease } = await admin
      .from('lease')
      .select('org_id, property_id')
      .eq('id', transaction.lease_id)
      .maybeSingle();
    if (lease?.org_id) {
      resolvedOrgId = lease.org_id;
    } else if (lease?.property_id) {
      const { data: property } = await admin
        .from('properties')
        .select('org_id')
        .eq('id', lease.property_id)
        .maybeSingle();
      if (property?.org_id) {
        resolvedOrgId = property.org_id;
      }
    }
  }

  if (!resolvedOrgId) {
    // Try resolving from transaction_lines property
    const { data: txnLine } = await admin
      .from('transaction_lines')
      .select('property_id')
      .eq('transaction_id', billId)
      .not('property_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (txnLine?.property_id) {
      const { data: property } = await admin
        .from('properties')
        .select('org_id')
        .eq('id', txnLine.property_id)
        .maybeSingle();
      if (property?.org_id) {
        resolvedOrgId = property.org_id;
      }
    }
  }

  // Validate org_id exists (required for RLS filtering)
  if (!resolvedOrgId) {
    console.error('[bill-file-presign] unable to resolve org_id', { billId, fileId });
    return NextResponse.json(
      { error: 'Bill missing organization context' },
      { status: 400 },
    );
  }

  // Look up the file directly
  // Note: Since bills aren't a direct Buildium entity type,
  // files might be associated via Vendor entity type with the bill's vendor
  // or stored with buildium_file_id reference
  const { data: file, error: fileErr } = await admin
    .from('files')
    .select(
      'id, storage_provider, bucket, storage_key, sha256, buildium_file_id, entity_type, entity_id, buildium_entity_type, buildium_entity_id',
    )
    .eq('id', fileId)
    .eq('org_id', resolvedOrgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fileErr) {
    console.error('[bill-file-presign] file lookup error', { billId, fileId, error: fileErr });
    return NextResponse.json(
      { error: 'File lookup failed', details: fileErr.message },
      { status: 500 },
    );
  }
  if (!file) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Ensure the file is tied to this bill context (same org already enforced)
  const { data: firstLine } = await admin
    .from('transaction_lines')
    .select('property_id, unit_id, buildium_property_id, buildium_unit_id')
    .eq('transaction_id', billId)
    .limit(1)
    .maybeSingle();

  const propertyIds = new Set<string>();
  const unitIds = new Set<string>();
  if (transaction?.lease_id) {
    const { data: leaseLine } = await admin
      .from('lease')
      .select('property_id, unit_id')
      .eq('id', transaction.lease_id)
      .maybeSingle();
    if (leaseLine?.property_id) propertyIds.add(String(leaseLine.property_id));
    if (leaseLine?.unit_id) unitIds.add(String(leaseLine.unit_id));
  }
  if (firstLine?.property_id) propertyIds.add(String(firstLine.property_id));
  if (firstLine?.unit_id) unitIds.add(String(firstLine.unit_id));

  const fileProperty = file?.entity_type === 'Properties' ? String(file.entity_id) : null;
  const fileUnit = file?.entity_type === 'Units' ? String(file.entity_id) : null;
  const buildiumBillId = Number(transaction.buildium_bill_id) || null;

  const isBillFile =
    (buildiumBillId && Number(file?.buildium_entity_id) === buildiumBillId) ||
    (fileProperty && propertyIds.has(fileProperty)) ||
    (fileUnit && unitIds.has(fileUnit));

  if (!isBillFile) {
    return NextResponse.json({ error: 'File does not belong to this bill' }, { status: 404 });
  }

  if (file.storage_provider === 'supabase') {
    if (!file.bucket || !file.storage_key) {
      return NextResponse.json({ error: 'File missing storage path' }, { status: 400 });
    }
    const expiresIn = 15 * 60;
    const { data: signData, error: signErr } = await admin.storage
      .from(String(file.bucket))
      .createSignedUrl(String(file.storage_key), expiresIn, { download: false });
    if (signErr) {
      return NextResponse.json(
        { error: 'Failed to presign', details: signErr.message },
        { status: 500 },
      );
    }
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return NextResponse.json({
      getUrl: signData.signedUrl,
      expiresAt,
      sha256: file.sha256 || null,
    });
  }

  if (file.storage_provider === 'buildium') {
    const id = file.buildium_file_id;
    if (!id) {
      return NextResponse.json({ error: 'Missing Buildium file id' }, { status: 400 });
    }
    const res = await buildiumFetch('POST', `/files/${id}/download`, undefined, undefined, resolvedOrgId);
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Buildium download URL failed', status: res.status },
        { status: 502 },
      );
    }
    const json = (res.json ?? {}) as { DownloadUrl?: string; ExpirationDateTime?: string | null };
    return NextResponse.json({
      getUrl: json?.DownloadUrl,
      expiresAt: json?.ExpirationDateTime || null,
    });
  }

  return NextResponse.json({ error: 'Unsupported storage provider' }, { status: 400 });
}
