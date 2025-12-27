# Double-Entry Vulnerabilities

This document will capture known and potential vulnerabilities in the double-entry validation implementation, including:

- Scenarios that could allow unbalanced transactions
- Edge cases around rounding and tolerances
- Failure modes for trigger and function errors
- Operational risks during migrations or backfills

As issues are discovered and mitigations are applied, add concise
entries here so the implementation summary can link to a single
source of truth.

## Known Vulnerabilities (to document)

- Temporary trigger disabling during bulk imports could allow transient imbalance if errors occur mid-transaction.
- Rounding differences when converting to two-decimal currency amounts might allow a penny mismatch; ensure tolerance checks use `DOUBLE_ENTRY_TOLERANCE`.
- Backfill scripts that delete or reinsert lines must recalculate totals or invoke balance validation after completion.
- RPC functions that bypass triggers (e.g., maintenance utilities) should be reviewed to confirm they re-enable validations.

## Mitigations in Place

- `assertTransactionBalanced` enforces debit/credit equality with a 0.01 tolerance and requires both posting types.
- Balance validation trigger on `transaction_lines` blocks unbalanced inserts/updates under normal operations.
- Safe delete function (`delete_transaction_safe`) temporarily disables validation but re-enables it even on error.

## Outstanding Action Items

- Add automated lint/check to block migrations that disable triggers without re-enabling them.
- Extend E2E tests to cover edge cases: zero-amount lines, mixed currencies (if ever added), and floating-point rounding.
- Audit all maintenance scripts for direct table mutations that bypass validation; wrap in safe helpers or RPCs.
