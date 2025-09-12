export type ReconciliationLog = {
  property_id: string
  bank_account_id: string
  gl_account_id: string
  statement_ending_date: string
  is_finished: boolean
  ending_balance: number | null
  total_checks_withdrawals: number | null
  total_deposits_additions: number | null
  buildium_reconciliation_id: number
}

export function fmtCurrency(n: number | null | undefined) {
  const v = Number(n || 0)
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

