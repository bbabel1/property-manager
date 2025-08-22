'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/db'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus('loading')
        setMessage('Completing authentication...')

        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          setStatus('error')
          setMessage('Authentication failed. Please try again.')
          
          // Redirect to signin with error after delay
          setTimeout(() => {
            router.push('/auth/signin?error=' + encodeURIComponent(error.message))
          }, 3000)
          return
        }

        if (data.session) {
          setStatus('success')
          setMessage('Authentication successful! Redirecting to dashboard...')
          
          // Redirect to dashboard after short delay
          setTimeout(() => {
            router.push('/dashboard')
          }, 1500)
        } else {
          setStatus('error')
          setMessage('No active session found. Redirecting to sign in...')
          
          // Redirect to signin after delay
          setTimeout(() => {
            router.push('/auth/signin')
          }, 3000)
        }
      } catch (error) {
        console.error('Unexpected callback error:', error)
        setStatus('error')
        setMessage('An unexpected error occurred. Redirecting to sign in...')
        
        setTimeout(() => {
          router.push('/auth/signin')
        }, 3000)
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <h2 className="text-xl font-semibold text-gray-900">
                Completing sign in...
              </h2>
              <p className="text-gray-600">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-green-900">
                Authentication Successful!
              </h2>
              <p className="text-green-600">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-red-900">
                Authentication Failed
              </h2>
              <p className="text-red-600">{message}</p>
              <button
                onClick={() => router.push('/auth/signin')}
                className="text-sm text-blue-600 hover:text-blue-500 underline"
              >
                Go to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}