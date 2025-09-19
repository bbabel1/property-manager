-- Additional Query Performance Optimizations
-- This migration adds more optimizations to improve query performance

-- ============================================================================
-- PART 1: CREATE OPTIMIZED FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Create a function to get table statistics efficiently
CREATE OR REPLACE FUNCTION public.get_table_stats(p_schema text DEFAULT 'public')
RETURNS TABLE (
    table_name text,
    row_count bigint,
    total_size text,
    index_size text,
    table_size text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.relname::text as table_name,
        pg_stat_get_live_tuples(c.oid) as row_count,
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
        pg_size_pretty(pg_relation_size(c.oid)) as table_size
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = p_schema
    AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$;

-- Create a function to get foreign key relationships efficiently
CREATE OR REPLACE FUNCTION public.get_foreign_keys(p_schema text DEFAULT 'public')
RETURNS TABLE (
    constraint_name text,
    source_table text,
    source_column text,
    target_table text,
    target_column text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.conname::text as constraint_name,
        csa.relname::text as source_table,
        sa.attname::text as source_column,
        cta.relname::text as target_table,
        ta.attname::text as target_column
    FROM pg_constraint c
    JOIN pg_class csa ON c.conrelid = csa.oid
    JOIN pg_namespace nsa ON csa.relnamespace = nsa.oid
    JOIN pg_attribute sa ON sa.attrelid = c.conrelid AND sa.attnum = ANY(c.conkey)
    JOIN pg_class cta ON c.confrelid = cta.oid
    JOIN pg_namespace nta ON cta.relnamespace = nta.oid
    JOIN pg_attribute ta ON ta.attrelid = c.confrelid AND ta.attnum = ANY(c.confkey)
    WHERE c.contype = 'f'
    AND nsa.nspname = p_schema
    AND nta.nspname = p_schema
    ORDER BY csa.relname, sa.attname;
END;
$$;

-- Create a function to get column information efficiently
CREATE OR REPLACE FUNCTION public.get_table_columns(p_table_name text, p_schema text DEFAULT 'public')
RETURNS TABLE (
    column_name text,
    data_type text,
    is_nullable boolean,
    column_default text,
    is_identity boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.attname::text as column_name,
        format_type(a.atttypid, NULL) as data_type,
        NOT (a.attnotnull OR t.typtype = 'd' AND t.typnotnull) as is_nullable,
        CASE WHEN a.atthasdef THEN pg_get_expr(ad.adbin, ad.adrelid) ELSE NULL END as column_default,
        a.attidentity IN ('a', 'd') as is_identity
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_type t ON a.atttypid = t.oid
    WHERE n.nspname = p_schema
    AND c.relname = p_table_name
    AND a.attnum > 0
    AND NOT a.attisdropped
    ORDER BY a.attnum;
END;
$$;

-- ============================================================================
-- PART 2: CREATE PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- Create a view to monitor slow queries
CREATE OR REPLACE VIEW public.slow_queries AS
SELECT 
    LEFT(query, 100) as query_preview,
    calls,
    ROUND(total_exec_time::numeric, 2) as total_exec_time_ms,
    ROUND(mean_exec_time::numeric, 2) as mean_exec_time_ms,
    ROUND(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 2) AS hit_percent
FROM pg_stat_statements 
WHERE total_exec_time > 1000  -- Queries taking more than 1 second total
ORDER BY total_exec_time DESC;

-- Create a view to monitor table sizes
CREATE OR REPLACE VIEW public.table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW public.index_usage AS
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 10 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ============================================================================
-- PART 3: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'Added additional query performance optimizations including efficient functions and monitoring views';