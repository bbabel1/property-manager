---
name: UUID to BIGINT IDs
overview: Migrate all `public` schema tables so their primary key column `id` becomes `BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY`, and update every dependent foreign key, function, policy, route, and Zod schema to use numeric IDs (breaking change).
todos:
  - id: inventory-schema
    content: 'Inventory `public` tables with explicit discovery queries: UUID-vs-BIGINT `id`, all FK dependencies, and all SQL objects (functions/views/triggers/policies) referencing affected columns (via `pg_depend` where possible). Also search for UUIDs stored in JSON/JSONB, check constraints/defaults using UUID generators. Export results (CSV) and produce a topologically-sorted conversion order (parents before children).'
    status: pending
  - id: shadow-bigint-columns
    content: Create migrations to add `id_bigint` identity columns to UUID-id tables and add + backfill bigint shadow FK columns for all references. After backfill, enforce `NOT NULL` + `UNIQUE` on `id_bigint`, add indexes on all new bigint FKs, and run per-table validation checks (NULLs/duplicates/row-count/join equivalence) before proceeding.
    status: pending
  - id: db-logic-migrate
    content: Enumerate and update/replace all SQL objects that parse/return IDs—RPCs, triggers, views, security definer functions, and RLS policies—to use bigint IDs and bigint FK columns (adjust signatures/JSON payload parsing). Drop/recreate as needed against bigint columns before swap.
    status: pending
  - id: swap-and-fks
    content: 'Perform the cutover swap in topologically-sorted dependency order: drop UUID FKs, validate no NULL/orphaned bigint FKs remain, rename bigint columns to canonical names, recreate PKs/FKs/indexes on bigint, ensure `GENERATED ALWAYS AS IDENTITY` + OWNED BY correctness, run a second validation pass, and keep a temporary rollback window with renamed UUID columns if desired.'
    status: pending
  - id: app-cutover
    content: Update Next.js routes/pages and Zod schemas to treat IDs as bigint; add a shared bigint ID schema and replace all UUID assumptions; update all Supabase queries/response types accordingly; add runtime guards where IDs come from headers/query strings; update any cache keys/URL params/serialization that treat IDs as strings; add optional redirects/404 handling for old UUID URLs if you want a softer break.
    status: pending
  - id: regen-types-cleanup
    content: Regenerate `src/types/database.ts`, fix compile issues, and after stabilization drop legacy UUID columns and any no-longer-used UUID-related public-schema objects.
    status: pending
  - id: staging-testing
    content: Validate the migration in staging with a checklist of representative create/update/delete operations and RLS access across key domains; optionally run a small migration-time smoke script to insert rows and verify PK/FK/identity behavior post-swap.
    status: pending
---

# Replace UUID `id` with BIGINT identity (public schema)

## Goals + constraints

- **Scope**: only tables in the `public` schema (per your answer).
- **End state**: every `public.<table>.id` is **`BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY`**.
- **App compatibility**: **numeric IDs everywhere** (URLs, API route params, request payloads, DB queries). You said breaking changes are acceptable.
- **Reality check**: UUID→BIGINT can’t be cast safely; we must **introduce new bigint IDs, backfill, update FKs**, then swap columns.
- **Column order caveat**: renaming `id_bigint → id` does **not** move the column physically; it will remain at the end. If you truly require `id` to be physically first, you must rebuild each table (`CREATE TABLE new (...) AS SELECT ...`, then reapply PK/FKs/indexes/constraints and swap via `ALTER TABLE ... RENAME`). Decide whether logical order in queries is sufficient; otherwise bake table-rebuild work into Phase 3.

## What this touches (based on repo scan)

- **SQL schema + data migration**: many migrations contain UUID usage and FK references.
- PK pattern in initial schema: UUID tables define `"id" "uuid" DEFAULT gen_random_uuid() NOT NULL` and later `... PRIMARY KEY ("id")`.
- You already have **some bigint IDs** (e.g. `public.staff.id`, `public.contacts.id`, `public.lease.id`) in [`supabase/migrations/20240101000001_001_initial_schema.sql`](/Users/brandonbabel/property-manager/supabase/migrations/20240101000001_001_initial_schema.sql).
- There are FK chains like `appliances.unit_id → units.id`, `transactions.lease_id → lease.id`, etc. (see FK block around lines ~3594+ in the same file).
- **TypeScript + Zod**: UUID assumptions exist in API routes and schemas.
- Example: [`src/schemas/lease-api.ts`](/Users/brandonbabel/property-manager/src/schemas/lease-api.ts) hard-validates UUIDs for `property_id`, `unit_id`, `tenant_id`.
- Example: [`src/app/api/properties/route.ts`](/Users/brandonbabel/property-manager/src/app/api/properties/route.ts) treats IDs as `string` UUIDs and joins on `id`.
- Many Next.js routes/pages use `[id]` params (e.g. `src/app/api/properties/[id]/route.ts`, `src/app/(protected)/units/[id]/page.tsx`, etc.).
- **Generated Supabase types**: `src/lib/db.ts` imports `Database` from [`src/types/database.ts`](/Users/brandonbabel/property-manager/src/types/database.ts), which must be regenerated after the schema change.

