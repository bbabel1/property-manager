import { NextRequest, NextResponse } from 'next/server';
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client';
import { requireUser } from '@/lib/auth';
import {
  getOrgScopedBuildiumClient,
  type BuildiumUploadTicket,
} from '@/lib/buildium-client';
import { getOrgScopedBuildiumConfig } from '@/lib/buildium/credentials-manager';
import { extractBuildiumFileIdFromPayload } from '@/lib/buildium-utils';
import {
  uploadLeaseDocumentToBuildium,
  type BuildiumFileSyncResult,
} from '@/lib/buildium-file-sync';
import { logger } from '@/lib/logger';
import type { TypedSupabaseClient } from '@/lib/db';
import { supabaseAdminMaybe } from '@/lib/db';
import type { BuildiumFile, BuildiumFileEntityType } from '@/types/buildium';
import {
  createFile,
  FILE_ENTITY_TYPES,
  mapBuildiumEntityTypeToFile,
  type FileRow,
} from '@/lib/files';

type BuildiumBillFile = BuildiumFile & { Id?: number; Href?: string | null };

type LocalEntityType =
  | 'property'
  | 'unit'
  | 'lease'
  | 'tenant'
  | 'owner'
  | 'vendor'
  | 'task'
  | 'task_history'
  | 'work_order'
  | 'bill'
  | 'contact';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];
const ALLOWED_MIME_TYPES = new Set<string>([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'text/plain',
  'application/octet-stream',
]);

function isMimeTypeAllowed(mimeType: string | null | undefined): boolean {
  if (!mimeType) return true;
  for (const prefix of ALLOWED_MIME_PREFIXES) {
    if (mimeType.startsWith(prefix)) return true;
  }
  if (ALLOWED_MIME_TYPES.has(mimeType)) return true;
  // Allow common Office MIME alias if not already captured
  if (mimeType.startsWith('application/vnd.openxmlformats-officedocument')) return true;
  return false;
}

