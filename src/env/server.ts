import { z } from 'zod'

const ServerEnv = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  BUILDIUM_BASE_URL: z.string().url(),
  BUILDIUM_CLIENT_ID: z.string().min(3),
  BUILDIUM_CLIENT_SECRET: z.string().min(8),
  BUILDIUM_WEBHOOK_SECRET: z.string().min(16),
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

export const env = ServerEnv.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  BUILDIUM_BASE_URL: process.env.BUILDIUM_BASE_URL,
  BUILDIUM_CLIENT_ID: process.env.BUILDIUM_CLIENT_ID,
  BUILDIUM_CLIENT_SECRET: process.env.BUILDIUM_CLIENT_SECRET,
  BUILDIUM_WEBHOOK_SECRET: process.env.BUILDIUM_WEBHOOK_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
})

export type ServerEnvType = z.infer<typeof ServerEnv>

