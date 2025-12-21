import { supabaseAdmin } from '@/lib/db';

type PropertyIdentifier = { internalId: string; publicId: string };

const asIdentifiers = (row: { id?: string; public_id?: string | number | null } | null): PropertyIdentifier | null => {
  if (!row || !row.id) return null;
  const publicId = row.public_id ?? row.id;
  return {
    internalId: String(row.id),
    publicId: String(publicId),
  };
};

/**
 * Resolve a property slug (public_id or internal UUID) to both identifiers.
 * Falls back to the provided slug when no match is found or Supabase admin is unavailable.
 */
export async function resolvePropertyIdentifier(slug: string): Promise<PropertyIdentifier> {
  const fallback = { internalId: slug, publicId: slug };
  if (!supabaseAdmin) return fallback;

  try {
    const { data: byPublic } = await supabaseAdmin
      .from('properties')
      .select('id, public_id')
      .eq('public_id', slug)
      .maybeSingle();
    const resolvedPublic = asIdentifiers(byPublic);
    if (resolvedPublic) return resolvedPublic;

    const { data: byId } = await supabaseAdmin
      .from('properties')
      .select('id, public_id')
      .eq('id', slug)
      .maybeSingle();
    const resolvedId = asIdentifiers(byId);
    if (resolvedId) return resolvedId;

    return fallback;
  } catch {
    return fallback;
  }
}
