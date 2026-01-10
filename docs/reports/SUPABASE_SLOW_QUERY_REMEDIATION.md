# Supabase Slow Query Remediation (January 2026)

## What we saw
- `SELECT name FROM pg_timezone_names` (authenticator): ~36% of total time, 122 calls, full catalog scan each time.
- `pg_meta`-style schema introspection CTEs (tables/columns/procs/fks): ~15% of total time, 122 calls, mostly authenticator.
- `pg_stat_statements` + `index_advisor` dashboard query: ~8% of total time, postgres role.
- Extension/trigger/policy sweeps: 2–4% buckets, postgres role.

## Actions completed in this repo
- Added static timezone API (no DB hit): `src/app/api/timezones/route.ts` serves `all` and `common` lists with cache headers.
- Server-side validation now rejects invalid timezones via cached registry: `src/app/api/profile/route.ts`.
- Tagged direct `pg` pools with `application_name` for attribution: `pm-deposit-service`, `pm-allocation-engine`, `pm-accounting-reversals`.

## Operational steps to run on Supabase (do in prod + staging)
1) **Throttle pg_meta/catalog scans**
   - Avoid keeping Supabase Studio open in prod; use staging for schema browsing.
   - Set PostgREST/pg_meta schema allowlist to only `public`/needed schemas (already in `supabase/config.toml`; mirror in hosted settings).
   - If possible, enable pgBouncer session pooling for pg_meta to reuse catalog plans.

2) **Move expensive dashboards off the hot path**
   - Run the `pg_stat_statements` report nightly with pg_cron: see `supabase/scripts/schedule_slow_query_sampling.sql` (creates `admin.slow_query_samples` and a 03:00 UTC job).
   - Drop `index_advisor` calls unless actively tuning; they add planning overhead.
   - Optional: run `supabase/scripts/flatten_slow_query_samples.sql` to add readable views (`admin.v_slow_query_samples`, `admin.v_slow_query_latest`). Example usage:
     ```sql
     -- Latest run, sorted by total time
     SELECT * FROM admin.v_slow_query_latest LIMIT 50;

     -- 7-day window with a threshold
     SELECT *
     FROM admin.v_slow_query_samples
     WHERE captured_at >= now() - interval '7 days'
       AND total_time_ms > 1000
     ORDER BY captured_at DESC, total_time_ms DESC;
     ```

3) **Cache timezone/options lookups**
   - Point any UI/API timezone dropdowns to the new route (`/api/timezones`) or import `getCommonTimezones`/`getTimezoneNames` directly.
   - If any RPCs still query `pg_timezone_names`, switch them to a small static table or the API above.

4) **Tag and monitor**
   - For any direct `pg`/pgBouncer connection strings, append `?application_name=pm-web` so future logs pinpoint callers.
   - Set a low alert threshold for catalog queries in Supabase monitoring (e.g., catalog queries >5% total time).

## Verification checklist
- After deploying the above, `pg_timezone_names` calls drop to near-zero and catalog CTEs fall below 5% of total time.
- Nightly slow-query capture runs once/day; no interactive dashboard hits `pg_stat_statements` directly.
- New `application_name` tags appear in Supabase logs for server-side pools.
- Core app flows still pass smoke tests (profile update, deposit creation, allocation engine paths).
