export type CreateChargePayload = {
  date: string
  memo: string | null
  allocations: Array<{
    account_id: string
    amount: number
  }>
}

export type CreateChargeResponse = {
  transaction: {
    id: string
    date: string
    transaction_type: string
    total_amount: number
    memo: string | null
    lease_id: number | null
    created_at: string
    updated_at: string
  }
  lines: Array<{
    id: string
    gl_account_id: string | null
    amount: number | null
    posting_type: string
  }>
}
