# Finance Calculation Model

This document defines the single source of truth for how we interpret transactions, classify lines, and calculate balances across the platform. All calculation code must follow these rules.

## Core principles

- **Normal balances**: Assets/Expenses are debit‑normal. Liabilities/Equity/Income are credit‑normal. Debit increases a debit‑normal account; credit increases a credit‑normal account.
- **Banking**: Bank GLs are assets (`is_bank_account = true`). Deposits increase cash (bank debit) and credit an offset account (income or liability). Withdrawals decrease cash (bank credit) and debit the offset.
- **Security deposits**: Held in liability accounts (`is_security_deposit_liability = true` or GL category/subtype for deposits). Credits increase the liability (funds held), debits release/return.
- **Prepayments/advances**: Liability accounts for prepaid rent/fees (subtype/category matches prepay/advance). Credits increase the liability, debits consume/refund it.
- **Available balance**: `cash_balance + security_deposits_and_prepayments - property_reserve`.
- **Authoritative flags**: Prefer GL flags (`is_bank_account`, `is_security_deposit_liability`, `type`, `sub_type`, category). Name-based heuristics are last-resort telemetry only.

## Classification rules

- **Bank line**: `is_bank_account` OR (type=asset AND subtype/category includes cash/bank/checking/operating/trust). Used to compute cash when present.
- **Deposit line**: `is_security_deposit_liability` OR subtype/category includes deposit AND account type is liability.
- **Prepay line**: subtype/category includes prepay/advance AND account type is liability. Do **not** classify generic liabilities as prepay.
- **AR fallback**: AR subtype can be used only as a last resort for balance inference when no bank/payment signal exists.

## Transaction direction

- Use posting type + account normal balance on lines when available.
- Payments/credits/refunds/adjustments/receipts are treated as cash inflows (negative signed amount in ledger; bank debit). Charges/invoices/bills/debits are outflows (positive signed).
- When bank GL lines are missing, payment transactions are used to infer cash; matched deposit/prepay txIds are used to bind payments to liabilities.

## Rollup formula (unit/property level)

Inputs: `transactionLines`, `transactions`, `unitBalances { balance, deposits_held_balance, prepayments_balance }`, `propertyReserve`.
Steps:

1. Classify lines → totals: `bankSigned`, `depositSigned`, `prepaySigned`, `fallbackAR`.
2. Cash precedence (shared for SQL + TS):
   - If bank lines exist **and** `|bank_total| >= |payments_total| * 0.1`, trust bank_total.
   - If bank lines exist but are clearly incomplete (`bank_line_count > 0` **and** `|payments_total| > |bank_total| * 10`), trust payments_total instead.
   - Otherwise fall through to: bank_total if non-zero → payments_total if non-zero → AR fallback if non-zero → base balance.
3. Deposits/prepayments: use classified line totals; if payment transactions reference deposit/prepay txIds, add those amounts.
4. Available: `cash_balance + (normalizeLiability(deposits_held + prepayments)) - reserve`.
5. Never infer cash from liabilities alone when a bank/payment signal exists.

The canonical fixtures for these rules live in `tests/fixtures/finance-cash-balance-spec.json` and are asserted by both the helper and RPC parity tests.

## Outputs

`{ cash_balance, security_deposits, prepayments, reserve, available_balance, as_of, debug }`

- `security_deposits` is liability-signed (credits negative, debits positive). UI renders currency absolute or signed as needed.

## Implementation requirements

- All pages/services must call the shared helper (no ad-hoc `determineSignedAmount` or substring logic elsewhere).
- GL flag hygiene: bank accounts must set `is_bank_account`; deposit liabilities must set `is_security_deposit_liability` or deposit subtype/category.
- Tests must cover: bank-present vs bank-missing, deposit+rent, prepay-only, charges-only, AR-only, misnamed liabilities (should not classify), escrow/tax edge.

## Safeguards

- Lint/check: forbid new `determineSignedAmount` outside the helper.
- Reconciliation: periodic job compares helper rollups vs stored balances; alert on deltas.
- Telemetry: log debug rollup (totals, flags, fallback reasons) behind a flag to audit classification.
