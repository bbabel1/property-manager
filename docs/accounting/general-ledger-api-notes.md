# General Ledger API Notes

- **Scopes**: General ledger queries should always respect transaction header scope (`property_id` with optional `unit_id`). For multi-property requests, intersect the user’s org memberships with selected properties before querying.
- **Basis**: Use the `basis` query param to select accrual vs cash. Cash basis should filter `transaction_lines.is_cash_posting = true` (already applied in the API).
- **Reporting functions**:
  - `gl_account_activity(property_id, unit_id?, from, to, gl_account_ids?)`
  - `gl_account_activity_cash_basis(property_id, unit_id?, from, to, gl_account_ids?)`
  - `gl_ledger_balance_as_of(property_id, gl_account_id, as_of, unit_id?, exclude_unreconciled?)`
  - `gl_trial_balance_as_of(as_of, property_id?, unit_id?)`
- **Invariants**: Balance sign = Debits - Credits. Debit-normal (Assets/Expenses) go up with positive; Credit-normal (Liabilities/Equity/Revenue) go up with negative. Use business amounts for UI; `total_amount` is the signed net of lines.
- **Posting**: All writes should flow through `post_transaction` (atomic header + lines) and the Posting Engine to ensure idempotency, scope consistency, and balance validation.
