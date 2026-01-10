import { Buffer } from 'buffer';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { createFile, FILE_ENTITY_TYPES, mapBuildiumEntityTypeToFile } from '@/lib/files';
import { logger } from '@/lib/logger';
import { getOrgScopedBuildiumClient } from '@/lib/buildium-client';
import type { Database } from '@/types/database';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'files';

type TransactionFilesRow = {
  id: string;
  org_id: string;
  transaction_id: string;
  file_id: string;
  added_by: string | null;
  created_at: string;
  updated_at: string;
};

type TransactionFilesTable = {
  Row: TransactionFilesRow;
  Insert: {
    id?: string;
    org_id: string;
    transaction_id: string;
    file_id: string;
    added_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<TransactionFilesRow>;
  Relationships: [
    {
      foreignKeyName: 'transaction_files_org_id_fkey';
      columns: ['org_id'];
      isOneToOne: false;
      referencedRelation: 'organizations';
      referencedColumns: ['id'];
    },
    {
      foreignKeyName: 'transaction_files_transaction_id_fkey';
      columns: ['transaction_id'];
      isOneToOne: false;
      referencedRelation: 'transactions';
      referencedColumns: ['id'];
    },
    {
      foreignKeyName: 'transaction_files_file_id_fkey';
      columns: ['file_id'];
      isOneToOne: false;
      referencedRelation: 'files';
      referencedColumns: ['id'];
    },
  ];
};

type DatabaseWithTransactionFiles = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      transaction_files: TransactionFilesTable;
    };
  };
};

const supabaseTxFiles = supabaseAdmin as SupabaseClient<DatabaseWithTransactionFiles>;

type TransactionRow = Pick<
  Database['public']['Tables']['transactions']['Row'],
  | 'id'
  | 'org_id'
  | 'buildium_transaction_id'
  | 'transaction_type'
  | 'bank_gl_account_id'
  | 'bank_gl_account_buildium_id'
>;

type TransactionFileWithDetails = TransactionFilesRow & {
  files: Database['public']['Tables']['files']['Row'] | null;
};

async function fetchTransaction(transactionId: string): Promise<TransactionRow | null> {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select(
      'id, org_id, buildium_transaction_id, transaction_type, bank_gl_account_id, bank_gl_account_buildium_id',
    )
    .eq('id', transactionId)
    .maybeSingle();

  if (error) {
    logger.error({ error, transactionId }, 'Failed to load transaction for file attach');
    throw error;
  }
  return (data as TransactionRow | null) ?? null;
}

