-- Migration: Drop vendors.comments column after consolidating on vendors.notes
-- Dependencies: Ensure no application code references vendors.comments before applying.

ALTER TABLE public.vendors
  DROP COLUMN IF EXISTS comments;
