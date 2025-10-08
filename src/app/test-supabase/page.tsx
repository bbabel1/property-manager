'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/db'

type TestData = Record<string, unknown>

export default function TestSupabasePage() {
  const [connectionStatus, setConnectionStatus] = useState<string>('Testing...')
  const [testData, setTestData] = useState<TestData[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const testConnection = useCallback(async () => {
    try {
      setConnectionStatus('Testing connection...')
      
      // Test basic connection by fetching from a table
      // We'll try to fetch from a table that might not exist yet, but this will test the connection
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .limit(1)

      if (error) {
        if (error.message.includes('relation "properties" does not exist')) {
          setConnectionStatus('✅ Connected to Supabase! (Table "properties" does not exist yet)')
          setError('Table "properties" does not exist. You need to create the database tables.')
        } else {
          setConnectionStatus('❌ Connection failed')
          setError(error.message)
        }
      } else {
        setConnectionStatus('✅ Connected to Supabase!')
        setTestData(data as TestData[] | null)
      }
    } catch (err) {
      setConnectionStatus('❌ Connection failed')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  useEffect(() => {
    void testConnection()
  }, [testConnection])

  const createTestTable = async () => {
    try {
      setConnectionStatus('Creating test table...')
      
      // This would normally be done through the Supabase dashboard or migrations
      // For now, we'll just show a message
      setConnectionStatus('✅ Please create tables through Supabase dashboard')
      setError('Use the SQL provided in SUPABASE_SETUP.md to create your tables')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Supabase Connection Test</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Connection Status</h2>
        <div className="flex items-center mb-4">
          <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
          <span className={`text-sm ${
            connectionStatus.includes('✅') ? 'text-green-600' : 
            connectionStatus.includes('❌') ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {connectionStatus}
          </span>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <h3 className="text-sm font-medium text-red-800 mb-2">Error Details:</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        
        <div className="flex space-x-4">
          <button
            onClick={testConnection}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Test Connection
          </button>
          <button
            onClick={createTestTable}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            Create Tables
          </button>
        </div>
      </div>

      {testData !== null && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Test Data</h2>
          <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
            {JSON.stringify(testData, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-6">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Next Steps:</h3>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. Go to your Supabase dashboard</li>
          <li>2. Navigate to the SQL Editor</li>
          <li>3. Run the SQL from SUPABASE_SETUP.md to create your tables</li>
          <li>4. Come back and test the connection again</li>
        </ol>
      </div>
    </div>
  )
}