const toStringId = (value: string | number): string => String(value);
const toNumberId = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function sanitizeFileName(name: string): string {
  if (!name) return 'upload';
  const trimmed = name.trim().replace(/[/\\]/g, ' ');
  return trimmed || 'upload';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

/**
 * Map local entity types to Buildium entity types
 */
function mapLocalEntityTypeToBuildium(localType: LocalEntityType): BuildiumFileEntityType | null {
  const mapping: Record<LocalEntityType, BuildiumFileEntityType | null> = {
    property: 'Rental',
    unit: 'RentalUnit',
    lease: 'Lease',
    tenant: 'Tenant',
    owner: 'RentalOwner',
    vendor: 'Vendor',
    task: null, // Tasks aren't a direct Buildium entity type
    task_history: null,
    work_order: null,
    bill: null, // Bills map to Vendor or other entities
    contact: null,
  };
  return mapping[localType] ?? null;
}

/**
 * Resolve Buildium entity ID for a local entity
 */
async function resolveBuildiumEntityId(
  admin: TypedSupabaseClient,
  localType: LocalEntityType,
  localId: string | number,
): Promise<{ buildiumEntityType: BuildiumFileEntityType; buildiumEntityId: number } | null> {
  switch (localType) {
    case 'lease': {
      const leaseId = toNumberId(localId);
      if (leaseId === null) return null;
      const { data } = await admin
        .from('lease')
        .select('buildium_lease_id')
        .eq('id', leaseId)
        .maybeSingle();
      if (data?.buildium_lease_id) {
        return { buildiumEntityType: 'Lease', buildiumEntityId: data.buildium_lease_id };
      }
      return null;
    }
    case 'bill': {
      // For bills, we need to check the transaction and potentially map to Vendor
      const transactionId = toStringId(localId);
      const { data: txn } = await admin
        .from('transactions')
        .select('buildium_bill_id, vendor_id')
        .eq('id', transactionId)
        .maybeSingle();
      if (txn?.buildium_bill_id) {
        // Bills might be associated with Vendor entity type in Buildium
        // For now, we'll check if there's a vendor with Buildium ID
        if (txn.vendor_id) {
          const { data: vendor } = await admin
            .from('vendors')
            .select('buildium_vendor_id')
            .eq('id', txn.vendor_id)
            .maybeSingle();
          if (vendor?.buildium_vendor_id) {
            return { buildiumEntityType: 'Vendor', buildiumEntityId: vendor.buildium_vendor_id };
          }
        }
      }
      return null;
    }
    case 'property': {
      const propertyId = toStringId(localId);
      const { data } = await admin
        .from('properties')
        .select('buildium_property_id')
        .eq('id', propertyId)
        .maybeSingle();
      if (data?.buildium_property_id) {
        return { buildiumEntityType: 'Rental', buildiumEntityId: data.buildium_property_id };
      }
      return null;
    }
    case 'unit': {
      const unitId = toStringId(localId);
      const { data } = await admin
        .from('units')
        .select('buildium_unit_id')
        .eq('id', unitId)
        .maybeSingle();
      if (data?.buildium_unit_id) {
        return { buildiumEntityType: 'RentalUnit', buildiumEntityId: data.buildium_unit_id };
      }
      return null;
    }
    case 'tenant': {
      const tenantId = toStringId(localId);
      const { data } = await admin
        .from('tenants')
        .select('buildium_tenant_id')
        .eq('id', tenantId)
        .maybeSingle();
      if (data?.buildium_tenant_id) {
        return { buildiumEntityType: 'Tenant', buildiumEntityId: data.buildium_tenant_id };
      }
      return null;
    }
    case 'owner': {
      const ownerId = toStringId(localId);
      const { data } = await admin
        .from('owners')
        .select('buildium_owner_id')
        .eq('id', ownerId)
        .maybeSingle();
      if (data?.buildium_owner_id) {
        return { buildiumEntityType: 'RentalOwner', buildiumEntityId: data.buildium_owner_id };
      }
      return null;
    }
    case 'vendor': {
      const vendorId = toStringId(localId);
      const { data } = await admin
        .from('vendors')
        .select('buildium_vendor_id')
        .eq('id', vendorId)
        .maybeSingle();
      if (data?.buildium_vendor_id) {
        return { buildiumEntityType: 'Vendor', buildiumEntityId: data.buildium_vendor_id };
      }
      return null;
    }
    default:
      return null;
  }
}

async function resolveOrgForEntity(
  client: TypedSupabaseClient,
  entityType: LocalEntityType,
  entityId: string | number,
): Promise<string | null> {
  switch (entityType) {
    case 'property': {
      const id = toStringId(entityId);
      const { data } = await client
        .from('properties')
        .select('org_id')
        .eq('id', id)
        .maybeSingle();
      return data?.org_id ?? null;
    }
    case 'unit': {
      const id = toStringId(entityId);
      const { data } = await client
        .from('units')
        .select('property_id')
        .eq('id', id)
        .maybeSingle();
      if (!data?.property_id) return null;
      const { data: p } = await client
        .from('properties')
        .select('org_id')
        .eq('id', data.property_id)
        .maybeSingle();
      return p?.org_id ?? null;
    }
    case 'lease': {
      const id = toNumberId(entityId);
      if (id === null) return null;
      const { data } = await client
        .from('lease')
        .select('org_id, property_id')
        .eq('id', id)
        .maybeSingle();
      if (data?.org_id) return data.org_id;
      if (!data?.property_id) return null;
      const { data: p } = await client
        .from('properties')
        .select('org_id')
        .eq('id', data.property_id)
        .maybeSingle();
      return p?.org_id ?? null;
    }
    case 'tenant': {
      const id = toStringId(entityId);
      const { data } = await client
        .from('tenants')
        .select('org_id')
        .eq('id', id)
        .maybeSingle();
      return data?.org_id ?? null;
    }
    case 'owner': {
      const id = toStringId(entityId);
      const { data } = await client
        .from('owners')
        .select('org_id')
        .eq('id', id)
        .maybeSingle();
      return data?.org_id ?? null;
    }
    case 'vendor': {
      // Vendors do not currently store org_id directly; rely on linked contacts/properties elsewhere.
      return null;
    }
    case 'work_order': {
      const id = toStringId(entityId);
      const { data } = await client
        .from('work_orders')
        .select('org_id')
        .eq('id', id)
        .maybeSingle();
      return data?.org_id ?? null;
    }
    case 'task': {
      const id = toStringId(entityId);
      const { data } = await client
        .from('tasks')
        .select('property_id')
        .eq('id', id)
        .maybeSingle();
      if (!data?.property_id) return null;
      const { data: p } = await client
        .from('properties')
        .select('org_id')
        .eq('id', data.property_id)
        .maybeSingle();
      return p?.org_id ?? null;
    }
    case 'task_history': {
      const id = toStringId(entityId);
      const { data } = await client
        .from('task_history')
        .select('task_id')
        .eq('id', id)
        .maybeSingle();
      if (!data?.task_id) return null;
      const { data: t } = await client
        .from('tasks')
        .select('property_id')
        .eq('id', data.task_id)
        .maybeSingle();
      if (!t?.property_id) return null;
      const { data: p } = await client
        .from('properties')
        .select('org_id')
        .eq('id', t.property_id)
        .maybeSingle();
      return p?.org_id ?? null;
    }
    case 'bill': {
      const id = toStringId(entityId);
      const { data: txn } = await client
        .from('transactions')
        .select('org_id, vendor_id, lease_id')
        .eq('id', id)
        .maybeSingle();
      if (txn?.org_id) return txn.org_id;

      if (txn?.lease_id) {
        const { data: lease } = await client
          .from('lease')
          .select('org_id, property_id')
          .eq('id', txn.lease_id)
          .maybeSingle();
        if (lease?.org_id) return lease.org_id;
        if (lease?.property_id) {
          const { data: property } = await client
            .from('properties')
            .select('org_id')
            .eq('id', lease.property_id)
            .maybeSingle();
          if (property?.org_id) return property.org_id;
        }
      }

      const { data: txnLine } = await client
        .from('transaction_lines')
        .select('property_id')
        .eq('transaction_id', id)
        .not('property_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (txnLine?.property_id) {
        const { data: property } = await client
          .from('properties')
          .select('org_id')
          .eq('id', txnLine.property_id)
          .maybeSingle();
        if (property?.org_id) return property.org_id;
      }

      return null;
    }
    case 'contact': {
      const contactId = toNumberId(entityId);
      if (contactId === null) return null;
      // Contacts are not scoped to orgs in the current schema; fall back to user/org headers.
      return null;
    }
    default:
      return null;
  }
}

async function maybeUploadBillFileToBuildium(options: {
  admin: TypedSupabaseClient;
  transactionId: string | number;
  fileId: string;
  fileName: string;
  mimeType?: string;
  base64: string;
}): Promise<BuildiumFileSyncResult | null> {
  const { admin, transactionId, fileId, fileName, mimeType, base64 } = options;

  try {
    // Resolve orgId from transaction
    const { data: transactionRow, error: txnErr } = await admin
      .from('transactions')
      .select('buildium_bill_id, org_id')
      .eq('id', toStringId(transactionId))
      .maybeSingle();

    if (txnErr) throw txnErr;
    const buildiumBillIdRaw = transactionRow?.buildium_bill_id;
    const buildiumBillId =
      typeof buildiumBillIdRaw === 'number' ? buildiumBillIdRaw : Number(buildiumBillIdRaw);
    if (!Number.isFinite(buildiumBillId)) {
      return null;
    }

    const { data: lineRow, error: lineErr } = await admin
      .from('transaction_lines')
      .select('buildium_unit_id, buildium_property_id')
      .eq('transaction_id', toStringId(transactionId))
      .not('buildium_unit_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lineErr) throw lineErr;
    const buildiumUnitIdRaw = lineRow?.buildium_unit_id;
    const buildiumUnitId =
      typeof buildiumUnitIdRaw === 'number' ? buildiumUnitIdRaw : Number(buildiumUnitIdRaw);
    if (!Number.isFinite(buildiumUnitId) || buildiumUnitId <= 0) {
      return null;
    }

    const buildiumPropertyIdRaw = lineRow?.buildium_property_id;
    const buildiumPropertyId =
      typeof buildiumPropertyIdRaw === 'number'
        ? buildiumPropertyIdRaw
        : Number(buildiumPropertyIdRaw);

    // Resolve orgId from transaction or property
    let orgId = transactionRow?.org_id ?? undefined;
    if (!orgId && buildiumPropertyId) {
      const { data: property } = await admin
        .from('properties')
        .select('org_id')
        .eq('buildium_property_id', buildiumPropertyId)
        .maybeSingle();
      if (property?.org_id) {
        orgId = property.org_id;
      }
    }

    const buildiumConfig = await getOrgScopedBuildiumConfig(orgId);
    if (!buildiumConfig) {
      logger.warn('Buildium credentials missing; skipping bill file sync');
      return null;
    }

    const buildiumClient = await getOrgScopedBuildiumClient(orgId);

    const existingFiles: BuildiumBillFile[] = await buildiumClient
      .getBillFiles(buildiumBillId)
      .catch(() => []);
    const existingIds = new Set<number>();
    for (const file of Array.isArray(existingFiles) ? existingFiles : []) {
      const id = typeof file?.Id === 'number' ? file.Id : Number(file?.Id);
      if (Number.isFinite(id)) existingIds.add(Number(id));
    }

    const uploadRequestBody: {
      FileName: string;
      ContentType: string;
      Description?: string | null;
      UnitId?: number | null;
      OwnerId?: number | null;
      IsPrivate?: boolean | null;
      PropertyId?: number | null;
      FileTitle?: string | null;
    } = {
      FileName: fileName,
      ContentType: mimeType || 'application/octet-stream',
      UnitId: buildiumUnitId,
      Description: '',
      IsPrivate: true,
      FileTitle: fileName,
    };

    if (Number.isFinite(buildiumPropertyId) && buildiumPropertyId > 0) {
      uploadRequestBody.PropertyId = buildiumPropertyId;
    }

    const ticket = (await buildiumClient.createBillFileUploadRequest(
      buildiumBillId,
      uploadRequestBody,
    )) as { Href?: string; BucketUrl?: string; FormData?: Record<string, string> };
    const ticketFileId = extractBuildiumFileIdFromPayload(ticket);
    const ticketHref =
      typeof (ticket as Record<string, unknown>)?.Href === 'string' ? String(ticket.Href) : null;
    const bucketUrl: string | undefined = ticket?.BucketUrl;
    const ticketForm: Record<string, string> | undefined = ticket?.FormData;
    if (!bucketUrl || !ticketForm) {
      throw new Error('Buildium upload ticket missing bucket information');
    }

    const binary = Buffer.from(base64, 'base64');
    const formData = new FormData();
    for (const [key, value] of Object.entries(ticketForm)) {
      if (value != null) formData.append(key, value);
    }
    formData.append(
      'file',
      new Blob([binary], { type: mimeType || 'application/octet-stream' }),
      fileName,
    );

    const uploadResponse = await fetch(bucketUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => '');
      throw new Error(`Buildium binary upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const locateUploadedFile = async (targetId?: number | null): Promise<BuildiumBillFile | null> => {
      const attempts = 8;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const list: BuildiumBillFile[] = await buildiumClient
          .getBillFiles(buildiumBillId)
          .catch(() => []);
        for (const entry of Array.isArray(list) ? list : []) {
          const fileIdNumber = typeof entry?.Id === 'number' ? entry.Id : Number(entry?.Id);
          if (!Number.isFinite(fileIdNumber)) continue;
          const numericId = Number(fileIdNumber);
          if (targetId && numericId === targetId) {
            return entry;
          }
          if (!existingIds.has(numericId)) {
            return entry;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
      return null;
    };

    const buildiumFile = await locateUploadedFile(ticketFileId ?? undefined);
    const locatedFileId =
      typeof buildiumFile?.Id === 'number' && Number.isFinite(buildiumFile.Id)
        ? Number(buildiumFile.Id)
        : parseInt(String(buildiumFile?.Id ?? ''), 10);
    const resolvedFileId =
      (Number.isFinite(locatedFileId) && locatedFileId > 0 ? locatedFileId : null) ??
      (ticketFileId ?? null);

    if (!resolvedFileId) {
      logger.warn(
        { billId: buildiumBillId, fileId },
        'Uploaded file to Buildium storage but could not confirm presence via API',
      );
      return {
        buildiumFile: null,
        error: 'File uploaded but Buildium did not return a file id yet',
      };
    }

    const resolvedHref =
      (typeof buildiumFile?.Href === 'string' && buildiumFile.Href) ||
      ticketHref ||
      null;

    const updates: Record<string, unknown> = {
      buildium_file_id: resolvedFileId,
      buildium_href: resolvedHref,
    };

    if (Number.isFinite(buildiumUnitId) && buildiumUnitId > 0) {
      updates.entity_type = FILE_ENTITY_TYPES.UNITS;
      updates.entity_id = Number(buildiumUnitId);
    } else if (Number.isFinite(buildiumPropertyId) && Number(buildiumPropertyId) > 0) {
      updates.entity_type = FILE_ENTITY_TYPES.PROPERTIES;
      updates.entity_id = Number(buildiumPropertyId);
    }

    await admin.from('files').update(updates).eq('id', fileId);
    const { data: updatedFile } = await admin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .maybeSingle();

    logger.info(
      {
        billId: buildiumBillId,
        fileId,
        buildiumFileId: updates.buildium_file_id ?? null,
      },
      'Uploaded bill file to Buildium',
    );

    const buildiumFilePayload: Record<string, unknown> | null =
      buildiumFile != null
        ? (buildiumFile as unknown as Record<string, unknown>)
        : resolvedFileId
          ? ({ Id: resolvedFileId, Href: resolvedHref ?? undefined } as Record<string, unknown>)
          : null;

    return { buildiumFile: buildiumFilePayload, updatedFile: updatedFile || undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      { error: message, transactionId, fileId },
      'Failed to upload bill file to Buildium',
    );
    return { buildiumFile: null, error: message };
  }
}

async function uploadFileToBuildiumEntity(options: {
  admin: TypedSupabaseClient;
  file: FileRow;
  fileName: string;
  mimeType?: string;
  base64: string;
  buildiumEntityType: BuildiumFileEntityType;
  buildiumEntityId: number;
  buildiumCategoryId: number | null;
  categoryName: string | null;
}): Promise<BuildiumFileSyncResult | null> {
  const {
    admin,
    file,
    fileName,
    mimeType,
    base64,
    buildiumEntityType,
    buildiumEntityId,
    buildiumCategoryId,
    categoryName,
  } = options;

  // Resolve orgId from file
  let orgId = file.org_id ?? undefined;
  if (!orgId) {
    // Try to resolve from entity
    if (file.entity_type && file.entity_id) {
      const entityType = file.entity_type;
      if (entityType === 'Properties') {
        const { data: property } = await admin
          .from('properties')
          .select('org_id')
          .eq('buildium_property_id', Number(file.entity_id))
          .maybeSingle();
        if (property?.org_id) {
          orgId = property.org_id;
        }
      } else if (entityType === 'Units') {
        const { data: unit } = await admin
          .from('units')
          .select('org_id')
          .eq('buildium_unit_id', Number(file.entity_id))
          .maybeSingle();
        if (unit?.org_id) {
          orgId = unit.org_id;
        }
      } else if (entityType === 'Leases') {
        const { data: lease } = await admin
          .from('lease')
          .select('org_id')
          .eq('buildium_lease_id', Number(file.entity_id))
          .maybeSingle();
        if (lease?.org_id) {
          orgId = lease.org_id;
        }
      }
    }
  }

  const buildiumConfig = await getOrgScopedBuildiumConfig(orgId);
  if (!buildiumConfig) {
    logger.warn('Buildium credentials missing; skipping file sync');
    return null;
  }

  const buildiumClient = await getOrgScopedBuildiumClient(orgId);
  type BuildiumUploadPayload = {
    FileName: string;
    Title?: string | null;
    Description?: string | null;
    CategoryId?: number | null;
    Category?: string | null;
    ContentType?: string | null;
  };

  const basePayload: BuildiumUploadPayload = {
    FileName: fileName,
    Title:
      (typeof file.title === 'string' && file.title.trim()) ||
      (typeof file.file_name === 'string' && file.file_name.trim()) ||
      fileName,
  };

  if (typeof file.description === 'string' && file.description.trim()) {
    basePayload.Description = file.description.trim();
  }
  if (mimeType) {
    basePayload.ContentType = mimeType;
  }

  const applyCategory = (useId: boolean): BuildiumUploadPayload => {
    const payload: BuildiumUploadPayload = { ...basePayload };
    if (useId && buildiumCategoryId != null && Number.isFinite(buildiumCategoryId)) {
      payload.CategoryId = buildiumCategoryId;
    } else if (categoryName) {
      payload.Category = categoryName;
    }
    return payload;
  };

  let ticket: BuildiumUploadTicket | null = null;
  let usedCategoryId = false;
  try {
    const payload = applyCategory(true);
    usedCategoryId = payload.CategoryId != null;
    ticket = await buildiumClient.createFileUploadRequest(
      buildiumEntityType,
      buildiumEntityId,
      payload,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const categoryError =
      buildiumCategoryId != null &&
      message.includes('CategoryId') &&
      (message.includes('invalid') || message.includes('missing') || message.includes('422'));
    if (!categoryError) {
      logger.error(
        { fileId: file.id, buildiumEntityType, buildiumEntityId, error: message },
        'Failed to create Buildium upload request',
      );
      return { buildiumFile: null, error: message };
    }

    logger.warn(
      { fileId: file.id, buildiumEntityType, buildiumEntityId, buildiumCategoryId, message },
      'Retrying Buildium upload request without category id',
    );
    const fallbackPayload = applyCategory(false);
    ticket = await buildiumClient.createFileUploadRequest(
      buildiumEntityType,
      buildiumEntityId,
      fallbackPayload,
    );
    usedCategoryId = false;
  }

  if (!ticket?.BucketUrl || !ticket?.FormData) {
    const errorMessage = 'Invalid Buildium upload response';
    logger.error(
      { fileId: file.id, buildiumEntityType, buildiumEntityId, ticket },
      errorMessage,
    );
    return { buildiumFile: null, error: errorMessage };
  }

  const ticketFileId = extractBuildiumFileIdFromPayload(ticket as Record<string, unknown>);
  const ticketHref = typeof ticket?.Href === 'string' ? String(ticket.Href) : null;
  const physicalFileName =
    typeof (ticket as Record<string, unknown>)?.['PhysicalFileName'] === 'string'
      ? String((ticket as Record<string, unknown>)['PhysicalFileName'])
      : null;

  const formData = new FormData();
  Object.entries(ticket.FormData ?? {}).forEach(([key, value]) => {
    if (value != null) {
      formData.append(key, String(value));
    }
  });

  const binary = Buffer.from(base64, 'base64');
  const blob = new Blob([binary], { type: mimeType || 'application/octet-stream' });
  const uploadName =
    (typeof file.file_name === 'string' && file.file_name.trim()) ||
    (typeof file.title === 'string' && file.title.trim()) ||
    fileName ||
    'file';
  formData.append('file', blob, uploadName);

  const uploadResponse = await fetch(ticket.BucketUrl, { method: 'POST', body: formData });
  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.text().catch(() => '');
    const message = `Failed to upload file to Buildium: ${uploadResponse.status} ${errorBody}`;
    logger.error(
      {
        fileId: file.id,
        buildiumEntityType,
        buildiumEntityId,
        status: uploadResponse.status,
        body: errorBody,
      },
      message,
    );
    return { buildiumFile: null, error: message };
  }

  const locateUploadedFile = async (): Promise<BuildiumFile | null> => {
    if (!physicalFileName) return null;
    const attempts = 6;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const files = await buildiumClient
          .getFiles({
            physicalFileName,
            entityId: buildiumEntityId ?? undefined,
            entityType: buildiumEntityType,
          })
          .catch(() => []);
        const match = Array.isArray(files)
          ? files.find((entry) => extractBuildiumFileIdFromPayload(entry) != null)
          : null;
        if (match) return match as BuildiumFile;
      } catch {
        // ignore and retry
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
    return null;
  };

  const buildiumFile =
    (await locateUploadedFile().catch(() => null)) ??
    (ticketFileId ? ({ Id: ticketFileId, Href: ticketHref ?? undefined } as BuildiumFile) : null);

  let buildiumFileId: number | null = extractBuildiumFileIdFromPayload(buildiumFile) ?? null;
  if (!buildiumFileId && physicalFileName) {
    const parsed = Number(physicalFileName);
    if (Number.isFinite(parsed) && parsed > 0) {
      buildiumFileId = parsed;
    }
  }
  if (!buildiumFileId && ticket.Href) {
    const match = String(ticket.Href).match(/\/(\d+)(?:\?|$)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        buildiumFileId = parsed;
      }
    }
  }
  if (!buildiumFileId) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (ticket.Href) {
      const match = String(ticket.Href).match(/\/(\d+)(?:\?|$)/);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          buildiumFileId = parsed;
        }
      }
    }
  }

  const updates: Record<string, unknown> = {
    buildium_file_id: buildiumFileId,
    buildium_href:
      (buildiumFile && typeof (buildiumFile as { Href?: unknown }).Href === 'string'
        ? (buildiumFile as { Href: string }).Href
        : null) ??
      ticketHref ??
      null,
  };
  const { data: updatedFile, error: updateError } = await admin
    .from('files')
    .update(updates)
    .eq('id', file.id)
    .select()
    .maybeSingle();

  if (updateError) {
    logger.error(
      { fileId: file.id, error: updateError.message },
      'File uploaded to Buildium but local record update failed',
    );
    return {
      buildiumFile: buildiumFile
        ? (buildiumFile as Record<string, unknown>)
        : ({
            Id: buildiumFileId,
            Href: ticketHref ?? undefined,
            UsedCategoryId: usedCategoryId,
          } as Record<string, unknown>),
      error: 'File uploaded to Buildium but local record update failed',
    };
  }

  logger.info(
    {
      fileId: file.id,
      buildiumFileId,
      buildiumEntityType,
      buildiumEntityId,
      usedCategoryId,
    },
    'File uploaded to Buildium via upload route',
  );

  return {
    buildiumFile: buildiumFile
      ? ({ ...buildiumFile, UsedCategoryId: usedCategoryId } as Record<string, unknown>)
      : ({
          Id: buildiumFileId,
          Href: ticket.Href ?? null,
          UsedCategoryId: usedCategoryId,
        } as Record<string, unknown>),
    updatedFile: (updatedFile ?? undefined) as FileRow | undefined,
  };
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseAdmin())
    return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 });
  const admin = requireSupabaseAdmin('files upload');
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  let entityType: LocalEntityType | null = null;
  let entityIdValue: string | number | null = null;
  let fileNameInput: string | null = null;
  let mimeType: string | undefined;
  let category: string | null = null;
  let isPrivate: boolean | undefined;
  let buildiumCategoryIdInput: number | null | undefined;
  let description: string | null = null;
  let uploadBlob: Blob | null = null;
  let normalizedBase64: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const fileField = form.get('file');
    if (!(fileField instanceof File)) {
      return NextResponse.json({ error: 'File field is required' }, { status: 400 });
    }
    uploadBlob = fileField;
    if (!mimeType && fileField.type) {
      mimeType = fileField.type;
    }

    const rawEntityType = form.get('entityType');
    if (typeof rawEntityType === 'string' && rawEntityType.trim()) {
      entityType = rawEntityType.trim().toLowerCase() as LocalEntityType;
    }

    const rawEntityId = form.get('entityId');
    if (rawEntityId != null) {
      const raw = String(rawEntityId).trim();
      if (raw) {
        const numeric = Number(raw);
        entityIdValue = Number.isFinite(numeric) && raw === String(numeric) ? numeric : raw;
      }
    }

    const rawFileName = form.get('fileName');
    if (typeof rawFileName === 'string' && rawFileName.trim()) {
      fileNameInput = rawFileName.trim();
    } else if (typeof fileField.name === 'string' && fileField.name) {
      fileNameInput = fileField.name;
    }

    const rawMimeType = form.get('mimeType');
    if (typeof rawMimeType === 'string' && rawMimeType.trim()) {
      mimeType = rawMimeType.trim();
    }

    const rawCategory = form.get('category');
    if (typeof rawCategory === 'string') {
      category = rawCategory;
    }

    const rawIsPrivate = form.get('isPrivate');
    if (typeof rawIsPrivate === 'string' && rawIsPrivate.trim()) {
      const normalized = rawIsPrivate.trim().toLowerCase();
      isPrivate = !['false', '0', 'no', 'off'].includes(normalized);
    }

    const rawBuildiumCategoryId = form.get('buildiumCategoryId');
    if (typeof rawBuildiumCategoryId === 'string' && rawBuildiumCategoryId.trim()) {
      const numeric = Number(rawBuildiumCategoryId);
      if (Number.isFinite(numeric)) {
        buildiumCategoryIdInput = numeric;
      }
    }

    const rawDescription = form.get('description');
    if (typeof rawDescription === 'string' && rawDescription.trim()) {
      description = rawDescription.trim();
    }
  } else {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    entityType =
      typeof body.entityType === 'string' && body.entityType.trim()
        ? (body.entityType.trim().toLowerCase() as LocalEntityType)
        : null;

    if (typeof body.entityId === 'number' && Number.isFinite(body.entityId)) {
      entityIdValue = body.entityId;
    } else if (typeof body.entityId === 'string' && body.entityId.trim()) {
      const trimmed = body.entityId.trim();
      const numeric = Number(trimmed);
      entityIdValue =
        Number.isFinite(numeric) && trimmed === String(numeric) ? numeric : trimmed;
    }

    fileNameInput =
      typeof body.fileName === 'string' && body.fileName.trim()
        ? body.fileName.trim()
        : null;

    if (typeof body.mimeType === 'string' && body.mimeType.trim()) {
      mimeType = body.mimeType.trim();
    }

    if (typeof body.category === 'string') {
      category = body.category;
    }

    if (body.isPrivate !== undefined && body.isPrivate !== null) {
      if (typeof body.isPrivate === 'boolean') {
        isPrivate = body.isPrivate;
      } else if (typeof body.isPrivate === 'string') {
        const normalized = body.isPrivate.trim().toLowerCase();
        isPrivate = !['false', '0', 'no', 'off'].includes(normalized);
      }
    }

    if (body.buildiumCategoryId !== undefined && body.buildiumCategoryId !== null) {
      const numeric = Number(body.buildiumCategoryId);
      if (Number.isFinite(numeric)) {
        buildiumCategoryIdInput = numeric;
      }
    }

    if (typeof body.description === 'string' && body.description.trim()) {
      description = body.description.trim();
    }

    if (typeof body.base64 === 'string' && body.base64.trim()) {
      const raw = body.base64.includes(',') ? body.base64.split(',')[1] : body.base64;
      normalizedBase64 = raw ?? null;
      if (!normalizedBase64) {
        return NextResponse.json({ error: 'Invalid base64 payload' }, { status: 400 });
      }
      try {
        const buffer = Buffer.from(normalizedBase64, 'base64');
        uploadBlob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
      } catch {
        return NextResponse.json({ error: 'Invalid base64 payload' }, { status: 400 });
      }
    }
  }

  if (!entityType || entityIdValue === null || entityIdValue === undefined) {
    return NextResponse.json({ error: 'Missing entity details' }, { status: 400 });
  }

  if (!uploadBlob) {
    return NextResponse.json({ error: 'File data is required' }, { status: 400 });
  }

  let entityId: string | number;
  if (typeof entityIdValue === 'number') {
    entityId = entityIdValue;
  } else {
    const trimmed = entityIdValue.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Missing entity id' }, { status: 400 });
    }
    const numeric = Number(trimmed);
    entityId = Number.isFinite(numeric) && trimmed === String(numeric) ? numeric : trimmed;
  }

  let fileName = sanitizeFileName(
    fileNameInput ??
      (uploadBlob instanceof File && uploadBlob.name ? uploadBlob.name : 'upload'),
  );
  if (
    !fileName.includes('.') &&
    uploadBlob instanceof File &&
    typeof uploadBlob.name === 'string' &&
    uploadBlob.name.includes('.')
  ) {
    fileName = `${fileName}.${uploadBlob.name.split('.').pop()}`;
  }

  mimeType =
    mimeType && mimeType.trim()
      ? mimeType.trim()
      : uploadBlob.type && uploadBlob.type !== ''
        ? uploadBlob.type
        : undefined;

  if (!isMimeTypeAllowed(mimeType)) {
    return NextResponse.json(
      {
        error: 'Unsupported file type. Allowed formats: PDF, images, and Office documents.',
      },
      { status: 400 },
    );
  }

  if (typeof category === 'string') {
    const trimmedCategory = category.trim();
    category = trimmedCategory.length ? trimmedCategory : null;
  } else {
    category = null;
  }
  if (typeof description === 'string') {
    const trimmedDescription = description.trim();
    description = trimmedDescription.length ? trimmedDescription : null;
  } else {
    description = null;
  }

  const sizeBytes = uploadBlob.size;
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: 'File exceeds the 25 MB upload limit.' },
      { status: 413 },
    );
  }

  // PRIORITY: Always use the entity's org_id if available (this is the most accurate)
  // The entity (property/unit/etc.) belongs to a specific org, and we should use that org
  let orgId = await resolveOrgForEntity(admin, entityType, entityId);
  if (entityType === 'bill') {
    const { data: billRow } = await admin
      .from('transactions')
      .select('buildium_bill_id, org_id')
      .eq('id', toStringId(entityId))
      .maybeSingle();
    if (billRow) {
      if (!orgId && billRow.org_id) {
        orgId = billRow.org_id;
      }
    }
  }

  // If entity doesn't have an org_id, fall back to user context resolution
  // This matches the list route's behavior for consistency
  if (!orgId) {
    const normalizeOrgId = (value: unknown): string | null => {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
      return null;
    };

    // Check headers and cookies first
    orgId = request.headers.get('x-org-id') || request.cookies.get('x-org-id')?.value || null;

    // If still no org, check user metadata
    if (!orgId) {
      const userMeta = (user.user_metadata ?? undefined) as Record<string, unknown> | undefined;
      const userAppMeta = (user.app_metadata ?? undefined) as Record<string, unknown> | undefined;
      const userOrgIds = Array.isArray(userMeta?.['org_ids'])
        ? (userMeta['org_ids'] as unknown[])
        : [];
      const userAppOrgIds = Array.isArray(userAppMeta?.['org_ids'])
        ? (userAppMeta['org_ids'] as unknown[])
        : [];

      orgId = normalizeOrgId(
        userMeta?.default_org_id ||
          userAppMeta?.default_org_id ||
          userMeta?.org_id ||
          userAppMeta?.org_id ||
          userOrgIds[0] ||
          userAppOrgIds[0],
      );
    }

    // If still no org, check org_memberships (for real users with valid UUIDs)
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    if (!orgId && isValidUUID(user.id) && supabaseAdminMaybe) {
      const { data: rows } = await supabaseAdminMaybe
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);
      orgId = normalizeOrgId((rows?.[0] as Record<string, unknown> | undefined)?.org_id);
    }

    // Last resort: fall back to first org (only in non-production)
    // This should rarely happen if entity has org_id, which it should
    if (!orgId && process.env.NODE_ENV !== 'production' && supabaseAdminMaybe) {
      const { data: orgRow } = await supabaseAdminMaybe
        .from('organizations')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      orgId = normalizeOrgId(orgRow?.id);
    }
  }

  if (!orgId)
    return NextResponse.json(
      { error: 'Unable to resolve org for entity or user context' },
      { status: 400 },
    );

  const claimedOrgIds = new Set<string>();
  const addClaim = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      claimedOrgIds.add(value.trim());
    }
  };
  const claimArray = (values: unknown) => {
    if (Array.isArray(values)) {
      values.forEach(addClaim);
    }
  };

  const userMeta = (user.user_metadata ?? undefined) as Record<string, unknown> | undefined;
  const userAppMeta = (user.app_metadata ?? undefined) as Record<string, unknown> | undefined;
  addClaim(userMeta?.default_org_id);
  addClaim(userAppMeta?.default_org_id);
  addClaim(userMeta?.org_id);
  addClaim(userAppMeta?.org_id);
  claimArray(userMeta?.['org_ids']);
  claimArray(userAppMeta?.['org_ids']);

  let hasMembership = claimedOrgIds.has(orgId);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!hasMembership && uuidRegex.test(user.id) && supabaseAdminMaybe) {
    const { data: membership, error: membershipError } = await supabaseAdminMaybe
      .from('org_memberships')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) {
      logger.warn(
        { error: membershipError.message, orgId, userId: user.id },
        'org membership lookup failed during file upload',
      );
    }
    hasMembership = Boolean(membership);
  }

  if (!hasMembership) {
    return NextResponse.json(
      { error: 'Not authorized for this organization' },
      { status: 403 },
    );
  }

  // Log the resolved org_id for debugging
  if (process.env.NODE_ENV !== 'production') {
    const entityOrgId = await resolveOrgForEntity(admin, entityType, entityId);
    console.log('File upload - resolved org_id:', {
      orgId,
      entityType,
      entityId,
      entityOrgId,
      usingEntityOrg: orgId === entityOrgId,
      userId: user.id,
    });
  }

  const createdBy =
    typeof user.id === 'string' && /^[0-9a-fA-F-]{36}$/.test(user.id) ? user.id : null;

  // Choose bucket
  const bucket = entityType === 'lease' ? 'lease-documents' : 'files';
  // Ensure bucket exists (best-effort)
  try {
    const { data: bInfo } = await admin.storage.getBucket(bucket);
    if (!bInfo) {
      await admin.storage.createBucket(bucket, { public: false });
    }
  } catch {}

  const storageKey = `${entityType}/${entityId}/${Date.now()}-${fileName}`;
  const effectiveMimeType =
    mimeType && mimeType.trim()
      ? mimeType.trim()
      : uploadBlob.type && uploadBlob.type !== ''
        ? uploadBlob.type
        : 'application/octet-stream';
  const { error: uploadErr } = await admin.storage
    .from(bucket)
    .upload(storageKey, uploadBlob, {
      contentType: effectiveMimeType,
      upsert: false,
    });
  if (uploadErr)
    return NextResponse.json(
      { error: 'Upload failed', details: uploadErr.message },
      { status: 500 },
    );
  mimeType = effectiveMimeType === '' ? undefined : effectiveMimeType;

  const ensureBase64 = async () => {
    if (normalizedBase64) {
      return normalizedBase64;
    }
    normalizedBase64 = await blobToBase64(uploadBlob);
    return normalizedBase64;
  };

  // Resolve Buildium entity type and ID for the new schema
  const buildiumEntityInfo = await resolveBuildiumEntityId(admin, entityType, entityId);
  const buildiumEntityType =
    buildiumEntityInfo?.buildiumEntityType ?? mapLocalEntityTypeToBuildium(entityType);

  // If we can't map to a Buildium entity type, use a default.
  // For entities without direct Buildium mapping, use PublicAsset as fallback.
  const finalBuildiumEntityType: BuildiumFileEntityType = buildiumEntityType ?? 'PublicAsset';
  const fileEntityType = mapBuildiumEntityTypeToFile(finalBuildiumEntityType);

  // For local entities without Buildium IDs, use -1 as a sentinel value
  // This allows files to be stored for local entities that haven't been synced to Buildium yet
  // The application code should handle this case when querying/filtering files
  const finalEntityId = buildiumEntityInfo?.buildiumEntityId ?? -1;
  const buildiumEntityId = buildiumEntityInfo?.buildiumEntityId ?? null;

  const requestedCategoryName =
    typeof category === 'string' && category.trim().length > 0 ? category.trim() : null;

  let resolvedCategoryName = requestedCategoryName;
  let buildiumCategoryId: number | null = null;

  if (buildiumCategoryIdInput !== undefined && buildiumCategoryIdInput !== null) {
    const numericId = Number(buildiumCategoryIdInput);
    if (Number.isFinite(numericId)) {
      const { data: categoryRecord } = await admin
        .from('file_categories')
        .select('buildium_category_id, category_name')
        .eq('org_id', orgId)
        .eq('buildium_category_id', numericId)
        .maybeSingle();
      if (categoryRecord?.buildium_category_id) {
        buildiumCategoryId = categoryRecord.buildium_category_id;
        resolvedCategoryName = categoryRecord.category_name ?? resolvedCategoryName;
      }
    }
  }

  if (buildiumCategoryId === null && resolvedCategoryName) {
    const { data: categoryRecord } = await admin
      .from('file_categories')
      .select('buildium_category_id, category_name')
      .eq('org_id', orgId)
      .ilike('category_name', resolvedCategoryName)
      .maybeSingle();
    if (categoryRecord?.buildium_category_id) {
      buildiumCategoryId = categoryRecord.buildium_category_id;
      resolvedCategoryName = categoryRecord.category_name ?? resolvedCategoryName;
    }
  }

  // Insert file row with new schema (entity_type and entity_id directly)
  let fileRow: FileRow;
  try {
    fileRow = await createFile(admin, {
      org_id: orgId,
      file_name: fileName,
      title: fileName,
      description: description ?? null,
      mime_type: mimeType || null,
      size_bytes: sizeBytes,
      entity_type: fileEntityType,
      entity_id: finalEntityId,
      buildium_category_id: buildiumCategoryId,
      storage_provider: 'supabase',
      bucket,
      storage_key: storageKey,
      is_private: isPrivate ?? true,
      created_by: createdBy,
      buildium_entity_type: finalBuildiumEntityType,
      buildium_entity_id: buildiumEntityId,
    });
  } catch (fileErr: unknown) {
    const fileErrRecord = fileErr as Record<string, unknown>;
    const message =
      typeof fileErrRecord?.message === 'string'
        ? fileErrRecord.message
        : fileErr instanceof Error
          ? fileErr.message
          : 'Unknown error';
    console.error(
      'createFile failed',
      JSON.stringify(
        {
          error: message,
          details: fileErrRecord?.details,
          hint: fileErrRecord?.hint,
          category: resolvedCategoryName,
          buildiumCategoryId,
          fileEntityType,
          buildiumEntityType: finalBuildiumEntityType,
          entityId: finalEntityId,
        },
        null,
        2,
      ),
    );
    return NextResponse.json(
      {
        error: 'Failed to create file record',
        details: message,
      },
      { status: 500 },
    );
  }

  let latestFileRow: FileRow = fileRow;
  let buildiumSync: BuildiumFileSyncResult | null = null;
  if (entityType === 'bill') {
    const base64ForSync = await ensureBase64();
    buildiumSync = await maybeUploadBillFileToBuildium({
      admin,
      transactionId: entityId,
      fileId: fileRow.id as string,
      fileName,
      mimeType,
      base64: base64ForSync,
    });
    if (buildiumSync?.updatedFile) {
      latestFileRow = buildiumSync.updatedFile;
    }
  } else if (entityType === 'lease') {
    const base64ForSync = await ensureBase64();
    buildiumSync = await uploadLeaseDocumentToBuildium({
      admin,
      leaseId: entityId,
      fileId: fileRow.id as string,
      fileName,
      mimeType,
      base64: base64ForSync,
      category: resolvedCategoryName,
      buildiumCategoryId,
    });
    if (buildiumSync?.updatedFile) {
      latestFileRow = buildiumSync.updatedFile;
    }
  } else if (buildiumEntityInfo && typeof buildiumEntityId === 'number' && Number.isFinite(buildiumEntityId) && buildiumEntityId > 0) {
    const base64ForSync = await ensureBase64();
    buildiumSync = await uploadFileToBuildiumEntity({
      admin,
      file: fileRow,
      fileName,
      mimeType,
      base64: base64ForSync,
      buildiumEntityType: buildiumEntityInfo.buildiumEntityType,
      buildiumEntityId,
      buildiumCategoryId,
      categoryName: resolvedCategoryName,
    });
    if (buildiumSync?.updatedFile) {
      latestFileRow = buildiumSync.updatedFile;
    }
  }

  return NextResponse.json(
    {
      file: latestFileRow,
      entityType: latestFileRow?.entity_type ?? fileEntityType,
      entityId: latestFileRow?.entity_id ?? finalEntityId,
      buildiumFile: buildiumSync?.buildiumFile ?? null,
      buildiumFileId: buildiumSync?.buildiumFile?.Id ?? null,
      buildiumSyncError: buildiumSync?.error ?? null,
      buildiumEntityType: finalBuildiumEntityType,
    },
    { status: 201 },
  );
}
