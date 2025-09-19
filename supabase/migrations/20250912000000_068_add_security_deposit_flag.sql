-- Add a flag to identify Security Deposit Liability GL accounts
alter table public.gl_accounts
  add column if not exists is_security_deposit_liability boolean not null default false;

create index if not exists gl_accounts_is_sdl_idx
  on public.gl_accounts (is_security_deposit_liability);

