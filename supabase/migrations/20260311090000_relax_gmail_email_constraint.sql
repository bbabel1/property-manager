-- Allow Google Workspace domains for Gmail integrations
-- Previously restricted to @gmail.com/@googlemail.com, blocking workspace emails

begin;

alter table public.gmail_integrations
  drop constraint if exists gmail_integrations_email_check;

-- Accept any well-formed email (basic check for local@domain)
alter table public.gmail_integrations
  add constraint gmail_integrations_email_check
  check (email ~* '^[^@\\s]+@[^@\\s]+$');

comment on column public.gmail_integrations.email is
  'Gmail address (Google Workspace allowed; basic local@domain validation)';

commit;
