export function normalizeBankAccountType(input: string | null | undefined): string | null {
  if (!input) return null

  const normalized = String(input).trim().toLowerCase()

  if (normalized === 'checking' || normalized === 'business checking') return 'checking'
  if (normalized === 'savings' || normalized === 'business savings') return 'savings'
  if (normalized === 'money market' || normalized === 'money_market' || normalized === 'moneymarket') {
    return 'money_market'
  }
  if (
    normalized === 'certificate of deposit' ||
    normalized === 'certificate_of_deposit' ||
    normalized === 'cd' ||
    normalized === 'certificateofdeposit'
  ) {
    return 'certificate_of_deposit'
  }

  return 'checking'
}

