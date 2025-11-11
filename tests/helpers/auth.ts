/**
 * Authentication helper for Playwright tests
 *
 * Provides reusable functions for authenticating test users
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env
// Note: Playwright tests run in a separate process and don't automatically load .env files
config({ path: '.env' });

// Test user credentials
const TEST_USER_EMAIL = 'brandon@managedbyora.com';
const TEST_USER_PASSWORD = 'B123b123!';

/**
 * Get a Bearer token for the test user
 * @returns Promise<string> The access token
 */
export async function getTestUserToken(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment.',
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (authError || !authData.session) {
    throw new Error(
      `Failed to authenticate test user: ${authError?.message || 'No session returned'}`,
    );
  }

  return authData.session.access_token;
}

/**
 * Get test user credentials
 */
export function getTestUserCredentials() {
  return {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  };
}
