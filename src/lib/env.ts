import { z } from "zod";

const envSchema = z.object({
  // Supabase Configuration (Required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  
  // Buildium Integration (Optional)
  BUILDIUM_BASE_URL: z.string().url().optional(),
  BUILDIUM_CLIENT_ID: z.string().optional(),
  BUILDIUM_CLIENT_SECRET: z.string().optional(),
  BUILDIUM_API_KEY: z.string().optional(),
  BUILDIUM_WEBHOOK_SECRET: z.string().optional(),
  
  // App Configuration (Required)
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// Debug environment variables
console.log('🔧 Environment variables debug:', {
  hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasBuildium: !!process.env.BUILDIUM_CLIENT_SECRET,
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
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: 'fallback-secret-key-for-development-only',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  } as z.infer<typeof envSchema>;
  console.log('🔄 Using fallback environment values');
}

export { env };
export type Env = z.infer<typeof envSchema>;
