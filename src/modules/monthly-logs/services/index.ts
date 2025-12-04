import { createServiceClientGetter, ensureFound, validateWithSchema } from '@/modules/shared/supabase-service'

export const getMonthlyLogsServiceClient = createServiceClientGetter('monthly-logs')
export { ensureFound, validateWithSchema }

export * from './statement-recipients'
