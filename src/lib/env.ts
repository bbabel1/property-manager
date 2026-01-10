import { z } from 'zod';

const envSchema = z.object({
  // Supabase Configuration (Required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

  // Buildium Integration (Optional)
  BUILDIUM_BASE_URL: z.string().url().optional(),
  BUILDIUM_CLIENT_ID: z.string().optional(),
  BUILDIUM_CLIENT_SECRET: z.string().optional(),
  BUILDIUM_WEBHOOK_SECRET: z.string().optional(),

  // Google OAuth - Gmail Integration (Optional)
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CALENDAR_OAUTH_REDIRECT_URI: z.string().url().optional(),

  // NYC API Integration (Optional)
  NYC_OPEN_DATA_API_KEY: z.string().optional(),
  DOB_NOW_API_BASE_URL: z.string().url().optional().default('https://a810-bisweb.nyc.gov/bisweb/'),
  NYC_OPEN_DATA_BASE_URL: z.string().url().optional().default('https://data.cityofnewyork.us/'),
  NYC_OPEN_DATA_APP_TOKEN: z.string().optional(),
  NYC_GEOSERVICE_API_KEY: z.string().optional(),
  NYC_GEOSERVICE_BASE_URL: z.string().url().optional(),

  // App Configuration (Optional; required only if NextAuth / token encryption are used)
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// Environment variable validation and debugging
export function validateEnvironment() {
  const requiredVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    // Only log warnings in development, not in test mode
    if (process.env.NODE_ENV === 'development') {
      console.log('ℹ️ Missing required environment variables:', missingVars);
      console.log('💡 Ensure these are set in .env.local and restart the dev server');
    }
    return false;
  }

  // Debug info (only in development, not in test mode)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Environment variables debug:');
    console.log('  - hasUrl:', !!requiredVars.NEXT_PUBLIC_SUPABASE_URL);
    console.log('  - hasAnonKey:', !!requiredVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('  - anonKeyLength:', requiredVars.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0);
    console.log('  - hasServiceRoleKey:', !!requiredVars.SUPABASE_SERVICE_ROLE_KEY);
    console.log('  - supabaseUrl:', requiredVars.NEXT_PUBLIC_SUPABASE_URL);
  }

  return true;
}

// Call validation on module load
validateEnvironment();

// Try to parse environment, but don't throw if validation fails
let env: z.infer<typeof envSchema>;
const parseResult = envSchema.safeParse(process.env);

if (parseResult.success) {
  env = parseResult.data;
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Environment validation successful');
  }
} else {
  // Preserve real Supabase configuration even if optional fields (like NEXTAUTH_*) are missing
  env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    NEXTAUTH_SECRET:
      process.env.NEXTAUTH_SECRET || 'fallback-secret-key-for-development-only',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    BUILDIUM_BASE_URL: process.env.BUILDIUM_BASE_URL,
    BUILDIUM_CLIENT_ID: process.env.BUILDIUM_CLIENT_ID,
    BUILDIUM_CLIENT_SECRET: process.env.BUILDIUM_CLIENT_SECRET,
    BUILDIUM_WEBHOOK_SECRET: process.env.BUILDIUM_WEBHOOK_SECRET,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_CALENDAR_OAUTH_REDIRECT_URI:
      process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI,
    NYC_OPEN_DATA_API_KEY: process.env.NYC_OPEN_DATA_API_KEY,
    DOB_NOW_API_BASE_URL: process.env.DOB_NOW_API_BASE_URL,
    NYC_OPEN_DATA_BASE_URL: process.env.NYC_OPEN_DATA_BASE_URL,
    NYC_OPEN_DATA_APP_TOKEN: process.env.NYC_OPEN_DATA_APP_TOKEN,
    NYC_GEOSERVICE_API_KEY: process.env.NYC_GEOSERVICE_API_KEY,
    NYC_GEOSERVICE_BASE_URL: process.env.NYC_GEOSERVICE_BASE_URL,
  } as z.infer<typeof envSchema>;

  // Only log warnings in development, not in test mode
  if (process.env.NODE_ENV === 'development') {
    console.log('ℹ️ Environment validation failed, using fallback values where needed');
    console.debug('Validation details:', parseResult.error.flatten());
  }
}

export { env };
export type Env = z.infer<typeof envSchema>;
