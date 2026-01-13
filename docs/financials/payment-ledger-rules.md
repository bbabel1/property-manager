# Payment ledger mapping rules

- Payment lines that post directly to income or security-deposit liability stay visible on cash via a cash credit. Each also adds a non-cash balancing debit on the same GL account and a non-cash A/R credit to clear the receivable side.
- Bank or undeposited-funds debits are sized by the transaction total so that payment inflows always hit cash, even when Buildium omits bank GL lines.
- Cash basis filtering only drops the non-cash balancing debits (income/liability) and A/R, leaving the cash credit + bank/UDF lines visible. Accrual still hides payment-to-income lines to avoid double-counting revenue.
- Regression guardrails: the mapper + ledger-utils tests cover rent, deposit, and mixed payments on both bases plus a rent/deposit snapshot. Run `npm run test -- src/lib/__tests__/buildium-mappers.test.ts src/server/financials/__tests__/ledger-utils.test.ts src/server/financials/__tests__/ledger-payment-regressions.test.ts tests/finance.model.test.ts` after any GL mapping or cash/accrual filter changes.
- Backfills and rebuilds should call the `replace_transaction_lines` RPC so lines are written atomically with balance validation (see `scripts/backfill-missing-bank-lines.ts` for the pattern).
