# Accounting Invariants and Sign Conventions

- **Balance sign convention:** Balance = Debits - Credits for all accounts. Debit-normal (Assets/Expenses) increase with positive balance; Credit-normal (Liabilities/Equity/Revenue) increase with negative balance in this convention.
- **Scope per transaction:** A transaction must have a single scope (`property_id`, optional `unit_id`, optional `account_entity_type/id`). All `transaction_lines` must match the header scope. GL accounts remain org-scoped.
- **Idempotent posting:** All posting flows use `post_transaction` to ensure atomic header + lines with optional `idempotency_key`.
- **Locking and reversals:** Locked transactions are immutable; corrections are made via reversals linked through `reversal_of_transaction_id`.
- **Cash vs accrual:** Accrual views consider all lines; cash-basis views use `transaction_lines.is_cash_posting = true`.
- **Business vs GL totals:** `total_amount` is the signed net of lines. UI/business-facing amounts should use absolute business amounts per event (e.g., rent charge amount) rather than relying on net totals. Keep the two concepts distinct in APIs and reporting.
