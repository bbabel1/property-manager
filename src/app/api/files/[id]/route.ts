import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client';
import { updateFile } from '@/lib/files';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const supabase = await getSupabaseServerClient();
    const fileId = (await params).id;

    if (!fileId) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    // Access check via RLS
    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fileErr) {
      return NextResponse.json(
        { error: 'File lookup failed', details: fileErr.message },
        { status: 500 },
      );
    }
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const supabase = await getSupabaseServerClient();

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 });
    }
    const admin = requireSupabaseAdmin('files update');

    const fileId = (await params).id;
    if (!fileId) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { title, description, buildiumCategoryId } = body as {
      title?: string;
      description?: string | null;
      buildiumCategoryId?: number | null;
    };

    // Check file exists and user has access
    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('id, org_id, buildium_category_id')
      .eq('id', fileId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fileErr) {
      return NextResponse.json(
        { error: 'File lookup failed', details: fileErr.message },
        { status: 500 },
      );
    }
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Update file
    const updateData: {
      title?: string;
      description?: string | null;
      buildium_category_id?: number | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) {
      updateData.title = title;
    }
    if (description !== undefined) {
      updateData.description = description || null;
    }
    if (buildiumCategoryId !== undefined) {
      updateData.buildium_category_id = buildiumCategoryId || null;
    }

    const updatedFile = await updateFile(admin, fileId, updateData);

    if (!updatedFile) {
      return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
    }

    return NextResponse.json({ success: true, file: updatedFile });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request);
    const supabase = await getSupabaseServerClient();

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 });
    }
    const admin = requireSupabaseAdmin('files delete');

    const fileId = (await params).id;
    if (!fileId) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    // Check file exists and user has access
    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('id, storage_provider, bucket, storage_key, org_id')
      .eq('id', fileId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fileErr) {
      return NextResponse.json(
        { error: 'File lookup failed', details: fileErr.message },
        { status: 500 },
      );
    }
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Soft delete: set deleted_at timestamp
    const { error: deleteErr } = await admin
      .from('files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fileId);

    if (deleteErr) {
      return NextResponse.json(
        { error: 'Failed to delete file', details: deleteErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
