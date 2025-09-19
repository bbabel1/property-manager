-- Trial balance and account activity reporting

-- View: v_gl_trial_balance (all-time)
CREATE OR REPLACE VIEW public.v_gl_trial_balance AS
SELECT 
  ga.id AS gl_account_id,
  ga.buildium_gl_account_id,
  ga.account_number,
  ga.name,
  ga.type,
  ga.sub_type,
  COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0)::numeric AS debits,
  COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0)::numeric AS credits,
  (COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0))::numeric AS balance
FROM public.gl_accounts ga
LEFT JOIN public.transaction_lines tl ON tl.gl_account_id = ga.id
GROUP BY ga.id, ga.buildium_gl_account_id, ga.account_number, ga.name, ga.type, ga.sub_type;

-- Function: gl_trial_balance_as_of(date)
CREATE OR REPLACE FUNCTION public.gl_trial_balance_as_of(p_as_of_date date)
RETURNS TABLE(
  gl_account_id uuid,
  buildium_gl_account_id integer,
  account_number text,
  name text,
  type text,
  sub_type text,
  debits numeric,
  credits numeric,
  balance numeric
) AS $$
  SELECT 
    ga.id,
    ga.buildium_gl_account_id,
    ga.account_number,
    ga.name,
    ga.type,
    ga.sub_type,
    COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0)::numeric AS debits,
    COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0)::numeric AS credits,
    (COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0) -
     COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0))::numeric AS balance
  FROM public.gl_accounts ga
  LEFT JOIN public.transaction_lines tl 
    ON tl.gl_account_id = ga.id AND tl.date <= p_as_of_date
  GROUP BY ga.id, ga.buildium_gl_account_id, ga.account_number, ga.name, ga.type, ga.sub_type
  ORDER BY ga.account_number NULLS FIRST, ga.name;
$$ LANGUAGE sql STABLE;

-- Function: gl_account_activity(p_from, p_to)
CREATE OR REPLACE FUNCTION public.gl_account_activity(p_from date, p_to date)
RETURNS TABLE(
  gl_account_id uuid,
  account_number text,
  name text,
  debits numeric,
  credits numeric,
  net_change numeric
) AS $$
  SELECT 
    ga.id,
    ga.account_number,
    ga.name,
    COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0)::numeric AS debits,
    COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0)::numeric AS credits,
    (COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0) -
     COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0))::numeric AS net_change
  FROM public.gl_accounts ga
  LEFT JOIN public.transaction_lines tl 
    ON tl.gl_account_id = ga.id AND tl.date >= p_from AND tl.date <= p_to
  GROUP BY ga.id, ga.account_number, ga.name
  ORDER BY ga.account_number NULLS FIRST, ga.name;
$$ LANGUAGE sql STABLE;

