# Data Classification & Retention

Phase 8 goal: make retention and privacy intentional across the app, API, and migrations.

## PII and sensitive fields
- **Contacts/Tenants/Owners/Staff**: names, emails, phone numbers, addresses (`contacts`, `tenants`, `owners`, `staff`, `lease_contacts`).
- **Banking identifiers**: bank account numbers/routing (`gl_accounts.bank_account_number`, `bank_routing_number`, `bank_check_printing_info`), Buildium GL/bank IDs, payment instrument metadata.
- **Auth/session**: user emails, password reset tokens (Supabase auth schema), OAuth tokens (Google), API keys.
- **Files/attachments**: documents may contain PII; URLs/tokens must be treated as sensitive.
- **Audit logs**: `buildium_api_log`, `buildium_integration_audit_log`, `buildium_webhook_events`, `banking_audit_log`, `bill_approval_audit` contain traces of sensitive operations.

### Handling rules
- Prefer server-side access via `supabaseAdmin` for high-risk operations; avoid logging full payloads or secrets.
- Mask/redact PII in logs (especially phone/email/account numbers); only log IDs + high-level context.
- Do not store OAuth tokens or service secrets in user-facing tables; keep them in env/secret storage.
- For searches, avoid `LIKE %term%` on large tables unless backed by an index; prefer keyed lookups or trigram indexes when necessary.

## Retention and pruning
- **Audit/log tables**: `cleanup_audit_logs()` enforces 90d retention for `buildium_api_log` and `buildium_integration_audit_log`, and 30d for processed rows in `buildium_webhook_events` (see `supabase/migrations/20270201004000_audit_log_retention_policies.sql`).
- **Scheduler**: `.github/workflows/cleanup-audit-logs.yml` calls `cleanup_audit_logs` weekly via RPC using the service role key. Configure secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to enable.
- **Manual run**: `SELECT cleanup_audit_logs();` or hit the RPC endpoint with the service role key.
- **Backfills/large deletes**: run during low-traffic windows; prefer partitioning if growth spikes.

## Audit coverage (high-risk actions)
- **Banking and payments**: `banking_audit_log`, `buildium_integration_audit_log`, `bill_approval_audit` capture state changes and sync events; keep these append-only.
- **Ledger changes**: RPCs such as `post_transaction` and related handlers emit audit inserts; ensure callers pass org/user context for traceability.
- **Buildium sync**: `buildium_api_log` and `buildium_webhook_events` retain request/response metadata for troubleshooting; pruned by retention.

## Operational checklist
- Secrets set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for cleanup workflow and manual runs).
- Monitor: use queries in `docs/AUDIT_LOG_MONITORING.md` to validate retention is working weekly.
- Validate schema: run `npm run lint:migrations` to keep migrations ordered and gated.
- Avoid N+1/scan risks: paginate large reads (keyset where possible) and use `.in(...)` batching for related entities.
