'use client'

import { useState, useEffect } from 'react'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'
import { auth } from '@/lib/auth'

export default function SignInPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [authMethod, setAuthMethod] = useState<'magic' | 'credentials'>('credentials')
  const [showPassword, setShowPassword] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      const { error } = await auth.signInWithMagicLink(email)

      if (error) {
        setMessage('Failed to send sign-in link. Please try again.')
      } else {
        setMessage('Check your email for a sign-in link!')
      }
    } catch {
      setMessage('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      const { error } = await auth.signIn(email, password)

      if (error) {
        setMessage('Invalid email or password. Please try again.')
      } else {
        setMessage('Login successful! Redirecting...')
        // Auth context will handle the redirect automatically
      }
    } catch {
      setMessage('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = authMethod === 'magic' ? handleMagicLinkSubmit : handleCredentialsSubmit

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Welcome to Ora Property Management
          </p>
        </div>

        {/* Auth Method Toggle */}
        <div className="flex rounded-lg border border-gray-200 p-1 bg-white">
          <button
            type="button"
            onClick={() => setAuthMethod('credentials')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              authMethod === 'credentials'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Lock className="h-4 w-4 inline mr-2" />
            Password
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod('magic')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              authMethod === 'magic'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="h-4 w-4 inline mr-2" />
            Magic Link
          </button>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
            />
          </div>

          {authMethod === 'credentials' && (
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className={`text-sm text-center ${message.includes('Check your email') || message.includes('successful') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : authMethod === 'magic' ? 'Send sign-in link' : 'Sign in'}
            </button>
          </div>

          {authMethod === 'credentials' && (
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <a href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
                  Create one here
                </a>
              </p>
              <p className="text-sm text-gray-600">
                Or{' '}
                <button
                  type="button"
                  onClick={() => setAuthMethod('magic')}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  use magic link instead
                </button>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}