async function assertOrgMembership(orgId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('org_memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data?.id);
}

function sanitizeFileName(name: string): string {
  if (!name) return 'upload';
  const trimmed = name.trim().replace(/[/\\]/g, ' ');
  return trimmed || 'upload';
}

async function resolveBankAccountBuildiumId(tx: TransactionRow): Promise<number | null> {
  if (typeof tx.bank_gl_account_buildium_id === 'number') return tx.bank_gl_account_buildium_id;
  if (!tx.bank_gl_account_id) return null;
  const { data } = await supabaseAdmin
    .from('gl_accounts')
    .select('buildium_gl_account_id')
    .eq('id', tx.bank_gl_account_id)
    .maybeSingle();
  const val = (data as any)?.buildium_gl_account_id;
  return typeof val === 'number' ? val : null;
}

async function resolveCategory(
  orgId: string,
  category: string | null,
): Promise<{ id: number | null; name: string | null }> {
  const trimmed = category?.trim();
  if (!trimmed) return { id: null, name: null };

  const { data } = await supabaseAdmin
    .from('file_categories')
    .select('buildium_category_id, category_name')
    .eq('org_id', orgId)
    .ilike('category_name', trimmed)
    .maybeSingle();

  if (data?.buildium_category_id) {
    return { id: data.buildium_category_id, name: data.category_name ?? trimmed };
  }

  return { id: null, name: trimmed };
}

type BuildiumUploadRequestResponse = {
  BucketUrl?: string;
  FormData?: Record<string, string>;
  PhysicalFileName?: string;
};

async function uploadCheckFileToBuildium(params: {
  orgId: string;
  bankAccountBuildiumId: number;
  buildiumCheckId: number;
  fileName: string;
  mimeType: string | null;
  buffer: Uint8Array;
}) {
  const client = await getOrgScopedBuildiumClient(params.orgId);
  if (!client) return;

  const meta = await client.makeRequest<BuildiumUploadRequestResponse>(
    'POST',
    `/bankaccounts/${params.bankAccountBuildiumId}/checks/${params.buildiumCheckId}/files/uploadrequests`,
    { FileName: params.fileName.slice(0, 255) },
  );

  const bucketUrl = meta?.BucketUrl;
  const formDataEntries = meta?.FormData;
  const physicalFileName = meta?.PhysicalFileName;
  if (!bucketUrl || !formDataEntries || !physicalFileName) {
    throw new Error('Buildium upload request missing required fields');
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(formDataEntries)) {
    formData.append(key, String(value ?? ''));
  }
  const fileBytes =
    params.buffer instanceof Uint8Array ? params.buffer : new Uint8Array(params.buffer);
  const arrayBufferView = fileBytes.slice(); // BlobPart accepts ArrayBufferView like Uint8Array
  formData.append(
    'file',
    new Blob([arrayBufferView], { type: params.mimeType || 'application/octet-stream' }),
    physicalFileName,
  );

  const res = await fetch(bucketUrl, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Buildium file upload failed: ${res.status} ${text || res.statusText}`);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  const { id: transactionId } = await params;

  const tx = await fetchTransaction(transactionId);
  if (!tx) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const hasAccess = await assertOrgMembership(tx.org_id, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseTxFiles
    .from('transaction_files')
    .select(
      `
        id,
        created_at,
        file_id,
        files:files(
          id,
          file_name,
          title,
          description,
          mime_type,
          size_bytes,
          storage_provider,
          bucket,
          storage_key,
          external_url,
          buildium_file_id,
          buildium_href,
          buildium_category_id,
          created_at,
          created_by
        )
      `,
    )
    .eq('transaction_id', transactionId)
    .eq('org_id', tx.org_id)
    .is('files.deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<TransactionFileWithDetails[]>();

  if (error) {
    logger.error({ error, transactionId }, 'Failed to list transaction files');
    return NextResponse.json({ error: 'Failed to load files' }, { status: 500 });
  }

  const filesData = data ?? [];
  const categoryIds = Array.from(
    new Set(
      filesData
        .map((row) => row.files?.buildium_category_id)
        .filter((id): id is number => typeof id === 'number'),
    ),
  );
  const categoryNameById = new Map<number, string>();
  if (categoryIds.length) {
    const { data: categories } = await supabaseAdmin
      .from('file_categories')
      .select('buildium_category_id, category_name')
      .eq('org_id', tx.org_id)
      .in('buildium_category_id', categoryIds);
    (categories || []).forEach((c: any) => {
      if (typeof c?.buildium_category_id === 'number' && typeof c?.category_name === 'string') {
        categoryNameById.set(c.buildium_category_id, c.category_name);
      }
    });
  }

  const files = filesData.map((row) => {
    const file = row.files;
    const categoryId = typeof file?.buildium_category_id === 'number' ? file.buildium_category_id : null;
    const categoryName = categoryId ? categoryNameById.get(categoryId) ?? null : null;
    return {
      linkId: row.id,
      id: file?.id,
      title: file?.title || file?.file_name || 'File',
      fileName: file?.file_name ?? null,
      mimeType: file?.mime_type ?? null,
      sizeBytes: file?.size_bytes ?? null,
      uploadedAt: file?.created_at ?? row.created_at ?? null,
      uploadedBy: file?.created_by ?? null,
      buildiumFileId: file?.buildium_file_id ?? null,
      buildiumHref: file?.buildium_href ?? null,
      storage: {
        provider: file?.storage_provider ?? null,
        bucket: file?.bucket ?? null,
        key: file?.storage_key ?? null,
        externalUrl: file?.external_url ?? null,
      },
      categoryId,
      category: categoryName ?? 'Uncategorized',
    };
  });

  return NextResponse.json({ data: files });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  const { id: transactionId } = await params;

  const tx = await fetchTransaction(transactionId);
  if (!tx) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const hasAccess = await assertOrgMembership(tx.org_id, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit` }, { status: 400 });
  }

  const providedName = (formData.get('fileName') as string | null) ?? file.name;
  const mimeType = (formData.get('mimeType') as string | null) ?? file.type ?? null;
  const description = (formData.get('description') as string | null) ?? null;
  const title = (formData.get('title') as string | null) ?? providedName ?? file.name;
  const rawCategory = (formData.get('category') as string | null) ?? null;
  const categoryResult = await resolveCategory(tx.org_id, rawCategory);
  const storageKey = `transactions/${transactionId}/${Date.now()}-${sanitizeFileName(providedName)}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadResult = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storageKey, buffer, {
      contentType: mimeType || undefined,
      upsert: false,
    });

  if (uploadResult.error) {
    logger.error({ error: uploadResult.error, transactionId, storageKey }, 'Transaction file upload failed');
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }

  const buildiumEntityId = tx.buildium_transaction_id ?? null;
  const buildiumEntityType = 'Account' as const; // closest available Buildium file entity type
  const fileEntityType = mapBuildiumEntityTypeToFile(buildiumEntityType);

  let fileRow;
  const bankAccountBuildiumId = await resolveBankAccountBuildiumId(tx);
  try {
    fileRow = await createFile(supabaseAdmin as any, {
      org_id: tx.org_id,
      file_name: sanitizeFileName(providedName || file.name),
      title: sanitizeFileName(title || providedName || file.name),
      description,
      mime_type: mimeType || null,
      size_bytes: file.size,
      entity_type: fileEntityType ?? FILE_ENTITY_TYPES.ACCOUNTS,
      entity_id: buildiumEntityId ?? -1,
      buildium_entity_type: buildiumEntityType,
      buildium_entity_id: buildiumEntityId,
      buildium_category_id: categoryResult.id,
      storage_provider: 'supabase',
      bucket: BUCKET,
      storage_key: storageKey,
      is_private: true,
      created_by: user.id,
    });
  } catch (error: any) {
    logger.error({ error, transactionId, storageKey }, 'Failed to create file record for transaction');
    return NextResponse.json({ error: 'Failed to save file record' }, { status: 500 });
  }

  const { error: linkError } = await supabaseTxFiles
    .from('transaction_files')
    .insert({
      org_id: tx.org_id,
      transaction_id: transactionId,
      file_id: fileRow.id,
      added_by: user.id,
    });

  if (linkError) {
    logger.error({ error: linkError, transactionId, fileId: fileRow.id }, 'Failed to link file to transaction');
    return NextResponse.json({ error: 'Failed to link file to transaction' }, { status: 500 });
  }

  if (
    tx.transaction_type?.toLowerCase() === 'check' &&
    typeof buildiumEntityId === 'number' &&
    typeof bankAccountBuildiumId === 'number'
  ) {
    try {
      await uploadCheckFileToBuildium({
        orgId: tx.org_id,
        bankAccountBuildiumId,
        buildiumCheckId: buildiumEntityId,
        fileName: sanitizeFileName(title || providedName || file.name),
        mimeType,
        buffer,
      });
    } catch (err) {
      logger.error(
        { err, transactionId, buildiumEntityId, bankAccountBuildiumId },
        'Buildium check file upload failed',
      );
    }
  }

  return NextResponse.json({
    data: {
      id: fileRow.id,
      title: fileRow.title || fileRow.file_name,
      category: categoryResult.name ?? 'Uncategorized',
      fileName: fileRow.file_name,
      mimeType: fileRow.mime_type,
      sizeBytes: fileRow.size_bytes,
      uploadedAt: fileRow.created_at,
      uploadedBy: fileRow.created_by,
      buildiumFileId: fileRow.buildium_file_id,
      buildiumHref: fileRow.buildium_href,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  const { id: transactionId } = await params;
  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  const tx = await fetchTransaction(transactionId);
  if (!tx) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const hasAccess = await assertOrgMembership(tx.org_id, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: linkRow, error: linkErr } = await supabaseTxFiles
    .from('transaction_files')
    .select('id')
    .eq('transaction_id', transactionId)
    .eq('file_id', fileId)
    .eq('org_id', tx.org_id)
    .maybeSingle();

  if (linkErr) {
    logger.error({ error: linkErr, transactionId, fileId }, 'Failed to lookup transaction file link');
    return NextResponse.json({ error: 'Failed to remove file' }, { status: 500 });
  }

  if (!linkRow) {
    return NextResponse.json({ error: 'File not attached to this transaction' }, { status: 404 });
  }

  const { error: deleteErr } = await supabaseTxFiles
    .from('transaction_files')
    .delete()
    .eq('transaction_id', transactionId)
    .eq('file_id', fileId)
    .eq('org_id', tx.org_id);

  if (deleteErr) {
    logger.error({ error: deleteErr, transactionId, fileId }, 'Failed to unlink transaction file');
    return NextResponse.json({ error: 'Failed to remove file' }, { status: 500 });
  }

  // Soft-delete the file record to hide from other listings.
  await supabaseAdmin
    .from('files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('org_id', tx.org_id);

  return NextResponse.json({ success: true });
}
