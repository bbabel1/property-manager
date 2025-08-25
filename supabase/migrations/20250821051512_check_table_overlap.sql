-- Check for overlapping columns between contacts and owners tables
-- Migration: 20250821051512_check_table_overlap.sql

-- Create a view to show overlapping columns (redundant in owners)
create or replace view public._owners_contacts_overlap as
select 
    o.column_name,
    o.data_type as owners_data_type,
    c.data_type as contacts_data_type,
    'REMOVE FROM OWNERS' as recommendation
from information_schema.columns o
join information_schema.columns c on c.column_name = o.column_name 
  and c.table_schema = 'public' and c.table_name = 'contacts'
where o.table_schema = 'public' and o.table_name = 'owners'
  and o.column_name not in ('id', 'contact_id', 'created_at', 'updated_at')
order by o.column_name;

-- Create a view to show owners-specific columns (keep these)
create or replace view public._owners_specific_columns as
select 
    column_name,
    data_type,
    'KEEP IN OWNERS' as recommendation
from information_schema.columns 
where table_schema = 'public' and table_name = 'owners'
  and column_name in (
    'id', 'contact_id', 
    'management_agreement_start_date', 'management_agreement_end_date',
    'comment', 'etf_account_type', 'etf_account_number', 'etf_routing_number',
    'created_at', 'updated_at'
  )
order by column_name;

-- Create a view to show all owners columns with recommendations
create or replace view public._owners_column_analysis as
select 
    column_name,
    data_type,
    case 
        when column_name in ('id', 'contact_id', 'created_at', 'updated_at') then 'SYSTEM COLUMN'
        when column_name in ('management_agreement_start_date', 'management_agreement_end_date',
                           'comment', 'etf_account_type', 'etf_account_number', 'etf_routing_number') then 'OWNER-SPECIFIC (KEEP)'
        else 'POTENTIALLY REDUNDANT (CHECK)'
    end as recommendation
from information_schema.columns 
where table_schema = 'public' and table_name = 'owners'
order by column_name;

-- Show the analysis results
-- Run these queries to see the results:
-- select * from public._owners_contacts_overlap;
-- select * from public._owners_specific_columns;
-- select * from public._owners_column_analysis;
