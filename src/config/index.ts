import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({ message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  NEXT_PUBLIC_APP_URL: z.string().url({ message: 'NEXT_PUBLIC_APP_URL must be a valid URL' }),

  BUILDIUM_BASE_URL: z.string().url({ message: 'BUILDIUM_BASE_URL must be a valid URL' }),
  BUILDIUM_CLIENT_ID: z.string().min(1, 'BUILDIUM_CLIENT_ID is required'),
  BUILDIUM_CLIENT_SECRET: z.string().min(1, 'BUILDIUM_CLIENT_SECRET is required'),
  BUILDIUM_WEBHOOK_SECRET: z.string().min(1, 'BUILDIUM_WEBHOOK_SECRET is required'),

  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1, 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required'),

  RESEND_API_KEY: optionalString,
  EMAIL_FROM_ADDRESS: optionalString,
  EMAIL_FROM_NAME: optionalString,

  COMPANY_NAME: optionalString,
  COMPANY_ADDRESS: optionalString,
  COMPANY_PHONE: optionalString,
  COMPANY_EMAIL: optionalString,
  COMPANY_LOGO_URL: optionalString,

  SENTRY_DSN: optionalString,
  SENTRY_TRACES_SAMPLE_RATE: optionalString,
  NEXT_PUBLIC_SENTRY_DSN: optionalString,
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: optionalString,

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString,
  OTEL_EXPORTER_OTLP_HEADERS: optionalString,
  OTEL_SERVICE_NAME: optionalString,
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errors = parsedEnv.error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment variables: ${errors}`);
}

export const config = parsedEnv.data;
export type AppConfig = typeof config;
