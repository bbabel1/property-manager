import type { Database } from '@/types/database'

type PaymentMethod = Database['public']['Enums']['payment_method_enum']

export const PAYMENT_METHOD_VALUES = [
  'Check',
  'Cash',
  'MoneyOrder',
  'CashierCheck',
  'DirectDeposit',
  'CreditCard',
  'ElectronicPayment',
] as const satisfies readonly PaymentMethod[]

export type PaymentMethodValue = typeof PAYMENT_METHOD_VALUES[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  Check: 'Check',
  Cash: 'Cash',
  MoneyOrder: 'Money order',
  CashierCheck: "Cashier's check",
  DirectDeposit: 'ACH / Direct deposit',
  CreditCard: 'Credit card',
  ElectronicPayment: 'Electronic payment',
}

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_VALUES.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}))
