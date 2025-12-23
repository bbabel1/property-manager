# Supabase Authentication Implementation Guide

## Current State

- ✅ **Supabase Auth Only**: Complete authentication through Supabase (email/password + magic links)
- ✅ **Clean Dependencies**: NextAuth removed
- ✅ **Native Integration**: Session via cookies using `@supabase/ssr`

## Supabase Auth Configuration

### Current Configuration (supabase/config.toml)

```toml

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://127.0.0.1:3000"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
enable_signup = true
enable_anonymous_sign_ins = false
minimum_password_length = 6

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true
max_frequency = "1m0s"
otp_length = 6
otp_expiry = 3600

```

### Environment Variables

```bash
# Required for Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## Implementation Plan

### Phase 1: Create Supabase Auth Context

**Create Auth Provider** (`src/lib/auth-context.tsx`):

```typescript

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/db'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signInWithMagicLink: (email: string) => Promise<any>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signInWithMagicLink = async (email: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signInWithMagicLink,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

```

### Phase 2: Create Authentication Pages

**Sign In Page** (`src/app/auth/signin/page.tsx`):

```typescript

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const { signIn, signInWithMagicLink } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (useMagicLink) {
        const { error } = await signInWithMagicLink(email)
        if (error) {
          setMessage(error.message)
        } else {
          setMessage('Check your email for the login link!')
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setMessage(error.message)
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      setMessage('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-center">Sign In</h2>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {!useMagicLink && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}

          <div className="flex items-center">
            <input
              id="magic-link"
              type="checkbox"
              checked={useMagicLink}
              onChange={(e) => setUseMagicLink(e.target.checked)}
              className="h-4 w-4 text-blue-600"
            />
            <label htmlFor="magic-link" className="ml-2 text-sm">
              Use magic link instead
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : (useMagicLink ? 'Send Magic Link' : 'Sign In')}
          </button>
        </form>

        {message && (
<div className={`text-center text-sm ${message.includes('Check your email') ? 'text-green-600' :
'text-red-600'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

```

**Auth Callback Page** (`src/app/auth/callback/page.tsx`):

```typescript

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/db'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Auth callback error:', error)
        router.push('/auth/signin?error=' + encodeURIComponent(error.message))

        return
      }

      if (data.session) {
        router.push('/dashboard')
      } else {
        router.push('/auth/signin')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing sign in...</h2>
        <p className="text-gray-600 mt-2">Please wait while we sign you in.</p>
      </div>
    </div>
  )
}

```

### Phase 3: Implement Protected Routes

**Auth Middleware** (`src/middleware.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(url, anon, {
    cookies: {
      get: (name) => req.cookies.get(name)?.value,
      set: (name, value, options) => res.cookies.set({ name, value, ...options }),
      remove: (name, options) => res.cookies.set({ name, value: '', ...options }),
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const pathname = req.nextUrl.pathname;
  const protectedPrefixes = ['/dashboard', '/properties', '/owners', '/units'];
  const requiresAuth = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (requiresAuth && !user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/auth/signin';
    redirectUrl.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname.startsWith('/auth')) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/properties/:path*',
    '/owners/:path*',
    '/units/:path*',
    '/auth/:path*',
  ],
};
```

**Protected Layout** (`src/app/(protected)/layout.tsx`):

```typescript

'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect in useEffect
  }

  return <>{children}</>
}

```

### Phase 4: Update Root Layout

**Updated Providers** (`src/components/providers.tsx`):

```typescript

'use client'

import { AuthProvider } from '@/lib/auth-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}

```

**Updated Root Layout** (`src/app/layout.tsx`):

```typescript

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ora Property Management',
  description: 'Modern property management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

```

## Authentication Flows

### 1. Email/Password Authentication

**Sign Up Flow:**

```typescript
const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (!error) {
    // User will receive confirmation email
    // Redirect to email confirmation page
  }

  return { data, error };
};
```

**Sign In Flow:**

```typescript
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!error) {
    // Automatic redirect to dashboard
    router.push('/dashboard');
  }

  return { data, error };
};
```

### 2. Magic Link Authentication

**Magic Link Flow:**

```typescript
const signInWithMagicLink = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (!error) {
    // User receives email with magic link
    // Show message to check email
  }

  return { data, error };
};
```

### 3. Session Management

**Client-Side Session Handling:**

```typescript
useEffect(() => {
  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
  });

  // Listen for auth state changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    setSession(session);
    setUser(session?.user ?? null);

    if (event === 'SIGNED_IN') {
      router.push('/dashboard');
    }

    if (event === 'SIGNED_OUT') {
      router.push('/auth/signin');
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

**Server-Side Session Validation:**

```typescript
// src/lib/auth-server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function getServerSession() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}
```

## Row Level Security Integration

### User-Based Access Control

**Link Auth Users to Business Entities:**

```sql

-- Add auth_user_id to staff table for property managers
ALTER TABLE staff ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);

-- Add auth_user_id to owners table for property owners
ALTER TABLE owners ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);

```

**Property Access Policies:**

```sql

-- Property managers can access their assigned properties
CREATE POLICY "Property managers can access assigned properties" ON properties
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM property_staff ps
        JOIN staff s ON ps.staff_id = s.id
        WHERE ps.property_id = properties.id
        AND s.auth_user_id = auth.uid()
      )
    );

-- Property owners can access their properties
CREATE POLICY "Property owners can access their properties" ON properties
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM ownership o
        JOIN owners ow ON o.owner_id = ow.id
        WHERE o.property_id = properties.id
        AND ow.auth_user_id = auth.uid()
      )
    );

