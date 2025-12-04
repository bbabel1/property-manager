import { createServiceClientGetter, ensureFound, validateWithSchema } from '@/modules/shared/supabase-service'

export const getBankingServiceClient = createServiceClientGetter('banking')
export { ensureFound, validateWithSchema }

export * from '@/lib/bank-account-service'
