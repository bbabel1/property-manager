'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Mail, Eye, EyeOff, Github } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Body, Heading, Label } from '@/ui/typography';

type OAuthProvider = 'github' | 'google';

const oauthProviderLabels: Record<OAuthProvider, string> = {
  github: 'GitHub',
  google: 'Google',
};

function GoogleGlyph() {
  return (
    <Label
      as="span"
      size="sm"
      className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-background text-[#4285F4]"
    >
      G
    </Label>
  );
}

function SignInForm() {
  const router = useRouter();
  const { user, loading, signIn, signInWithProvider } = useAuth();
  const search = useSearchParams();
  const nextPath = search?.get('next') || undefined;
  const errorParam = search?.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | OAuthProvider>(null);

  useEffect(() => {
    if (!loading && user && process.env.NEXT_PUBLIC_TEST_AUTH_BYPASS !== 'true') {
      router.replace(nextPath || '/dashboard');
    }
  }, [user, loading, router, nextPath]);

  useEffect(() => {
    if (!errorParam) {
      return;
    }
    const errorMessages: Record<string, string> = {
      missing_oauth_code: 'We could not complete the sign-in. Please try again.',
      oauth_exchange_failed: 'There was a problem completing the sign-in. Please try again.',
    };
    setMessage(errorMessages[errorParam] || 'Sign-in failed. Please try again.');
    setMessageType('error');
  }, [errorParam]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const { error } = await signIn(email, password);

      if (error) {
        setMessage(error.message || 'Invalid email or password. Please try again.');
        setMessageType('error');
      } else {
        setMessage('Login successful! Redirecting...');
        setMessageType('success');
      }
    } catch (err: any) {
      console.error('Password sign-in failed', err);
      setMessage(err?.message || 'An error occurred. Please try again.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    setMessage('');
    setMessageType('');

    try {
      const { error } = await signInWithProvider(provider, nextPath);
      if (error) {
        setMessage(error.message || `${oauthProviderLabels[provider]} sign-in failed. Please try again.`);
        setMessageType('error');
        setOauthLoading(null);
      }
      // Successful calls will redirect via Supabase OAuth flow.
    } catch (err: any) {
      console.error(`${oauthProviderLabels[provider]} sign-in failed`, err);
      setMessage(err?.message || 'An error occurred. Please try again.');
      setMessageType('error');
      setOauthLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <Body as="p" tone="muted" className="mt-2">
            Loading...
          </Body>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle>
            <Heading as="h1" size="h3" className="text-center">
              Sign in to your account
            </Heading>
          </CardTitle>
          <Body as="p" size="sm" tone="muted" className="text-center">
            Welcome to Ora Property Management
          </Body>
        </CardHeader>
        <CardContent>
          <form className="mt-6 space-y-4" onSubmit={handleCredentialsSubmit}>
            <div>
              <Label htmlFor="email" className="sr-only">
                Email address
              </Label>
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

            <div>
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
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

            {message && (
              <div
                className={`text-center text-sm ${
                  messageType === 'success' ? 'text-success' : 'text-destructive'
                }`}
              >
                <Body as="p" size="sm" className="text-center">
                  {message}
                </Body>
              </div>
            )}

            <div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
          </form>

          <div className="bg-muted/50 mt-6 flex flex-col gap-2 rounded-md p-3">
            <Body
              as="p"
              size="sm"
              tone="muted"
              className="text-center uppercase tracking-wide"
            >
              Or continue with
            </Body>
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthSignIn('google')}
                disabled={oauthLoading !== null}
              >
                {oauthLoading === 'google' ? (
                  'Redirecting to Google...'
                ) : (
                  <>
                    <GoogleGlyph />
                    Sign in with Google
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthSignIn('github')}
                disabled={oauthLoading !== null}
              >
                {oauthLoading === 'github' ? (
                  'Redirecting to GitHub...'
                ) : (
                  <>
                    <Github className="mr-2 h-4 w-4" />
                    Sign in with GitHub
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-center">
            <Body as="p" size="sm" tone="muted">
              {"Don't have an account? "}
              <a href="/auth/signup" className="text-primary font-medium hover:underline">
                Create one here
              </a>
            </Body>
          </div>
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
            <Body as="p" tone="muted" className="mt-2">
              Loading...
            </Body>
          </div>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