## Recommended rollout strategy (safe + reversible)

Because this is a cross-cutting change, treat it like a **versioned migration** with a controlled cutover.

### Phase 0 — Inventory and dependency graph (no behavior change)

- Generate a full list of:
- tables where `id` is UUID vs already bigint
- every referencing FK column pointing to those `id`s
- functions/views/triggers/policies referencing those columns
- Additionally inventory:
- UUIDs stored in JSON/JSONB fields (string UUIDs nested in documents)
- check constraints/defaults that generate or validate UUIDs (e.g., `gen_random_uuid()`, `uuid_generate_v4()`, `::uuid` casts)
- Output a dependency graph and a conversion order (parents before children).

#### Phase 0 — Explicit discovery queries (templates)

> Goal: produce a machine-readable inventory you can export to CSV and sort into a migration order.**(a) All `public` tables where `id` is UUID**

```sql
select
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.column_name = 'id'
order by c.table_name;
```

**(b) Every FK pointing to `public.<table>.id`**

```sql
select
  tc.constraint_name,
  tc.table_schema as child_schema,
  tc.table_name as child_table,
  kcu.column_name as child_column,
  ccu.table_schema as parent_schema,
  ccu.table_name as parent_table,
  ccu.column_name as parent_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_schema = 'public'
  and ccu.column_name = 'id'
order by parent_table, child_table, child_column;
```

**(c) Functions/views/triggers/policies depending on affected columns (dependency-based starting point)**> `pg_depend` can help identify objects that depend on table columns, but it won’t catch dynamic SQL / stringly-typed JSON parsing. Use this as a starting point, then augment with repository search.

```sql
-- Starting point: list objects that depend on public tables/columns
select distinct
  n.nspname as dependent_schema,
  c.relname as dependent_relation,
  c.relkind as dependent_kind,
  pg_catalog.pg_get_userbyid(c.relowner) as owner
from pg_depend d
join pg_class c on c.oid = d.objid
join pg_namespace n on n.oid = c.relnamespace
where d.refobjid in (
  select c2.oid
  from pg_class c2
  join pg_namespace n2 on n2.oid = c2.relnamespace
  where n2.nspname = 'public'
)
order by dependent_schema, dependent_relation;
```

**(d) Tables with JSON/JSONB columns that may store UUIDs**

```sql
select
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and c.data_type in ('json', 'jsonb')
order by c.table_name, c.column_name;
```

**(e) Defaults / check constraints that reference UUID generators or UUID casts**

```sql
-- Column defaults
select
  table_schema,
  table_name,
  column_name,
  column_default
from information_schema.columns
where table_schema = 'public'
  and column_default is not null
  and (
    column_default ilike '%gen_random_uuid%'
    or column_default ilike '%uuid_generate%'
    or column_default ilike '%::uuid%'
  )
order by table_name, column_name;

-- Constraints
select
  n.nspname as schema_name,
  cl.relname as table_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and con.contype in ('c', 'p', 'u', 'f')
  and pg_get_constraintdef(con.oid) ilike '%uuid%'
order by table_name, constraint_name;
```

**Export to CSV**: run these queries in your SQL client and export to CSV (or use `\copy (...) to ... csv header` in `psql`) to drive the migration order and track status per table.

### Phase 1 — Add bigint IDs alongside existing UUIDs (dual columns)

For each `public` table whose `id` is UUID:

- Add `id_bigint BIGINT GENERATED ALWAYS AS IDENTITY`.
- Backfill existing rows (`UPDATE ... SET id_bigint = DEFAULT WHERE id_bigint IS NULL`).
- Add `UNIQUE (id_bigint)`.
- After backfill, enforce `id_bigint IS NOT NULL`.

For each FK column `child.<parent>_id uuid` referencing a converted parent:

- Add `child.<parent>_id_bigint bigint` (nullable initially).
- Backfill via join (`UPDATE child SET <parent>_id_bigint = parent.id_bigint FROM parent WHERE child.<parent>_id = parent.id`).
- Add indexes on new bigint FK columns.

#### Phase 1 — Validation gates (before cutover)

Per table / relationship, validate:

- `id_bigint` has **no NULLs** and **no duplicates**.
- Row-count sanity: `select count(*)` unchanged.
- Join equivalence: for each child FK shadow column, the backfilled bigint FK matches the parent bigint for all rows that have a UUID FK.
- No orphaned shadows: any non-null UUID FK must have a non-null bigint FK after backfill.

If you have circular FK relationships, consider temporarily using **DEFERRABLE** FK constraints during validation/cutover to avoid ordering deadlocks (decide based on your dependency graph).

### Phase 2 — Update database logic to use bigint columns

