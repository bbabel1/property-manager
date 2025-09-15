import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumPropertyImageUploadSchema, BuildiumPropertyImageOrderUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { supabase, supabaseAdmin } from '@/lib/db'

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

  async function uploadLocalImage(propertyId: string, fileName: string, base64: string) {
  const db = supabaseAdmin || supabase
  if (!db) throw new Error('LOCAL_UPLOAD_UNAVAILABLE')
  const bucket = 'property-images'
  try { await (db as any).storage.createBucket(bucket, { public: true }) } catch {}
  const ext = fileName.includes('.') ? fileName.split('.').pop() : 'jpg'
  const stamp = new Date().toISOString().replace(/[:.]/g, '')
  const path = `${propertyId}/${stamp}-${Math.random().toString(36).slice(2)}.${ext}`
  const contentType = guessContentType(fileName)
  const bytes = Buffer.from(base64, 'base64')
  const { error: upErr } = await db.storage.from(bucket).upload(path, bytes, { contentType, upsert: true })
  if (upErr) throw upErr
  const { data: urlData } = db.storage.from(bucket).getPublicUrl(path)
  const url = urlData?.publicUrl || null
  // Persist metadata
  try {
    await (db as any)
      .from('property_images')
      .insert({
        property_id: propertyId,
        buildium_image_id: null,
        name: fileName,
        description: null,
        file_type: contentType,
        file_size: bytes.length,
        is_private: false,
        href: url,
        sort_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
  } catch {}
  return { storage: 'supabase', path, url }
}

async function resolveBuildiumPropertyId(idOrUuid: string): Promise<number> {
  // If it's already a number string, return it
  if (/^\d+$/.test(idOrUuid)) return Number(idOrUuid)
  // Otherwise resolve from local UUID via DB
  const db = supabaseAdmin || supabase
  const { data } = await db
    .from('properties')
    .select('buildium_property_id')
    .eq('id', idOrUuid)
    .maybeSingle()
  const n = (data as any)?.buildium_property_id
  if (typeof n === 'number' && Number.isFinite(n)) return n
  throw new Error('BUILDIMUM_PROPERTY_ID_NOT_FOUND')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication (cookie-aware)
    const user = await requireUser(request);

    const { id } = await params;
    let buildiumId: number | null = null
    try { buildiumId = await resolveBuildiumPropertyId(id) } catch (e) {
      if ((e as Error)?.message !== 'BUILDIMUM_PROPERTY_ID_NOT_FOUND') throw e
    }

    // Make request to Buildium API
    if (!buildiumId) {
      // Fallback to local storage listing
      const db = supabaseAdmin || supabase
      if (!db) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      const bucket = 'property-images'
      const { data: files, error: listErr } = await db.storage.from(bucket).list(`${id}`, { sortBy: { column: 'updated_at', order: 'desc' } as any })
      if (listErr || !Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ success: true, data: [], count: 0 })
      }
      const { data: urlData } = db.storage.from(bucket).getPublicUrl(`${id}/${files[0].name}`)
      const url = urlData?.publicUrl || null
      return NextResponse.json({ success: true, data: url ? [{ Href: url, Name: files[0].name }] : [], count: url ? 1 : 0 })
    }
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/${buildiumId}/images`;
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });
    let images: BuildiumPropertyImage[] = []
    if (!response.ok) {
      // Fallback to DB-backed list first
      const db = supabaseAdmin || supabase
      if (db) {
        const { data: rows } = await db
          .from('property_images')
          .select('href,name')
          .eq('property_id', id)
          .order('updated_at', { ascending: false })
        if (Array.isArray(rows) && rows.length > 0) {
          images = rows
            .filter(r => r.href)
            .map(r => ({ Id: 0, Href: r.href as string, Name: (r as any).name || 'Image' } as BuildiumPropertyImage))
        } else {
          const bucket = 'property-images'
          const { data: files } = await db.storage.from(bucket).list(`${id}`, { sortBy: { column: 'updated_at', order: 'desc' } as any })
          if (Array.isArray(files) && files.length > 0) {
            const { data: urlData } = db.storage.from(bucket).getPublicUrl(`${id}/${files[0].name}`)
            const url = urlData?.publicUrl || null
            if (url) images = [{ Id: 0, Href: url, Name: files[0].name } as BuildiumPropertyImage]
          }
        }
      }
    } else {
      const parsed = await response.json().catch(() => []) as BuildiumPropertyImage[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        images = parsed
      } else {
        // Buildium returned 200 but no images; try DB/storage fallback
      const db = supabaseAdmin || supabase
      if (db) {
        const { data: rows } = await db
            .from('property_images')
            .select('href,name')
            .eq('property_id', id)
            .order('updated_at', { ascending: false })
        if (Array.isArray(rows) && rows.length > 0) {
          images = rows
            .filter(r => r.href)
            .map(r => ({ Id: 0, Href: r.href as string, Name: (r as any).name || 'Image' } as BuildiumPropertyImage))
        } else {
          const bucket = 'property-images'
          const { data: files } = await db.storage.from(bucket).list(`${id}`, { sortBy: { column: 'updated_at', order: 'desc' } as any })
          if (Array.isArray(files) && files.length > 0) {
            const { data: urlData } = db.storage.from(bucket).getPublicUrl(`${id}/${files[0].name}`)
            const url = urlData?.publicUrl || null
            if (url) images = [{ Id: 0, Href: url, Name: files[0].name } as BuildiumPropertyImage]
          }
        }
      }
      }
    }

    // Persist first image URL for faster server-side reads next time
    try {
      const first = Array.isArray(images) && images.length ? (images[0] as any) : null
      const href = first?.Href || first?.Url || null
      if (href) {
        const db = supabaseAdmin || supabase
        if (db) {
          await db.from('property_images').delete().eq('property_id', id)
          await db.from('property_images').insert({
            property_id: id,
            buildium_image_id: first?.Id ?? null,
            name: first?.Name ?? null,
            description: null,
            file_type: null,
            file_size: null,
            is_private: false,
            href,
            sort_index: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
        }
      }
    } catch {}

    logger.info(`Buildium property images fetched successfully`);

    return new NextResponse(JSON.stringify({
      success: true,
      data: images,
      count: images.length,
    }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const status = msg === 'BUILDIMUM_PROPERTY_ID_NOT_FOUND' ? 400 : 500
    logger.error({ error: msg }, `Error fetching Buildium property images`);

    return NextResponse.json(
      { error: status === 400 ? 'Unknown property mapping to Buildium (buildium_property_id missing)' : 'Internal server error' },
      { status }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication (cookie-aware)
    const user = await requireUser(request);

    const { id } = await params;
    let buildiumId: number | null = null
    try { buildiumId = await resolveBuildiumPropertyId(id) } catch (e) {
      if ((e as Error)?.message !== 'BUILDIMUM_PROPERTY_ID_NOT_FOUND') throw e
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyImageUploadSchema);

    // Make request to Buildium API
    if (!buildiumId) {
      // Enforce one-image-per-property for local storage fallback
      try {
        const db = supabaseAdmin || supabase
        if (db) {
          await db.from('property_images').delete().eq('property_id', id)
          const bucket = 'property-images'
          const { data: files } = await db.storage.from(bucket).list(`${id}`)
          if (Array.isArray(files)) {
            for (const f of files) {
              await db.storage.from(bucket).remove([`${id}/${f.name}`])
            }
          }
        }
      } catch {}
      // Fallback: store image in Supabase Storage
      const fileName = (validatedData as any).FileName as string
      const base64 = (validatedData as any).FileData as string
      const result = await uploadLocalImage(id, fileName, base64)
      return NextResponse.json({ success: true, data: result }, { status: 201 })
    }
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/${buildiumId}/images`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      // Fallback: store in Supabase Storage
      try {
        const fileName = (validatedData as any).FileName as string
        const base64 = (validatedData as any).FileData as string
        const result = await uploadLocalImage(id, fileName, base64)
        logger.info('Stored property image in local storage fallback')
        return NextResponse.json({ success: true, data: result }, { status: 201 })
      } catch (e) {
        const errorData = await response.json().catch(() => ({}))
        logger.error(`Buildium property image upload failed`)
        return NextResponse.json(
          { error: 'Failed to upload property image to Buildium', details: errorData },
          { status: response.status }
        )
      }
    }

    const image = await response.json();

    // Persist to property_images so UI has a single source even when Buildium succeeds
    try {
      const db = supabaseAdmin || supabase
      if (db && image && typeof image === 'object') {
        // one image per property — remove old rows
        await db.from('property_images').delete().eq('property_id', id)
        const row = {
          property_id: id,
          buildium_image_id: (image as any).Id ?? null,
          name: (image as any).Name ?? null,
          description: (image as any).Description ?? null,
          file_type: (image as any).FileType ?? null,
          file_size: (image as any).FileSize ?? null,
          is_private: (image as any).IsPrivate ?? null,
          href: (image as any).Href ?? null,
          sort_index: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        await db.from('property_images').insert(row)
      }
    } catch {}

    logger.info(`Buildium property image uploaded successfully`);

    return NextResponse.json({ success: true, data: image }, { status: 201 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    const status = msg === 'UNAUTHENTICATED' ? 401 : (msg === 'BUILDIMUM_PROPERTY_ID_NOT_FOUND' ? 400 : 500)
    logger.error({ error: msg }, `Error uploading Buildium property image`);

    return NextResponse.json(
      { error: status === 401 ? 'Authentication required' : (status === 400 ? 'Unknown property mapping to Buildium (buildium_property_id missing)' : 'Internal server error') },
      { status }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication (cookie-aware)
    const user = await requireUser(request);

    const { id } = await params;
    const buildiumId = await resolveBuildiumPropertyId(id)

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyImageOrderUpdateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/${buildiumId}/images/order`;
    
    const response = await fetch(buildiumUrl, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium property image order update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update property image order in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const images = await response.json();

    logger.info(`Buildium property image order updated successfully`);

    return NextResponse.json({
      success: true,
      data: images,
      count: images.length,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const status = msg === 'BUILDIMUM_PROPERTY_ID_NOT_FOUND' ? 400 : 500
    logger.error({ error: msg }, `Error updating Buildium property image order`);

    return NextResponse.json(
      { error: status === 400 ? 'Unknown property mapping to Buildium (buildium_property_id missing)' : 'Internal server error' },
      { status }
    );
  }
}
