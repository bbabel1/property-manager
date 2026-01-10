// Global test setup - runs before all tests
// Sets up mock environment variables to silence warnings during test runs

const env = process.env as NodeJS.ProcessEnv

// Set NODE_ENV to test if not already set
if (!env.NODE_ENV) {
  Reflect.set(env, 'NODE_ENV', 'test')
}

// Provide mock Supabase environment variables if not already set
// These are dummy values used only for test environment validation
if (!env.NEXT_PUBLIC_SUPABASE_URL) {
  Reflect.set(env, 'NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
}

if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  Reflect.set(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key-for-testing-only')
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  Reflect.set(env, 'SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key-for-testing-only')
}

// Set other required env vars if missing
if (!env.NEXTAUTH_URL) {
  Reflect.set(env, 'NEXTAUTH_URL', 'http://localhost:3000')
}

if (!env.NEXTAUTH_SECRET) {
  Reflect.set(env, 'NEXTAUTH_SECRET', 'test-secret-key-for-testing-only-min-32-chars')
}

// Default opt-out for Supabase RPC integration tests unless explicitly enabled
if (!env.RUN_SUPABASE_RPC_TESTS) {
  Reflect.set(env, 'RUN_SUPABASE_RPC_TESTS', 'false')
}

// Provide a placeholder Buildium webhook secret for tests that rely on env fallback
if (!env.BUILDIUM_WEBHOOK_SECRET) {
  Reflect.set(env, 'BUILDIUM_WEBHOOK_SECRET', 'test-webhook-secret-for-testing-only')
}


