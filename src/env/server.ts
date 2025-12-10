import { z } from 'zod';

const ServerEnv = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  BUILDIUM_BASE_URL: z.string().url(),
  BUILDIUM_CLIENT_ID: z.string().min(3),
  BUILDIUM_CLIENT_SECRET: z.string().min(8),
  BUILDIUM_WEBHOOK_SECRET: z.string().min(16),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // Email service (optional but recommended for monthly statements)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  // Company info (optional, used in PDF statements)
  COMPANY_NAME: z.string().optional(),
  COMPANY_ADDRESS: z.string().optional(),
  COMPANY_PHONE: z.string().optional(),
  COMPANY_EMAIL: z.string().email().optional(),
  COMPANY_LOGO_URL: z.string().url().optional(),
  // NYC data integrations (optional)
  NYC_GEOSERVICE_API_KEY: z.string().optional(),
  NYC_GEOSERVICE_BASE_URL: z.string().url().optional(),
  NYC_OPEN_DATA_APP_TOKEN: z.string().optional(),
  NYC_OPEN_DATA_BASE_URL: z.string().url().optional(),
});

export const env = ServerEnv.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  BUILDIUM_BASE_URL: process.env.BUILDIUM_BASE_URL,
  BUILDIUM_CLIENT_ID: process.env.BUILDIUM_CLIENT_ID,
  BUILDIUM_CLIENT_SECRET: process.env.BUILDIUM_CLIENT_SECRET,
  BUILDIUM_WEBHOOK_SECRET: process.env.BUILDIUM_WEBHOOK_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  COMPANY_NAME: process.env.COMPANY_NAME,
  COMPANY_ADDRESS: process.env.COMPANY_ADDRESS,
  COMPANY_PHONE: process.env.COMPANY_PHONE,
  COMPANY_EMAIL: process.env.COMPANY_EMAIL,
  COMPANY_LOGO_URL: process.env.COMPANY_LOGO_URL,
  NYC_GEOSERVICE_API_KEY: process.env.NYC_GEOSERVICE_API_KEY,
  NYC_GEOSERVICE_BASE_URL: process.env.NYC_GEOSERVICE_BASE_URL,
  NYC_OPEN_DATA_APP_TOKEN: process.env.NYC_OPEN_DATA_APP_TOKEN,
  NYC_OPEN_DATA_BASE_URL: process.env.NYC_OPEN_DATA_BASE_URL,
});

export type ServerEnvType = z.infer<typeof ServerEnv>;
