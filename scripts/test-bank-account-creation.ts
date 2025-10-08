#!/usr/bin/env tsx

console.log('🧪 Testing Bank Account Type Normalization')
console.log('==========================================')

// Copy the normalization function directly to avoid Supabase imports
function normalizeBankAccountType(input: string | null | undefined): string | null {
  if (!input) return null
  
  const normalized = String(input).trim().toLowerCase()
  
  // Map UI values to database enum values
  if (normalized === 'checking' || normalized === 'business checking') return 'checking'
  if (normalized === 'savings' || normalized === 'business savings') return 'savings'
  if (normalized === 'money market' || normalized === 'money_market' || normalized === 'moneymarket') return 'money_market'
  if (normalized === 'certificate of deposit' || normalized === 'certificate_of_deposit' || normalized === 'cd' || normalized === 'certificateofdeposit') return 'certificate_of_deposit'
  
  // Default fallback
  return 'checking'
}

// Test cases from the UI
const testCases = [
  'Checking',
  'Savings', 
  'Money Market',
  'Certificate of Deposit',
  'Business Checking',
  'Business Savings'
]

testCases.forEach(input => {
  const normalized = normalizeBankAccountType(input)
  console.log(`"${input}" → "${normalized}"`)
})

console.log('\n✅ Bank account type normalization test completed!')
console.log('\nExpected database enum values:')
console.log('- checking')
console.log('- savings') 
console.log('- money_market')
console.log('- certificate_of_deposit')