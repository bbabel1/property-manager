-- Optimize Query Performance
-- This migration creates materialized views and optimizations to reduce
-- the impact of complex schema introspection queries

-- ============================================================================
-- PART 1: CREATE MATERIALIZED VIEWS FOR COMMON SCHEMA QUERIES
-- ============================================================================

-- Create a materialized view for table information to reduce complex joins
CREATE MATERIALIZED VIEW IF NOT EXISTS public.table_info_cache AS
SELECT 
    c.oid::int8 AS id,
    nc.nspname AS schema,
    c.relname AS name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    pg_total_relation_size(format('%I.%I', nc.nspname, c.relname))::int8 AS bytes,
    pg_size_pretty(pg_total_relation_size(format('%I.%I', nc.nspname, c.relname))) AS size,
    pg_stat_get_live_tuples(c.oid) AS live_rows_estimate,
    pg_stat_get_dead_tuples(c.oid) AS dead_rows_estimate,
    obj_description(c.oid) AS comment
FROM pg_namespace nc
JOIN pg_class c ON nc.oid = c.relnamespace
WHERE c.relkind IN ('r', 'v')
AND NOT pg_is_other_temp_schema(nc.oid)
AND nc.nspname = 'public';

-- Create index on the materialized view for fast lookups
CREATE INDEX IF NOT EXISTS idx_table_info_cache_schema_name 
ON public.table_info_cache (schema, name);

-- ============================================================================
-- PART 2: CREATE MATERIALIZED VIEW FOR COLUMN INFORMATION
-- ============================================================================

-- Create a materialized view for column information
CREATE MATERIALIZED VIEW IF NOT EXISTS public.column_info_cache AS
SELECT 
    c.oid::int8 AS table_id,
    nc.nspname AS schema,
    c.relname AS table_name,
    (c.oid || '.' || a.attnum) AS id,
    a.attnum AS ordinal_position,
    a.attname AS name,
    CASE
        WHEN a.atthasdef THEN pg_get_expr(ad.adbin, ad.adrelid)
        ELSE NULL
    END AS default_value,
    format_type(a.atttypid, NULL) AS data_type,
    t.typname AS format,
    a.attidentity IN ('a', 'd') AS is_identity,
    NOT (a.attnotnull OR t.typtype = 'd' AND t.typnotnull) AS is_nullable,
    col_description(c.oid, a.attnum) AS comment
FROM pg_attribute a
LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
JOIN (pg_class c JOIN pg_namespace nc ON c.relnamespace = nc.oid) ON a.attrelid = c.oid
JOIN pg_type t ON a.atttypid = t.oid
WHERE NOT pg_is_other_temp_schema(nc.oid)
AND a.attnum > 0
AND NOT a.attisdropped
AND c.relkind IN ('r', 'v', 'm', 'f', 'p')
AND nc.nspname = 'public';

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_column_info_cache_table_id 
ON public.column_info_cache (table_id);

-- ============================================================================
-- PART 3: CREATE FUNCTION TO REFRESH MATERIALIZED VIEWS
-- ============================================================================

-- Create a function to refresh the materialized views
CREATE OR REPLACE FUNCTION public.refresh_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.table_info_cache;
    REFRESH MATERIALIZED VIEW public.column_info_cache;
END;
$$;

-- ============================================================================
-- PART 4: CREATE OPTIMIZED VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Create an optimized view for foreign key relationships
CREATE OR REPLACE VIEW public.foreign_key_relationships AS
SELECT 
    c.oid::int8 as id,
    c.conname as constraint_name,
    nsa.nspname as source_schema,
    csa.relname as source_table_name,
    sa.attname as source_column_name,
    nta.nspname as target_table_schema,
    cta.relname as target_table_name,
    ta.attname as target_column_name
FROM pg_constraint c
JOIN (pg_attribute sa
    JOIN pg_class csa on sa.attrelid = csa.oid
    JOIN pg_namespace nsa on csa.relnamespace = nsa.oid
) on sa.attrelid = c.conrelid and sa.attnum = any (c.conkey)
JOIN (pg_attribute ta
    JOIN pg_class cta on ta.attrelid = cta.oid
    JOIN pg_namespace nta on cta.relnamespace = nta.oid
) on ta.attrelid = c.confrelid and ta.attnum = any (c.confkey)
WHERE c.contype = 'f'
AND nsa.nspname = 'public'
AND nta.nspname = 'public';

-- Create an optimized view for primary keys
CREATE OR REPLACE VIEW public.primary_keys AS
SELECT 
    n.nspname as schema,
    c.relname as table_name,
    a.attname as column_name,
    c.oid::int8 as table_id
FROM pg_index i
JOIN pg_class c ON i.indrelid = c.oid
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = any (i.indkey)
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE i.indisprimary
AND n.nspname = 'public';

-- ============================================================================
-- PART 5: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'Optimized query performance with materialized views and optimized views for schema introspection';