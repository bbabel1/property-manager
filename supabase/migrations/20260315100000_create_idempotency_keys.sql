-- Create idempotency_keys table to support safe replay of write APIs (e.g., lease creation)
create table if not exists public.idempotency_keys (
  key text primary key,
  org_id uuid,
  response jsonb,
  created_at timestamptz default now() not null,
  last_used_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '24 hours') not null
);

create index if not exists idx_idempotency_keys_org_key on public.idempotency_keys(org_id, key);
create index if not exists idx_idempotency_keys_expires_at on public.idempotency_keys(expires_at);

comment on table public.idempotency_keys is 'Stores idempotent responses for write APIs keyed by a client-supplied Idempotency-Key and scoped to org_id.';
comment on column public.idempotency_keys.key is 'Client-provided idempotency key (Idempotency-Key header).';
comment on column public.idempotency_keys.org_id is 'Organization scope for the idempotent response.';
comment on column public.idempotency_keys.response is 'JSON response payload returned to the client for this key.';
comment on column public.idempotency_keys.expires_at is 'Timestamp when the cached response expires and can be pruned.';
