'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function SignInForm() {
  const router = useRouter();
  const { user, loading, signIn, signInWithMagicLink } = useAuth();
  const search = useSearchParams();
  const nextPath = search?.get('next') || undefined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [authMethod, setAuthMethod] = useState<'magic' | 'credentials'>('credentials');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated (but not in test mode)
  useEffect(() => {
    if (!loading && user && process.env.NEXT_PUBLIC_TEST_AUTH_BYPASS !== 'true') {
      router.replace(nextPath || '/dashboard');
    }
  }, [user, loading, router, nextPath]);

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const { error } = await signInWithMagicLink(email);

      if (error) {
        setMessage(error.message || 'Failed to send sign-in link. Please try again.');
      } else {
        setMessage('Check your email for a sign-in link!');
      }
    } catch (err: any) {
      console.error('Magic link sign-in failed', err);
      setMessage(err?.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const { error } = await signIn(email, password);

      if (error) {
        setMessage(error.message || 'Invalid email or password. Please try again.');
      } else {
        setMessage('Login successful! Redirecting...');
        // Auth context will handle the redirect automatically
      }
    } catch (err: any) {
      console.error('Password sign-in failed', err);
      setMessage(err?.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = authMethod === 'magic' ? handleMagicLinkSubmit : handleCredentialsSubmit;

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-center">Sign in to your account</CardTitle>
          <p className="text-muted-foreground text-center text-sm">
            Welcome to Ora Property Management
          </p>
        </CardHeader>
        <CardContent>
          {/* Auth Method Toggle */}
          <div className="border-border bg-background flex rounded-md border p-1">
            <Button
              type="button"
              size="sm"
              variant={authMethod === 'credentials' ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => setAuthMethod('credentials')}
            >
              <Lock className="mr-2 h-4 w-4" />
              Password
            </Button>
            <Button
              type="button"
              size="sm"
              variant={authMethod === 'magic' ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => setAuthMethod('magic')}
            >
              <Mail className="mr-2 h-4 w-4" />
              Magic Link
            </Button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                />
                <Mail className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
              </div>
            </div>

            {authMethod === 'credentials' && (
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    {showPassword ? (
                      <EyeOff className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <Eye className="text-muted-foreground h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div
                className={`text-center text-sm ${
                  message.includes('Check your email') || message.includes('successful')
                    ? 'text-success'
                    : 'text-destructive'
                }`}
              >
                {message}
              </div>
            )}

            <div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? 'Signing in...'
                  : authMethod === 'magic'
                    ? 'Send sign-in link'
                    : 'Sign in'}
              </Button>
            </div>

            {authMethod === 'credentials' && (
              <div className="space-y-2 text-center">
                <p className="text-muted-foreground text-sm">
                  Don't have an account?{' '}
                  <a href="/auth/signup" className="text-primary font-medium hover:underline">
                    Create one here
                  </a>
                </p>
                <p className="text-muted-foreground text-sm">
                  Or{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMethod('magic')}
                    className="text-primary font-medium hover:underline"
                  >
                    use magic link instead
                  </button>
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground mt-2">Loading...</p>
          </div>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
