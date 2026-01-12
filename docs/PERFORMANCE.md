# Performance Optimization Guide

## Avoiding Catalog/Introspection Queries

This document outlines strategies to avoid expensive database catalog queries that can consume significant query time.

## Problem

Query performance dashboards often show that most query time is spent on catalog/introspection queries rather than application data queries:

- `SELECT name FROM pg_timezone_names` - Can consume 50%+ of query time
- Schema introspection CTEs (base types, pk/fk references, available extensions)
- RLS/policy audit queries

These queries are typically:
- Run by Supabase dashboard/admin UI
- Triggered by ORM/client library auto-discovery
- Executed during connection establishment
- Part of migration/health check workflows

## Solutions

### 1. Cache Timezone Lists

**Problem**: `SELECT name FROM pg_timezone_names` is expensive and often queried repeatedly.

**Solution**: Use the static timezone list in `src/lib/timezones.ts` instead of querying the database.

```typescript
import { getTimezoneNames, isValidTimezone } from '@/lib/timezones';

// Instead of: SELECT name FROM pg_timezone_names
const timezones = getTimezoneNames();
const isValid = isValidTimezone('America/New_York');
```

**When to update**: If PostgreSQL adds new timezones, update the static list in `src/lib/timezones.ts`.

### 2. Avoid Per-Request Schema Introspection

**Problem**: Catalog queries for base types, pk/fk references, and available extensions are expensive.

**Solution**: 
- Run schema introspection only during migrations or health checks
- Never run catalog queries in hot API paths
- Use Supabase's generated types instead of runtime introspection

**Check for**:
- Queries containing `WITH -- Recursively get the base types`
- Queries checking `pg_available_extensions`
- Queries examining `pg_constraint` or `pg_class` for schema discovery

**If found**: Move to:
- Migration scripts (`supabase/migrations/`)
- Health check endpoints (run on schedule, not per-request)
- One-time setup scripts

### 3. Optimize Connection Lifecycle

**Problem**: Short-lived connections force catalog queries on every connection.

**Solution**:
- Use long-lived connection pools
- Reuse Supabase client instances (already done via module-level exports in `src/lib/db.ts`)
- Use Supabase's connection pooler when available

**Configuration**: See `src/lib/db.ts` for optimized client settings.

### 4. Disable ORM Auto-Discovery

**Problem**: Some ORMs or client libraries auto-load metadata on each connection.

**Solution**:
- If using an ORM, disable schema discovery/auto-loading
- Use Supabase's typed client with pre-generated types
- Enable prepared statement caching if available

**Check**: Review any ORM configuration for:
- `autoLoadMetadata: true` → set to `false`
- `prepareThreshold` → set to enable prepared statements
- Schema discovery on connection → disable

### 5. Move RLS/Policy Audits to Scheduled Jobs

**Problem**: RLS policy audit queries (seen in `statements.query`, `statements.rows` CTEs) run on every request.

**Solution**:
- Precompute policy reports in scheduled jobs
- Store results in a cache table
- Query cached results instead of running audits per-request

**Example**:
```sql
-- Run in scheduled job, not per-request
CREATE TABLE policy_audit_cache (
  id UUID PRIMARY KEY,
  audit_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Monitoring

### Identifying Catalog Queries

Look for queries in performance dashboards that:
- Query `pg_timezone_names`
- Contain recursive CTEs for base types
- Query `pg_available_extensions`
- Examine `pg_constraint`, `pg_class`, `pg_attribute`
- Audit RLS policies (`pg_policies`, `pg_policy`)

### Performance Targets

- Catalog queries should be < 1% of total query time
- Application queries should be > 99% of total query time
- Cache hit rate should be > 95% for frequently accessed data

## Quick Wins

1. **Immediate**: Replace any `pg_timezone_names` queries with `src/lib/timezones.ts`
2. **Immediate**: Audit API routes for catalog queries (grep for `pg_*` system tables)
3. **Short-term**: Move any schema introspection to migrations/health checks
4. **Short-term**: Review connection pooling configuration

## Database Query Observability

- Apply `supabase/scripts/query_observability_views.sql` in non-production first, then production, to:
  - Ensure `pg_stat_statements` is enabled.
  - Create views under `admin.*` for top queries, slow queries, most-called RPC functions, table seq scans, and unused indexes.
- Optional: Apply `supabase/scripts/schedule_slow_query_sampling.sql` and `supabase/scripts/flatten_slow_query_samples.sql` to capture and flatten nightly slow query samples from `pg_stat_statements`.
- Generate evidence reports (run against staging/prod with `DATABASE_URL` set):
  - `npm run db:top-queries` → `docs/database/top-query-shapes.json` (Top 20 query shapes from `pg_stat_statements`, including filters, joins, sort orders, row counts, and call frequency).
  - `npm run db:index-usage` → `docs/database/index-usage-report.json` (Index usage from `pg_stat_user_indexes`, including candidates with `idx_scan = 0`).
  - `npm run db:rls-indexes` → `docs/database/rls-predicate-indexes.json` (RLS predicates vs. scoping-column indexes).

## References

- [Supabase Connection Pooling](https://supabase.com/docs/guides/platform/connection-pooling)
- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
- [WCAG 2.1 Level AA Compliance](../reports/WCAG_COMPLIANCE.md)