- Update **functions/RPCs** to accept and use bigint IDs.
- You already have examples of bigint work in functions like [`supabase/migrations/20250919000003_108_update_fn_create_lease_aggregate_bigint_and_lock.sql`](/Users/brandonbabel/property-manager/supabase/migrations/20250919000003_108_update_fn_create_lease_aggregate_bigint_and_lock.sql) but it still parses `property_id`/`unit_id` as UUID—these will need to become bigint.
- Update **views**, **triggers**, and **RLS policies** that reference old UUID `id` or UUID FK columns.

#### Phase 2 — Enumeration requirement (don’t miss “stringly-typed” UUIDs)

In addition to dependency-based enumeration, explicitly search and rewrite:

- JSON payload parsing inside SQL functions (UUID strings in JSON keys/values)
- Dynamic SQL (`execute format(...)`) that references `id`/`*_id`
- Security definer functions and RLS policies that cast inputs to UUID

### Phase 3 — Cutover swap (make bigint the canonical `id`)

Per table, in dependency-safe order:

- Drop old FK constraints (UUID-based).
- Drop old UUID FK columns (or keep temporarily renamed for emergency rollback, see below).
- Ensure **no NULL / orphaned bigint FKs** remain before swapping.
- Swap columns:
- rename `id` → `id_uuid_old`
- rename `id_bigint` → `id`
- set `id` as `PRIMARY KEY`
- re-create FKs pointing to bigint `id`
- After all tables are swapped, remove `id_uuid_old` columns (or keep for one deploy if you want an easy rollback window).

#### Phase 3 — Identity / ownership correctness

After `id_bigint → id` rename, verify the column is still **`GENERATED ALWAYS AS IDENTITY`** (not merely a sequence default), and that any underlying sequence is **OWNED BY** the column. Also remove any legacy UUID defaults (e.g., `DEFAULT gen_random_uuid()`) from the now-renamed UUID columns you keep for rollback.

#### Phase 3 — Second validation pass (post-swap)

Repeat the Phase 1 validation gates after recreating PK/FKs/indexes:

- PK uniqueness + not-null
- FK integrity across all bigint FKs
- No lingering UUID FK constraints referencing the old UUID columns

### Phase 4 — Application cutover (URLs, validation, queries)

- **Routes/pages**: update `[id]`/`[logId]`/`[docId]` params to parse as bigint.
- Use `z.coerce.number().int().positive()` (or a shared `IdSchema`) for route params.
- **Zod schemas**: replace `.uuid()` validators with bigint validators.
- E.g. in [`src/schemas/lease-api.ts`](/Users/brandonbabel/property-manager/src/schemas/lease-api.ts), change `property_id`, `unit_id`, `tenant_id` to bigint.
- **Supabase queries**: `.eq('id', ...)` and `.in('id', ...)` values become numbers (or numeric strings if PostgREST coerces; prefer numbers).
- **Response shapes**: ensure anything returning IDs returns numbers (and update any client components expecting strings).

#### Phase 4 — Shared ID schema + runtime guards

- Create a shared bigint ID schema (e.g., `IdSchema = z.coerce.number().int().positive()`).
- Add runtime guards anywhere IDs originate from untyped sources: route params, search params, headers, cookies, or JSON request bodies.
- Update any cache keys / URL serialization that previously assumed IDs are UUID strings.

### Phase 5 — Regenerate DB types + cleanup

- Regenerate [`src/types/database.ts`](/Users/brandonbabel/property-manager/src/types/database.ts) from the updated schema.
- Fix compile issues across `src/`.
- Remove UUID extensions/usage in `public` where no longer needed (optional; keep `uuid-ossp`/`pgcrypto` if used elsewhere).

## Testing / staging validation checklist

After the swap in staging, validate representative flows end-to-end:

- Create/update/delete for key entities (properties, units, leases, transactions) and confirm IDs are numeric and stable.
- Join-heavy pages: leases ↔ units ↔ transactions load correctly.
- RLS: confirm permitted users can read/write as before; confirm forbidden access is still blocked.
- Insert smoke: insert a parent row then a child row referencing it; verify PK/FK integrity and identity auto-generation.

## Downtime/rollback options

- **Lowest risk**: put app in maintenance mode for the cutover window, run migrations, deploy code, then re-enable.
- **Rollback strategy**:
- Keep `id_uuid_old` and `*_id_uuid_old` columns for one release to allow reverting the app while keeping data.
- Keep a migration that can re-point FKs back if needed (only viable if you retained the old columns during the rollback window).

## Implementation notes specific to your repo

- Expect high-impact changes in:
- API routes under `src/app/api/**` (many `[id]` segments)
- protected pages like `src/app/(protected)/units/[id]/page.tsx` and `src/app/(protected)/buildings/[id]/page.tsx`
- Zod schemas: `src/schemas/lease-api.ts`, `src/schemas/buildium.ts`
- any RPC callers that pass entity IDs as UUID strings (e.g. `recordSyncStatus` in `src/app/api/properties/route.ts` uses `entityId: string`).

## Suggested milestones

- **Milestone A**: DB has bigint shadow columns populated + verified.
- **Milestone B**: DB cutover completed (bigint is canonical) in staging.
