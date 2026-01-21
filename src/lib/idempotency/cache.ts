type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function cacheIdempotencyKey(
  db: SupabaseClientLike,
  key: string,
  orgId: string,
  response: Record<string, unknown>,
  expiresAt: Date,
) {
  await db.from('idempotency_keys').upsert({
    key,
    org_id: orgId,
    response,
    expires_at: expiresAt.toISOString(),
  });
}
