import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  EMAIL_SERVER_HOST: z.string().min(1),
  EMAIL_SERVER_PORT: z.coerce.number().int(),
  EMAIL_SERVER_USER: z.string().email().or(z.string().min(3)),
  EMAIL_SERVER_PASSWORD: z.string().min(8),
  EMAIL_FROM: z.string().email().or(z.string().min(3)),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// Debug environment variables
console.log('🔧 Environment variables debug:', {
  hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  urlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
  anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
  serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
  urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...' || 'undefined',
  anonKeyValue: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...' || 'undefined'
});

// Try to parse environment, but don't throw if validation fails
let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
  console.log('✅ Environment validation successful');
} catch (error) {
  console.warn('❌ Environment validation failed:', error);
  // Provide fallback values for required fields
  env = {
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    NEXTAUTH_SECRET: 'fallback-secret-key-for-development-only',
    EMAIL_SERVER_HOST: 'localhost',
    EMAIL_SERVER_PORT: 587,
    EMAIL_SERVER_USER: 'test@example.com',
    EMAIL_SERVER_PASSWORD: 'password',
    EMAIL_FROM: 'test@example.com',
  } as z.infer<typeof envSchema>;
  console.log('🔄 Using fallback environment values');
}

export { env };
export type Env = z.infer<typeof envSchema>;
