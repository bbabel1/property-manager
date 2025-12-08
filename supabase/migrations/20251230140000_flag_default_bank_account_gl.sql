-- Flag "Default Bank Account GL" as a bank account
-- This GL account was identified by diagnostics as needing the is_bank_account flag set

update public.gl_accounts
set is_bank_account = true
where id = '3bb4f837-0919-4b70-951c-996aa061faa0'
  and name = 'Default Bank Account GL'
  and is_bank_account = false;

-- Add comment to document the change
comment on column public.gl_accounts.is_bank_account is 
'Indicates whether this GL account represents a bank account. 
Bank accounts are used in property cash balance calculations via transaction_lines.';
