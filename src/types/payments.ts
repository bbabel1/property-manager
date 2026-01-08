import type { Database } from '@/types/database';

export type PaymentIntentState = Database['public']['Enums']['payment_intent_state_enum'];
export type PaymentIntentRow = Database['public']['Tables']['payment_intent']['Row'];
export type PaymentIntentInsert = Database['public']['Tables']['payment_intent']['Insert'];
export type PaymentRow = Database['public']['Tables']['payment']['Row'];
export type ManualPaymentEventRow = Database['public']['Tables']['manual_payment_events']['Row'];
export type TransactionRow = Database['public']['Tables']['transactions']['Row'];