```

**Ownership Access Policies:**

```sql

-- Users can only see ownership records for their properties
CREATE POLICY "Users can access ownership for their properties" ON ownership
    FOR ALL USING (
      -- Property manager access
      EXISTS (
        SELECT 1 FROM property_staff ps
        JOIN staff s ON ps.staff_id = s.id
        WHERE ps.property_id = ownership.property_id
        AND s.auth_user_id = auth.uid()
      )
      OR
      -- Owner access
      EXISTS (
        SELECT 1 FROM owners o
        WHERE o.id = ownership.owner_id
        AND o.auth_user_id = auth.uid()
      )
    );

```

## Migration Steps (Completed)

### Step 1: Package Dependencies

```bash
# Added Supabase SSR helpers
npm install @supabase/ssr
```

### Step 2: Update Environment Variables

```bash

# Remove from .env.local

NEXTAUTH_URL=...
NEXTAUTH_SECRET=...
EMAIL_SERVER_HOST=...
EMAIL_SERVER_PORT=...
EMAIL_SERVER_USER=...
EMAIL_SERVER_PASSWORD=...
EMAIL_FROM=...

# Keep only Supabase variables

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

```

### Step 3: Replace Components

1. **Remove** `SessionProvider` from providers.tsx

2. **Add** `AuthProvider` with Supabase Auth

3. **Create** authentication pages

4. **Implement** protected route middleware

5. **Update** navigation and user interface

### Step 4: Database Integration

```sql

-- Add auth_user_id columns to relevant tables
ALTER TABLE staff ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE owners ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);

-- Create proper RLS policies
-- (Replace current "allow all" policies with user-specific ones)

```

## Testing Authentication

### Manual Testing Checklist

- [ ] Sign up with email/password
- [ ] Receive and click confirmation email
- [ ] Sign in with email/password
- [ ] Sign out successfully
- [ ] Request magic link
- [ ] Click magic link from email
- [ ] Access protected pages when authenticated
- [ ] Redirect to sign-in when not authenticated
- [ ] Session persistence across browser refresh

### Automated Testing

```typescript
// Example test
describe('Authentication Flow', () => {
  it('should sign up user successfully', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
  });
});
```

## Security Considerations

### Production Checklist

- [ ] Enable email confirmations in production
- [ ] Configure proper SMTP server for emails
- [ ] Set up proper RLS policies (remove "allow all" policies)
- [ ] Implement rate limiting for auth endpoints
- [ ] Configure password requirements
- [ ] Set up proper redirect URLs for production domain
- [ ] Enable refresh token rotation
- [ ] Configure session timeouts

### Best Practices

1. **Never expose service role key** to client-side code

2. **Use RLS policies** instead of API-level authorization

3. **Validate all user inputs** before database operations

4. **Log authentication events** for security monitoring

5. **Implement proper session timeout** handling

6. **Use HTTPS** in production for all auth operations

## Rollback Plan (Historical)

If issues arise (historical hybrid context):

1. (Legacy) Revert package.json to include NextAuth
2. (Legacy) Restore SessionProvider in providers.tsx
3. Keep Supabase configuration for database operations
4. Maintain hybrid state until issues resolved

Note: Current architecture is Supabase-only; this section is kept for historical reference.
